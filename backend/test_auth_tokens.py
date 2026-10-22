"""
JWT bearer-token regression tests (stdlib unittest only).

The API trusts no localStorage flag: every protected router
resolves the Authorization header through decode_access_token.
These tests pin the token contract without needing a database:

  1. create -> decode round-trips the subject email;
  2. forged tokens decode to None;
  3. tampered payloads decode to None;
  4. tokens from a different secret decode to None.

Run from backend/:
    venv\\Scripts\\python.exe -m unittest test_auth_tokens -v
"""

import os
import unittest

os.environ.setdefault("JWT_SECRET", "phoenix-ci-test-secret")

from app.utils.security import (  # noqa: E402
    create_access_token,
    decode_access_token,
)


class AuthTokenTests(unittest.TestCase):
    def test_round_trip(self):
        token = create_access_token("analyst@phoenix.ai")
        self.assertEqual(
            decode_access_token(token), "analyst@phoenix.ai"
        )

    def test_forged_token_rejected(self):
        self.assertIsNone(
            decode_access_token("forged.token.here")
        )
        self.assertIsNone(decode_access_token(""))
        self.assertIsNone(decode_access_token("not-a-token"))

    def test_tampered_payload_rejected(self):
        token = create_access_token("analyst@phoenix.ai")
        header, payload, signature = token.split(".")
        tampered = (
            header
            + "."
            + payload[:-2]
            + ("AA" if not payload.endswith("AA") else "BB")
            + "."
            + signature
        )
        self.assertIsNone(decode_access_token(tampered))

    def test_wrong_secret_rejected(self):
        from jose import jwt as jose_jwt

        foreign = jose_jwt.encode(
            {"sub": "analyst@phoenix.ai"},
            "a-completely-different-secret",
            algorithm="HS256",
        )
        self.assertIsNone(decode_access_token(foreign))


if __name__ == "__main__":
    unittest.main(verbosity=2)
