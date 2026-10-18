"""Real loopback HTTP tests for read-only Zcash node readiness and auth."""
import contextlib
import io
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'packages/python/src'))
from zerynex_py import ZerynexError, evaluate_blockchain_info, inspect_node_local
from zerynex_py.node import REQUEST_ID

DATA=json.loads((ROOT/'tests/fixtures/node/chain-readiness.json').read_text())
PRIVACY_MARKER='DO_NOT_LEAK_PRIVATE_MARKER'

class RpcHandler(BaseHTTPRequestHandler):
    response_status=200
    response_result=DATA['cases'][0]['result']
    override_body=None
    received=[]
    def do_POST(self):
        body=self.rfile.read(int(self.headers.get('Content-Length','0')))
        try: value=json.loads(body)
        except ValueError: value={}
        self.__class__.received.append({'path':self.path,'method':value.get('method'),
                                         'params':value.get('params'),
                                         'authorization_present':'Authorization' in self.headers,
                                         'raw_request':body})
        if self.__class__.override_body is not None:
            data=self.__class__.override_body
        else:
            data=json.dumps({'jsonrpc':'1.0','id':REQUEST_ID,'result':self.__class__.response_result,'error':None}).encode()
        self.send_response(self.__class__.response_status)
        self.send_header('Content-Type','application/json')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_GET(self):
        self.send_response(405)
        self.end_headers()
    def log_message(self,*args):pass

class ZcashNodeReadinessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),RpcHandler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
    def setUp(self):
        RpcHandler.response_status=200
        RpcHandler.response_result=DATA['cases'][0]['result']
        RpcHandler.override_body=None
        RpcHandler.received=[]

    def test_shared_cross_language_vectors_are_conservative_and_redacted(self):
        self.assertEqual(DATA['schema_version'],1)
        for case in DATA['cases']:
            with self.subTest(name=case['name']):
                result=evaluate_blockchain_info(case['result'],expected_network=case['expected_network'])
                self.assertEqual(result.ready,case['ready'])
                self.assertEqual([check['status'] for check in result.checks],case['codes'])
                self.assertEqual(result.expected_network,case['expected_network'])
                self.assertNotIn(PRIVACY_MARKER,json.dumps(result.as_dict()))
                self.assertNotIn('valuePools',json.dumps(result.as_dict()))

    def test_one_read_only_rpc_method_and_sanitized_public_result(self):
        report=inspect_node_local(port=self.server.server_port,expected_network='main')
        self.assertTrue(report.ready)
        self.assertEqual(report.network,'main')
        self.assertEqual(report.height,3150000)
        self.assertEqual([x['code'] for x in report.checks],['NETWORK_MATCH','CHAIN_HEIGHT','HEADER_LAG','INITIAL_SYNC','VERIFICATION_PROGRESS'])
        self.assertEqual(len(RpcHandler.received),1)
        req=RpcHandler.received[0]
        self.assertEqual(req['method'],'getblockchaininfo')
        self.assertEqual(req['params'],[])
        self.assertEqual(req['path'],'/')
        self.assertNotIn(PRIVACY_MARKER,json.dumps(report.as_dict()))
        self.assertNotIn('bestblockhash',json.dumps(report.as_dict()))

    def test_secure_cookie_read_without_argv_or_report_leaks(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'.cookie'
            file.write_text('only-test-user:ONLY_TEST_SECRET')
            file.chmod(0o600)
            report=inspect_node_local(port=self.server.server_port,expected_network='main',cookie_file=file)
            self.assertTrue(report.ready)
            self.assertTrue(RpcHandler.received[0]['authorization_present'])
            self.assertNotIn('ONLY_TEST_SECRET',json.dumps(report.as_dict()))
            file.chmod(0o644)
            with self.assertRaises(ZerynexError):
                inspect_node_local(port=self.server.server_port,expected_network='main',cookie_file=file)
            link=Path(directory)/'alias'
            link.symlink_to(file)
            with self.assertRaises(ZerynexError):
                inspect_node_local(port=self.server.server_port,expected_network='main',cookie_file=link)
            file.chmod(0o600)
            file.write_text('only-test-user:ONLY_TEST_SECRET\n')
            with self.assertRaises(ZerynexError):
                inspect_node_local(port=self.server.server_port,expected_network='main',cookie_file=file)

    def test_never_sends_to_remote_or_untrusted_rpc_hosts(self):
        for host in ['example.org','8.8.8.8','192.168.1.3','0.0.0.0','169.254.169.254']:
            with self.subTest(host=host),self.assertRaises(ZerynexError):
                inspect_node_local(host=host,port=self.server.server_port)
        self.assertEqual(RpcHandler.received,[])
        for invalid in [None,0,-1,65536,'8232',True]:
            with self.subTest(port=invalid),self.assertRaises(ZerynexError):
                inspect_node_local(port=invalid)

    def test_malformed_response_and_remote_error_are_private(self):
        for body in [b'not json'+PRIVACY_MARKER.encode(),
                     json.dumps({'id':REQUEST_ID,'error':{'message':PRIVACY_MARKER},'result':None}).encode(),
                     json.dumps({'id':'unrecognized','result':DATA['cases'][0]['result']}).encode(),
                     b'{' + b'Z'*70000 + b'}']:
            RpcHandler.override_body=body
            with self.subTest(length=len(body)),self.assertRaises(ZerynexError) as caught:
                inspect_node_local(port=self.server.server_port)
            self.assertNotIn(PRIVACY_MARKER,str(caught.exception))
            self.assertNotIn('ZZZZ',str(caught.exception))
        RpcHandler.override_body=None
        RpcHandler.response_status=403
        with self.assertRaises(ZerynexError) as caught:
            inspect_node_local(port=self.server.server_port)
        self.assertNotIn(PRIVACY_MARKER,str(caught.exception))

    def test_cli_exit_codes_and_secret_free_stdout_stderr(self):
        base=[sys.executable,'-m','zerynex_py.node','--host','127.0.0.1',
              '--port',str(self.server.server_port)]
        env={**os.environ,'PYTHONPATH':str(ROOT/'packages/python/src')}
        ok=subprocess.run([*base,'--expect-network','main'],capture_output=True,text=True,env=env,timeout=10)
        self.assertEqual(ok.returncode,0,ok.stderr)
        self.assertTrue(json.loads(ok.stdout)['ready'])
        self.assertNotIn(PRIVACY_MARKER,ok.stdout)
        bad=subprocess.run([*base,'--expect-network','test'],capture_output=True,text=True,env=env,timeout=10)
        self.assertEqual(bad.returncode,2)
        self.assertFalse(json.loads(bad.stdout)['ready'])
        blocked=subprocess.run([*base,'--host','example.com'],capture_output=True,text=True,env=env,timeout=10)
        self.assertEqual(blocked.returncode,1)
        self.assertEqual(blocked.stdout,'')

if __name__=='__main__':unittest.main()
