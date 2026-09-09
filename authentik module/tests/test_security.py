from types import SimpleNamespace
import unittest

from fastapi import HTTPException

from authentik_auth.security import TokenVerifier


def settings():
    return SimpleNamespace(
        jwks_url="https://auth.example.com/application/o/example/jwks/",
        request_timeout=5,
        audience="client-id",
        issuer="https://auth.example.com/application/o/example/",
        allowed_roles=("Admin", "Employee", "Guest"),
    )


class TokenVerifierTests(unittest.TestCase):
    def test_roles_are_normalised_and_deduplicated(self):
        verifier = TokenVerifier(settings())
        self.assertEqual(
            verifier.roles(
                {"role": "Admin", "groups": ["Employee", "admin", "unrelated"]}
            ),
            ["Admin", "Employee"],
        )

    def test_encrypted_jwe_has_actionable_error(self):
        verifier = TokenVerifier(settings())
        with self.assertRaises(HTTPException) as error:
            verifier.decode("header.encrypted-key.iv.ciphertext.tag")
        self.assertEqual(error.exception.status_code, 401)
        self.assertIn("Encryption Key", error.exception.detail)


if __name__ == "__main__":
    unittest.main()
