"""
Depth tier — built-in email/password auth.

Two invariants carry most of the weight here:

1. One account per email, across ALL four providers. A social-owned address is
   rejected before a password is accepted, before a code is issued, and before
   any mail is sent — a user whose address is a Google account learns that
   immediately rather than after a round trip through their inbox.
2. A row in ``users`` always means a real, verified account. A pending signup
   lives on a code row, never as an inactive user, so an abandoned registration
   can neither squat the unique email nor masquerade as a deleted account.
"""
from datetime import datetime, timedelta

import pytest

import app.routers.auth as auth_router
from app.models.email_verification import EmailVerificationCode, VerificationPurpose
from app.models.user import AuthProvider, PlanTier, User
from app.services import rate_limit
from app.services.password import hash_password

pytestmark = pytest.mark.depth

CODE = "123456"
PASSWORD = "Correct-Horse-1"


# ─── Fixtures & helpers ─────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _fixed_code(monkeypatch):
    """Pin the generated code and clear limiter state between tests.

    The limiters are module-level singletons, so without the reset a test that
    trips a lockout silently breaks every later test sharing its key.
    """
    monkeypatch.setattr(
        auth_router.verification, "generate_code", lambda: CODE, raising=True
    )
    rate_limit.reset_all_limiters()
    yield
    rate_limit.reset_all_limiters()


@pytest.fixture()
def sent(monkeypatch):
    """Capture outgoing codes: list of (kind, email, code)."""
    out: list[tuple[str, str, str]] = []
    monkeypatch.setattr(
        auth_router.email_service, "send_verification_code_email",
        lambda to, code: out.append(("signup", to, code)), raising=True,
    )
    monkeypatch.setattr(
        auth_router.email_service, "send_password_reset_code_email",
        lambda to, code: out.append(("reset", to, code)), raising=True,
    )
    return out


def _start(client, email, password=PASSWORD, **body):
    return client.post(
        "/api/auth/email/register/start",
        json={"email": email, "password": password, **body},
    )


def _verify(client, email, code=CODE, **params):
    return client.post(
        "/api/auth/email/register/verify", json={"email": email, "code": code}, params=params
    )


def _login(client, email, password=PASSWORD, **params):
    return client.post(
        "/api/auth/email/login", json={"email": email, "password": password}, params=params
    )


def _forgot_start(client, email, **params):
    return client.post(
        "/api/auth/password/forgot/start", json={"email": email}, params=params
    )


def _forgot_complete(client, email, new_password, code=CODE):
    return client.post(
        "/api/auth/password/forgot/complete",
        json={"email": email, "code": code, "new_password": new_password},
    )


def _register(client, email, password=PASSWORD):
    """Complete a full signup, returning the auth response body."""
    assert _start(client, email, password).status_code == 200
    res = _verify(client, email)
    assert res.status_code == 200, res.text
    return res.json()


def _make_social(db, *, email, provider, **kw):
    column = {AuthProvider.GOOGLE: "google_id"}[provider]
    user = User(
        email=email, name="Existing", auth_provider=provider,
        plan=kw.pop("plan", PlanTier.FREE), is_active=kw.pop("is_active", True),
        **{column: f"{provider.value}-sub"}, **kw,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_email_user(db, *, email, password=PASSWORD, **kw):
    user = User(
        email=email, name="Email User", auth_provider=AuthProvider.EMAIL,
        password_hash=hash_password(password),
        plan=kw.pop("plan", PlanTier.FREE), is_active=kw.pop("is_active", True), **kw,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _codes(db, email=None, purpose=None):
    q = db.query(EmailVerificationCode)
    if email:
        q = q.filter(EmailVerificationCode.email == email)
    if purpose:
        q = q.filter(EmailVerificationCode.purpose == purpose.value)
    return q.all()


# ─── One account per email, across providers ────────────────────────────────

@pytest.mark.parametrize("provider", [AuthProvider.GOOGLE])
def test_register_rejects_socially_owned_email_before_issuing_any_code(
    client, db_session, sent, provider
):
    """The core guarantee: 409 lands with nothing issued and nothing sent."""
    _make_social(db_session, email="taken@test.local", provider=provider)

    res = _start(client, "taken@test.local")

    assert res.status_code == 409
    detail = res.json()["detail"]
    assert detail["code"] == "wrong_auth_provider"
    assert detail["provider"] == provider.value
    assert sent == []
    assert _codes(db_session, "taken@test.local") == []


def test_register_start_does_not_hash_into_users_table(client, db_session, sent):
    """No user row exists between start and verify — Decision B's invariant."""
    assert _start(client, "pending@test.local").status_code == 200

    assert db_session.query(User).filter_by(email="pending@test.local").first() is None
    codes = _codes(db_session, "pending@test.local", VerificationPurpose.SIGNUP)
    assert len(codes) == 1
    # The password is present but hashed, and the code is not stored in the clear.
    assert codes[0].pending_password_hash.startswith("$argon2")
    assert codes[0].code_hash != CODE
    assert sent == [("signup", "pending@test.local", CODE)]


def test_social_login_rejects_email_owned_address(client, db_session, monkeypatch):
    """The rule holds in the other direction: social login onto an email account."""
    _make_email_user(db_session, email="mine@test.local")

    monkeypatch.setattr(
        auth_router.id_token, "verify_oauth2_token",
        lambda *a, **k: {"sub": "g1", "email": "mine@test.local", "name": "G"},
        raising=True,
    )

    res = client.post("/api/auth/google", json={"credential": "tok"})

    assert res.status_code == 409
    detail = res.json()["detail"]
    assert detail["provider"] == "email"
    assert detail["provider_label"] == "Email"


def test_email_matching_is_case_insensitive(client, db_session, sent):
    _register(client, "mixed@test.local")

    assert _start(client, "MIXED@Test.Local").status_code == 409
    assert _login(client, "MIXED@Test.Local").status_code == 200


def test_forgot_rejects_socially_owned_email(client, db_session, sent):
    _make_social(db_session, email="g@test.local", provider=AuthProvider.GOOGLE)

    res = _forgot_start(client, "g@test.local")

    assert res.status_code == 409
    assert res.json()["detail"]["provider"] == "google"
    assert sent == []
    assert _codes(db_session, "g@test.local") == []


# ─── Registration ───────────────────────────────────────────────────────────

def test_register_happy_path_creates_verified_account(client, db_session, sent):
    data = _register(client, "new@test.local")

    assert data["access_token"]
    assert data["user"]["auth_provider"] == "email"
    user = db_session.query(User).filter_by(email="new@test.local").one()
    assert user.is_active is True
    assert user.password_hash and user.password_hash != PASSWORD
    # The code row is spent, not left behind.
    assert _codes(db_session, "new@test.local") == []


@pytest.mark.parametrize(
    "password,expected",
    [
        ("abc1234", "password_too_short"),          # 7 chars
        ("Ab1!", "password_too_short"),             # short wins over the rest
        ("lowercase-only-1", "password_needs_uppercase"),
        ("NoSymbolsHere123", "password_needs_special"),
    ],
)
def test_register_rejects_policy_violations_without_issuing_a_code(
    client, db_session, sent, password, expected
):
    """Every policy failure is rejected before a code is issued or mail is sent."""
    res = _start(client, "policy@test.local", password=password)

    assert res.status_code == 422
    assert res.json()["detail"] == expected
    assert sent == []
    assert _codes(db_session, "policy@test.local") == []


def test_login_never_applies_the_password_policy(client, db_session):
    """A stored password that breaks the CURRENT rules must still sign in.

    Policy governs passwords being set, never ones being used. If sign-in
    re-validated, adding a rule would lock every existing user out of their own
    account — so this guards the one thing a future "tighten the policy" change
    is most likely to break.
    """
    _make_email_user(db_session, email="legacy@test.local", password="allsmall-nosymbol")

    assert _login(client, "legacy@test.local", password="allsmall-nosymbol").status_code == 200


def test_forgot_complete_enforces_the_full_policy(client, db_session, sent):
    """The reset path sets a password, so it gets the same rules as signup."""
    _make_email_user(db_session, email="weak@test.local")
    assert _forgot_start(client, "weak@test.local").status_code == 200

    res = _forgot_complete(client, "weak@test.local", "nocapitals-or-symbols1")

    assert res.status_code == 422
    assert res.json()["detail"] == "password_needs_uppercase"
    # The old password still works — a rejected reset changes nothing.
    assert _login(client, "weak@test.local").status_code == 200


def test_register_start_on_existing_email_account_conflicts(client, db_session, sent):
    _register(client, "dupe@test.local")
    sent.clear()

    res = _start(client, "dupe@test.local")

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "email_already_registered"
    assert sent == []


@pytest.mark.parametrize(
    "password",
    ["short", "nouppercase-1!", "NoSpecialChar1"],
    ids=["too_short", "no_uppercase", "no_special"],
)
def test_existing_account_outranks_the_password_policy(
    client, db_session, sent, password
):
    """An address that already has an account answers 409, whatever was typed.

    Checking the policy first would tell someone to fix a password they are never
    going to use, on a form they should not be on — and hides the one fact that
    actually helps them ("you already have an account, sign in"). The client
    relies on this: it stops gating submit on the policy so a wrong password on
    the signup form still surfaces the existing account instead of doing nothing.

    The one case NOT covered here is an over-length password: _PasswordField caps
    it at 512 chars, so pydantic rejects the body with a 422 before the handler
    runs. That bound is deliberately left in front — it costs no DB work and no
    real user types 512 characters into a login box.
    """
    _make_email_user(db_session, email="exists@test.local")

    res = _start(client, "exists@test.local", password=password)

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "email_already_registered"
    assert sent == []
    assert _codes(db_session, "exists@test.local") == []


def test_policy_still_applies_once_the_address_is_free(client, db_session, sent):
    """The reordering must not weaken the policy for real signups."""
    res = _start(client, "brandnew@test.local", password="short")

    assert res.status_code == 422
    assert res.json()["detail"] == "password_too_short"
    assert sent == []


def test_register_start_on_deleted_account_says_already_registered(
    client, db_session, sent
):
    """Signup must NEVER surface reactivation.

    A soft-deleted account answers exactly as a live one: reactivation is a
    decision about an account you are signing in to, so a form headed "Create
    your account" must not offer it. The login and password-reset flows own that
    prompt, after the password (or a mailbox code) is proven.
    """
    user = _make_email_user(db_session, email="deleted@test.local", is_active=False)

    res = _start(client, "deleted@test.local")

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "email_already_registered"
    assert "X-Account-Deleted" not in res.headers
    assert sent == []
    assert _codes(db_session, "deleted@test.local") == []
    # And signup left the account exactly as deleted as it found it.
    db_session.refresh(user)
    assert user.is_active is False


def test_register_start_cannot_tell_deleted_from_live(client, db_session, sent):
    """The two responses are byte-identical, so this endpoint is not an oracle
    for whether a known address is deleted or active."""
    _make_email_user(db_session, email="live@test.local")
    _make_email_user(db_session, email="dead@test.local", is_active=False)

    live = _start(client, "live@test.local")
    dead = _start(client, "dead@test.local")

    assert live.status_code == dead.status_code == 409
    assert live.json() == dead.json()


def test_wrong_code_burns_after_five_attempts(client, db_session, sent):
    assert _start(client, "brute@test.local").status_code == 200

    for expected_remaining in (4, 3, 2, 1):
        res = _verify(client, "brute@test.local", code="000000")
        assert res.status_code == 400
        assert res.json()["detail"]["attempts_remaining"] == expected_remaining

    res = _verify(client, "brute@test.local", code="000000")
    assert res.status_code == 429
    assert res.json()["detail"] == "code_attempts_exceeded"
    # Burned: even the correct code is now worthless, and no account was made.
    assert _codes(db_session, "brute@test.local") == []
    assert _verify(client, "brute@test.local").status_code == 400
    assert db_session.query(User).filter_by(email="brute@test.local").first() is None


def test_expired_code_is_rejected(client, db_session, sent):
    assert _start(client, "slow@test.local").status_code == 200
    row = _codes(db_session, "slow@test.local")[0]
    row.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db_session.commit()

    res = _verify(client, "slow@test.local")

    assert res.status_code == 400
    assert res.json()["detail"] == "code_expired"
    assert db_session.query(User).filter_by(email="slow@test.local").first() is None


def test_resend_respects_cooldown_then_invalidates_the_old_code(client, db_session, sent):
    assert _start(client, "resend@test.local").status_code == 200
    old_hash = _codes(db_session, "resend@test.local")[0].code_hash

    res = client.post("/api/auth/email/register/resend", json={"email": "resend@test.local"})
    assert res.status_code == 429
    assert res.json()["detail"] == "resend_too_soon"
    assert int(res.headers["Retry-After"]) > 0

    row = _codes(db_session, "resend@test.local")[0]
    row.last_sent_at = datetime.utcnow() - timedelta(seconds=120)
    db_session.commit()

    # A different code this time, so we can prove the old one stopped working.
    import app.services.email_verification as verification_mod
    original = verification_mod.generate_code
    verification_mod.generate_code = lambda: "654321"
    try:
        res = client.post(
            "/api/auth/email/register/resend", json={"email": "resend@test.local"}
        )
    finally:
        verification_mod.generate_code = original

    assert res.status_code == 200
    rows = _codes(db_session, "resend@test.local")
    assert len(rows) == 1 and rows[0].code_hash != old_hash
    # The password captured at start survives the resend — never re-asked for.
    assert rows[0].pending_password_hash.startswith("$argon2")


def test_resend_without_pending_registration(client, db_session, sent):
    res = client.post("/api/auth/email/register/resend", json={"email": "nobody@test.local"})

    assert res.status_code == 400
    assert res.json()["detail"] == "no_pending_registration"
    assert sent == []


def test_social_signup_between_start_and_verify_loses(client, db_session, sent):
    """A Google account created in the window wins; verify 409s rather than 500s."""
    assert _start(client, "race@test.local").status_code == 200
    _make_social(db_session, email="race@test.local", provider=AuthProvider.GOOGLE)

    res = _verify(client, "race@test.local")

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "wrong_auth_provider"


def test_ref_code_grants_referral_bonus_on_verify(client, db_session, sent):
    from app.models.referral import Referral, REFERRAL_BONUS_VIDEOS

    referrer = _make_email_user(db_session, email="referrer@test.local")
    db_session.add(Referral(code="FRIEND", referrer_id=referrer.id, is_active=True))
    db_session.commit()

    assert _start(client, "invited@test.local").status_code == 200
    res = _verify(client, "invited@test.local", ref_code="FRIEND")

    assert res.status_code == 200
    invited = db_session.query(User).filter_by(email="invited@test.local").one()
    assert invited.referral_video_bonus == REFERRAL_BONUS_VIDEOS


# ─── Login ──────────────────────────────────────────────────────────────────

def test_login_succeeds_with_correct_password(client, db_session):
    _make_email_user(db_session, email="who@test.local")

    res = _login(client, "who@test.local")

    assert res.status_code == 200
    assert res.json()["user"]["auth_provider"] == "email"


def test_wrong_password_and_unknown_email_are_indistinguishable(client, db_session):
    _make_email_user(db_session, email="known@test.local")

    wrong = _login(client, "known@test.local", password="not-the-password")
    unknown = _login(client, "nobody@test.local")

    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "invalid_credentials"}


def test_social_account_password_login_409s_before_touching_the_hash(client, db_session):
    """A Google row has password_hash=None; it must 409, never 401."""
    _make_social(db_session, email="g2@test.local", provider=AuthProvider.GOOGLE)

    res = _login(client, "g2@test.local")

    assert res.status_code == 409
    assert res.json()["detail"]["provider"] == "google"


def test_soft_deleted_account_requires_confirmation_then_reactivates(client, db_session):
    _make_email_user(db_session, email="gone@test.local", is_active=False, plan=PlanTier.PRO)

    res = _login(client, "gone@test.local")
    assert res.status_code == 403
    assert res.json()["detail"] == "account_deleted"

    res = _login(client, "gone@test.local", reactivate=True)
    assert res.status_code == 200
    user = db_session.query(User).filter_by(email="gone@test.local").one()
    db_session.refresh(user)
    assert user.is_active is True
    assert user.plan is PlanTier.FREE


def test_wrong_password_cannot_reactivate_a_deleted_account(client, db_session):
    """The ordering trap: reactivation must never precede the password check."""
    _make_email_user(db_session, email="ghost@test.local", is_active=False)

    res = _login(client, "ghost@test.local", password="wrong-password", reactivate=True)

    assert res.status_code == 401
    user = db_session.query(User).filter_by(email="ghost@test.local").one()
    db_session.refresh(user)
    assert user.is_active is False


def test_login_locks_out_after_repeated_failures(client, db_session):
    _make_email_user(db_session, email="target@test.local")

    for _ in range(5):
        assert _login(client, "target@test.local", password="nope").status_code == 401

    res = _login(client, "target@test.local", password="nope")
    assert res.status_code == 429
    assert res.json()["detail"] == "too_many_attempts"
    assert int(res.headers["Retry-After"]) > 0
    # Even the correct password is refused while locked out.
    assert _login(client, "target@test.local").status_code == 429


def test_wrong_provider_does_not_count_as_a_failed_attempt(client, db_session):
    """A 409 is a correct answer, so asking repeatedly must not lock anyone out."""
    _make_social(db_session, email="g3@test.local", provider=AuthProvider.GOOGLE)

    for _ in range(8):
        assert _login(client, "g3@test.local").status_code == 409

    assert _login(client, "g3@test.local").status_code == 409


# ─── Forgot password ────────────────────────────────────────────────────────

def test_forgot_start_is_silent_for_unknown_email(client, db_session, sent):
    res = _forgot_start(client, "stranger@test.local")

    assert res.status_code == 200
    assert res.json()["status"] == "code_sent"
    assert sent == []
    assert _codes(db_session, "stranger@test.local") == []


def test_forgot_start_on_deleted_account_requires_confirmation(client, db_session, sent):
    """Without ?reactivate=true it stays deleted and no code goes out."""
    _make_email_user(db_session, email="rip@test.local", is_active=False)

    res = _forgot_start(client, "rip@test.local")

    assert res.status_code == 403
    assert res.json()["detail"] == "account_deleted"
    assert sent == []
    assert _codes(db_session, "rip@test.local") == []
    user = db_session.query(User).filter_by(email="rip@test.local").one()
    db_session.refresh(user)
    assert user.is_active is False


def test_forgot_start_reactivates_on_confirm_without_signing_in(client, db_session, sent):
    """The whole point: a deleted account whose password is also forgotten.

    Confirming reactivation revives the account and emails a code — it must NOT
    hand back a token, or the confirmation click alone would be a way into an
    account without knowing the password or holding the mailbox.
    """
    _make_email_user(db_session, email="back@test.local", is_active=False, plan=PlanTier.PRO)

    res = _forgot_start(client, "back@test.local", reactivate=True)

    assert res.status_code == 200
    assert res.json()["status"] == "code_sent"
    assert "access_token" not in res.json()
    assert sent == [("reset", "back@test.local", CODE)]

    user = db_session.query(User).filter_by(email="back@test.local").one()
    db_session.refresh(user)
    assert user.is_active is True
    # Reactivation is always as a FREE user, exactly as on the login path.
    assert user.plan is PlanTier.FREE

    # And the reset still has to be completed to get a session.
    res = _forgot_complete(client, "back@test.local", "Brand-New-Password1")
    assert res.status_code == 200
    assert res.json()["access_token"]
    assert _login(client, "back@test.local", password="Brand-New-Password1").status_code == 200


def test_forgot_start_reactivate_flag_is_inert_for_unknown_email(client, db_session, sent):
    """?reactivate=true must not become an account-existence oracle."""
    res = _forgot_start(client, "nobody@test.local", reactivate=True)

    assert res.status_code == 200
    assert sent == []
    assert db_session.query(User).filter_by(email="nobody@test.local").first() is None


def test_forgot_start_reactivate_cannot_revive_a_social_account(client, db_session, sent):
    """The wrong-provider 409 still outranks reactivation — there is no password
    to reset on a Google account, so reviving it here would be the wrong door."""
    _make_social(
        db_session, email="gdead@test.local", provider=AuthProvider.GOOGLE, is_active=False
    )

    res = _forgot_start(client, "gdead@test.local", reactivate=True)

    assert res.status_code == 409
    assert res.json()["detail"]["provider"] == "google"
    user = db_session.query(User).filter_by(email="gdead@test.local").one()
    db_session.refresh(user)
    assert user.is_active is False


def test_forgot_password_replaces_the_credential(client, db_session, sent):
    _make_email_user(db_session, email="reset@test.local")

    assert _forgot_start(client, "reset@test.local").status_code == 200
    assert sent == [("reset", "reset@test.local", CODE)]

    res = _forgot_complete(client, "reset@test.local", "Brand-New-Password1")
    assert res.status_code == 200
    assert res.json()["access_token"]

    assert _login(client, "reset@test.local").status_code == 401
    assert _login(client, "reset@test.local", password="Brand-New-Password1").status_code == 200
    assert _codes(db_session, "reset@test.local") == []


def test_forgot_complete_rejects_short_password_and_keeps_the_old_one(
    client, db_session, sent
):
    _make_email_user(db_session, email="keep@test.local")
    assert _forgot_start(client, "keep@test.local").status_code == 200

    res = _forgot_complete(client, "keep@test.local", "short")

    assert res.status_code == 422
    assert res.json()["detail"] == "password_too_short"
    assert _login(client, "keep@test.local").status_code == 200


def test_signup_and_reset_codes_are_not_interchangeable(client, db_session, sent):
    """Codes are scoped to a purpose, so neither can be replayed as the other."""
    _make_email_user(db_session, email="scope@test.local")
    assert _forgot_start(client, "scope@test.local").status_code == 200

    # A reset code cannot complete a registration...
    assert _verify(client, "scope@test.local").status_code == 400

    # ...and a signup code cannot complete a reset.
    db_session.query(EmailVerificationCode).delete()
    db_session.add(
        EmailVerificationCode(
            email="scope@test.local",
            purpose=VerificationPurpose.SIGNUP.value,
            code_hash=auth_router.verification.hash_code(CODE),
            expires_at=datetime.utcnow() + timedelta(minutes=10),
            last_sent_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
        )
    )
    db_session.commit()

    assert _forgot_complete(client, "scope@test.local", "Another-Password1").status_code == 400


# ─── forgot/check — validate without consuming ──────────────────────────────

def test_forgot_check_accepts_valid_code_without_spending_it(client, db_session, sent):
    """The whole point: checking must not consume, or complete() has nothing left."""
    _make_email_user(db_session, email="chk@test.local")
    assert _forgot_start(client, "chk@test.local").status_code == 200

    res = client.post(
        "/api/auth/password/forgot/check",
        json={"email": "chk@test.local", "code": CODE},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "code_valid"

    # Still usable afterwards — the code was validated, not spent.
    assert _forgot_complete(client, "chk@test.local", "Brand-New-Password1").status_code == 200
    assert _login(client, "chk@test.local", password="Brand-New-Password1").status_code == 200


def test_forgot_check_rejects_wrong_code(client, db_session, sent):
    _make_email_user(db_session, email="chkbad@test.local")
    assert _forgot_start(client, "chkbad@test.local").status_code == 200

    res = client.post(
        "/api/auth/password/forgot/check",
        json={"email": "chkbad@test.local", "code": "000000"},
    )
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "code_invalid"
    # The real code still works, so a wrong guess did not destroy it.
    assert _forgot_complete(client, "chkbad@test.local", "Brand-New-Password1").status_code == 200


def test_forgot_check_is_not_a_free_brute_force_oracle(client, db_session, sent):
    """Attempts must count here too, or this endpoint bypasses the 5-try cap."""
    _make_email_user(db_session, email="chkbrute@test.local")
    assert _forgot_start(client, "chkbrute@test.local").status_code == 200

    for _ in range(4):
        assert client.post(
            "/api/auth/password/forgot/check",
            json={"email": "chkbrute@test.local", "code": "000000"},
        ).status_code == 400

    res = client.post(
        "/api/auth/password/forgot/check",
        json={"email": "chkbrute@test.local", "code": "000000"},
    )
    assert res.status_code == 429
    assert res.json()["detail"] == "code_attempts_exceeded"
    # Burned: even the correct code is gone now.
    assert _forgot_complete(client, "chkbrute@test.local", "Brand-New-Password1").status_code == 400
