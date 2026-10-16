"""Mock HTTP endpoint integration checks for documented Zebra health routes."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "packages" / "python" / "src"))
from zerynex_py import check_zebra_local, ZerynexError


class LocalHealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthy":
            self.send_response(200)
        elif self.path == "/ready":
            self.send_response(503)
        else:
            self.send_response(404)
        self.end_headers()
        self.wfile.write(b"private-internal-node-health-data-that-must-not-appear")

    def log_message(self, format, *args):
        pass


class Z3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), LocalHealthHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_reports_liveness_without_falsely_claiming_readiness(self):
        report = check_zebra_local(port=self.server.server_port)
        self.assertEqual(report.liveness, "healthy")
        self.assertEqual(report.readiness, "not_ready")
        self.assertNotIn("private-internal-node-health-data", json.dumps(report.as_dict()))
        self.assertIn("not confirmed", report.summary)

    def test_rejects_external_hostnames_and_nonloopback_addresses(self):
        for host in ("example.com", "metadata.google.internal", "8.8.8.8", "192.168.1.100", "0.0.0.0"):
            with self.subTest(host=host), self.assertRaises(ZerynexError):
                check_zebra_local(host=host, port=self.server.server_port)

    def test_rejects_invalid_ports(self):
        for value in (-1, 0, 70000, "80", True):
            with self.subTest(value=value), self.assertRaises(ZerynexError):
                check_zebra_local(port=value)

    def test_uses_only_documented_health_paths(self):
        called = []
        def synthetic_probe(host, port, route, timeout):
            called.append(route)
            return 200
        with patch("zerynex_py.z3._query", synthetic_probe):
            report = check_zebra_local()
        self.assertEqual(called, ["/healthy", "/ready"])
        self.assertEqual(report.liveness, "healthy")
        self.assertEqual(report.readiness, "healthy")

    def test_connection_refused_is_not_misrepresented(self):
        with patch("zerynex_py.z3._query", return_value=None):
            result = check_zebra_local()
        self.assertEqual(result.liveness, "unavailable")
        self.assertEqual(result.readiness, "unavailable")


if __name__ == "__main__":
    unittest.main()
