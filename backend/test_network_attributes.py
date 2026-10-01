"""
Network attribute regression tests (stdlib unittest only).

Verifies that graph nodes/edges originate from real
IEEE-CIS-supported fields:
  1. every data: allowlist field exists in the raw IEEE-CIS
     headers (transaction or identity file);
  2. boolean presence flags never become relationships;
  3. every emitted attribute value appears verbatim in the
     stored input dicts (no invention, no normalization);
  4. non-allowlisted additional_data (city, scenario,
     V-columns, counters) never becomes relationships.

Run from backend/:
    venv\\Scripts\\python.exe -m unittest test_network_attributes -v
"""

import csv
import unittest
from pathlib import Path
from types import SimpleNamespace

from app.api.routes.transactions import (
    NON_RELATIONSHIP_FIELDS,
    extract_relationship_attributes,
)

RAW_DIR = Path("storage/raw/ieee_cis")


def _headers(name):
    with open(RAW_DIR / name, newline="", encoding="utf-8") as f:
        return next(csv.reader(f))


class NetworkAttributeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        txn = set(_headers("train_transaction.csv"))
        idn = set(_headers("train_identity.csv"))
        cls.vocabulary = txn | idn

    def test_data_allowlist_is_ieee_vocabulary(self):
        allowed = {
            "card1",
            "card2",
            "card3",
            "card4",
            "card5",
            "card6",
            "P_emaildomain",
            "R_emaildomain",
            "addr1",
            "addr2",
            "DeviceType",
            "DeviceInfo",
        }
        missing = allowed - self.vocabulary
        self.assertEqual(
            missing,
            set(),
            f"allowlist fields missing from IEEE-CIS headers: {missing}",
        )

    def test_flag_fields_excluded(self):
        txn = SimpleNamespace(
            card_information={
                "card_id": "CARD_1",
                "card_present": True,
            },
            device_information={
                "device_id": "DEV_1",
                "device_known": False,
            },
            additional_data={},
        )
        attrs = extract_relationship_attributes(txn)
        for key in attrs:
            self.assertNotIn("card_present", key)
            self.assertNotIn("device_known", key)
        self.assertIn("card:card_id", attrs)
        self.assertIn("device:device_id", attrs)

    def test_values_verbatim_no_invention(self):
        txn = SimpleNamespace(
            card_information={"card1": 13566},
            device_information={"DeviceType": "mobile"},
            additional_data={
                "P_emaildomain": "gmail.com",
                "addr1": 315,
            },
        )
        attrs = extract_relationship_attributes(txn)
        self.assertEqual(attrs["card:card1"], "13566")
        self.assertEqual(attrs["device:DeviceType"], "mobile")
        self.assertEqual(
            attrs["data:P_emaildomain"], "gmail.com"
        )
        self.assertEqual(attrs["data:addr1"], "315")

    def test_non_allowlisted_fields_ignored(self):
        txn = SimpleNamespace(
            card_information={},
            device_information={},
            additional_data={
                "city": "Kochi",
                "scenario": "NORMAL",
                "V306": 3.0,
                "transaction_frequency": 2,
                "C14": 0.0,
            },
        )
        attrs = extract_relationship_attributes(txn)
        self.assertEqual(attrs, {})

    def test_blanks_and_nones_ignored(self):
        txn = SimpleNamespace(
            card_information={"card_id": "   ", "card4": None},
            device_information={},
            additional_data={},
        )
        self.assertEqual(
            extract_relationship_attributes(txn), {}
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
