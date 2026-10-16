import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_rpc_contract import compare, ContractInputError, parse_methods

class RpcContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / 'tests/fixtures/rpc/zallet-synthetic-openrpc.json').read_text())
        cls.contract = json.loads((ROOT / 'tests/fixtures/rpc/zallet-minimum-contract.json').read_text())

    def test_documented_synthetic_methods_match(self):
        result = compare(self.schema, self.contract)
        self.assertTrue(result["passed"])
        self.assertEqual(result["checked_methods"], 4)
        self.assertEqual(result["finding_count"], 0)

    def test_catches_missing_method(self):
        schema = copy.deepcopy(self.schema)
        schema["methods"] = [item for item in schema["methods"] if item["name"] != "pczt_extract"]
        result = compare(schema, self.contract)
        self.assertEqual(result["findings"][0]["rule"], "RPC-METHOD-MISSING")
        self.assertEqual(result["findings"][0]["method"], "pczt_extract")

    def test_catches_missing_parameter(self):
        schema = copy.deepcopy(self.schema)
        next(m for m in schema["methods"] if m["name"] == "pczt_sign")["params"].pop()
        result = compare(schema, self.contract)
        self.assertIn("RPC-PARAMETER-MISSING", [item["rule"] for item in result["findings"]])

    def test_catches_required_flag_change(self):
        schema = copy.deepcopy(self.schema)
        next(m for m in schema["methods"] if m["name"] == "pczt_sign")["params"][1]["required"] = True
        result = compare(schema, self.contract)
        self.assertIn("RPC-REQUIRED-FLAG-CHANGED", [item["rule"] for item in result["findings"]])

    def test_catches_order_change(self):
        schema = copy.deepcopy(self.schema)
        next(m for m in schema["methods"] if m["name"] == "pczt_sign")["params"].reverse()
        result = compare(schema, self.contract)
        self.assertIn("RPC-PARAMETER-ORDER", [item["rule"] for item in result["findings"]])

    def test_extra_methods_and_params_allowed(self):
        schema = copy.deepcopy(self.schema)
        schema["methods"].append({"name": "other_method", "params": []})
        next(m for m in schema["methods"] if m["name"] == "pczt_sign")["params"].append(
            {"name": "extra", "required": False})
        self.assertTrue(compare(schema, self.contract)["passed"])

    def test_invalid_or_duplicate_fields_fail_closed(self):
        contract = copy.deepcopy(self.contract)
        contract["methods"].append(contract["methods"][0])
        with self.assertRaises(ContractInputError):
            compare(self.schema, contract)
        contract = copy.deepcopy(self.contract)
        contract["methods"][0]["name"] = "../../secrets"
        with self.assertRaises(ContractInputError):
            compare(self.schema, contract)
        contract = copy.deepcopy(self.contract)
        contract["methods"][0]["params"].append({"name": "secret", "required": "yes"})
        with self.assertRaises(ContractInputError):
            parse_methods(contract, contract=True)

    def test_cli_machine_readable_codes(self):
        command = [sys.executable, str(ROOT / "scripts/check_rpc_contract.py"),
                   "--schema", str(ROOT / "tests/fixtures/rpc/zallet-synthetic-openrpc.json"),
                   "--contract", str(ROOT / "tests/fixtures/rpc/zallet-minimum-contract.json"),
                   "--json"]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(json.loads(result.stdout)["passed"])

    def test_invalid_rpc_source_data_not_echoed(self):
        with tempfile.TemporaryDirectory() as temp:
            data = Path(temp) / "schema.json"
            data.write_text('{"credential":"FAKE_PRIVATE_MARKER"}')
            command = [sys.executable, str(ROOT / "scripts/check_rpc_contract.py"),
                       "--schema", str(data),
                       "--contract", str(ROOT / "tests/fixtures/rpc/zallet-minimum-contract.json"), "--json"]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertNotIn("FAKE_PRIVATE_MARKER", result.stdout + result.stderr)

if __name__ == "__main__":
    unittest.main()
