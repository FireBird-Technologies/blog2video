"""Depth tier — token encryption for stored OAuth grants.

The invariants: an unconfigured or malformed key disables the feature instead of
crashing anything, a token never reaches the database in plaintext, and a
ciphertext that does not belong to the current key fails loudly rather than
returning something that would later be sent to Google as a bearer token.
"""
import pytest
from cryptography.fernet import Fernet

from app.config import settings
from app.services import token_crypto

pytestmark = pytest.mark.depth


@pytest.fixture(autouse=True)
def _restore_key(monkeypatch):
    """Each test sets its own key and leaves the cache clean for the next."""
    original = settings.SOCIAL_TOKEN_ENC_KEY
    token_crypto.reset_cache()
    yield
    settings.SOCIAL_TOKEN_ENC_KEY = original
    token_crypto.reset_cache()


def _set_key(key: str) -> None:
    settings.SOCIAL_TOKEN_ENC_KEY = key
    token_crypto.reset_cache()


# ─── Degradation ────────────────────────────────────────────────────────────

def test_unset_key_disables_without_raising():
    _set_key("")
    assert token_crypto.is_configured() is False


def test_unset_key_refuses_to_store_plaintext():
    """The whole point: no plaintext fallback when encryption is unavailable."""
    _set_key("")
    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.encrypt("ya29.a-real-refresh-token")
    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.decrypt("some-stored-ciphertext")


def test_malformed_key_disables_without_raising():
    """A bad key is a config error, not a reason to take the app down."""
    _set_key("this-is-not-a-fernet-key")
    assert token_crypto.is_configured() is False


def test_none_and_empty_pass_through():
    """Optional tokens stay NULL rather than becoming ciphertext of ''."""
    _set_key(Fernet.generate_key().decode())
    assert token_crypto.encrypt(None) is None
    assert token_crypto.encrypt("") is None
    assert token_crypto.decrypt(None) is None
    assert token_crypto.decrypt("") is None


# ─── Round trip ─────────────────────────────────────────────────────────────

def test_round_trip_and_ciphertext_is_not_plaintext():
    _set_key(Fernet.generate_key().decode())
    secret = "1//0abcdef-refresh-token-value"

    ciphertext = token_crypto.encrypt(secret)

    assert ciphertext != secret
    assert secret not in ciphertext
    assert token_crypto.decrypt(ciphertext) == secret


def test_same_plaintext_encrypts_differently_each_time():
    """Fernet embeds a random IV, so equal tokens are not equal ciphertexts."""
    _set_key(Fernet.generate_key().decode())

    first = token_crypto.encrypt("same-token")
    second = token_crypto.encrypt("same-token")

    assert first != second
    assert token_crypto.decrypt(first) == token_crypto.decrypt(second) == "same-token"


# ─── Failure modes ──────────────────────────────────────────────────────────

def test_rotated_key_raises_rather_than_returning_garbage():
    """Rotation is the documented cost: every connection must be re-established."""
    _set_key(Fernet.generate_key().decode())
    ciphertext = token_crypto.encrypt("token-under-old-key")

    _set_key(Fernet.generate_key().decode())

    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.decrypt(ciphertext)


def test_tampered_ciphertext_is_rejected():
    """Authenticated encryption: a modified token must not decrypt at all."""
    _set_key(Fernet.generate_key().decode())
    ciphertext = token_crypto.encrypt("authentic-token")

    tampered = ciphertext[:-4] + ("AAAA" if not ciphertext.endswith("AAAA") else "BBBB")

    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.decrypt(tampered)


def test_non_ascii_garbage_column_value_is_rejected():
    """A drifted/corrupted column must raise, not explode with a random error."""
    _set_key(Fernet.generate_key().decode())

    with pytest.raises(token_crypto.TokenCryptoError):
        token_crypto.decrypt("not base64 at all ☃")
