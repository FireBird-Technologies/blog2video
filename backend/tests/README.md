# Backend Test Suite — How It Works (Tier A)

This document explains the backend test suite end to end: the architecture, where
things like the auth token and the test database come from, what every test
checks, and the discipline used to write them. Read this before adding tests.

---

## 1. What this suite is

**Tier A** is the *smoke / breadth* layer — a fast regression floor. For every
endpoint it proves three things:

1. **Happy path** — a valid request returns the expected status code and response shape.
2. **Auth gate** — a request with no / invalid token is rejected (401).
3. **Ownership** — one user cannot reach another user's resource (404, no tenant leak).

It does **not** verify deep business logic (credit math, Stripe webhook
idempotency, proration, render correctness). That is a separate "depth tier".
A green Tier A means *"nothing 500s and nothing is wide open"* — not *"the billing
math is correct."*

---

## 2. How to run it

```bash
cd backend
# Local isolated venv was created at backend/.venv-test (git-ignored).
.venv-test/bin/python -m pytest            # whole suite
.venv-test/bin/python -m pytest -k ownership   # just the tenant-isolation sweep
.venv-test/bin/python -m pytest tests/test_group1_public_endpoints.py  # one group
```

Default options (from `pyproject.toml`) print every test name as it runs
(`-v`), summarise anything non-passing at the end (`-ra`), and keep tracebacks
short. The output reads as a checklist of behaviours, e.g.:

```
tests/test_group3_ownership_isolation.py::test_cross_user__returns_404[GET /api/projects/{id}] PASSED
tests/test_group2_authenticated_reads.py::test_get_auth_me__valid_token__returns_current_user PASSED
```

CI runs the same suite on every PR into `develop` (`.github/workflows/backend-tests.yml`).

---

## 3. Architecture — the two conftest layers

There are two `conftest.py` files. pytest loads both automatically.

### `backend/conftest.py` (root) — environment + database

This file runs **before anything from `app` is imported**, which is critical:

- **Fail-closed database.** It sets `DATABASE_URL` to a throwaway temp-file SQLite
  database *before* `app.config` / `app.database` load. So even though the real
  `.env` points `DATABASE_URL` at the shared **Neon develop** Postgres, the test
  process overrides it and can never read from or write to a real database. If
  the override ever failed, the tests would fall onto local SQLite, never Neon.
- **Blanks external credentials** (Stripe, OpenAI, ElevenLabs, R2, …) so a missed
  mock can't authenticate to a live service.
- **Deterministic JWT secret** (`JWT_SECRET`) so tokens are reproducible.
- **`db_session` fixture** — gives each test a SQLAlchemy session wrapped in a
  transaction that is **rolled back** when the test ends. Nothing a test writes
  survives into the next test. (See §4 for the SQLite gotcha this had to solve.)
- **`client` fixture** — a FastAPI `TestClient` whose `get_db` dependency is
  overridden to use the test session. It is created *without* the context-manager
  form on purpose, so the app's `lifespan` (DB init + background cleanup loops +
  the email scheduler) never starts during tests.

### `backend/tests/conftest.py` — users + the network kill-switch

- **`kill_network` (autouse, every test)** — installs a socket guard that raises
  `RealNetworkBlockedError` on *any* real outbound connection. The `TestClient`
  talks to the app in-process (no socket) and SQLite is a file, so a tripped guard
  means an un-mocked external call — caught loudly instead of silently hitting a
  live service. It also stubs the transactional email service so the public
  contact form returns its real status without sending mail.
  **It stubs I/O boundaries only** — never auth, ownership, or status codes — so it
  can't manufacture a passing test (a "false green").
- **User fixtures** — `free_user`, `paid_user`, `other_user` are real rows in the
  test DB (see §5).
- **`auth` fixture** — turns a user into an `Authorization` header (see §5).

---

## 4. Where the test database comes from (and the SQLite gotcha)

- The DB is a **fresh temp-file SQLite database**, created once per test session.
  The full schema is built from the SQLAlchemy models (`Base.metadata.create_all`)
  and the subscription plans are seeded once (reusing the app's own `seed_plans`),
  because billing/quota code reads them.
- **Per-test isolation** uses the standard "wrap each test in a transaction and
  roll back" pattern. This initially *didn't work*: Python's `sqlite3` driver does
  not emit `BEGIN` the way SQLAlchemy's SAVEPOINT machinery expects, so committed
  rows leaked into the next test (`UNIQUE constraint failed: users.email`). The
  fix (in the root conftest) is the documented pysqlite workaround: disable the
  driver's implicit transaction handling and emit `BEGIN` manually via two engine
  event listeners. With that, `trans.rollback()` correctly discards everything a
  test (or the route under test) committed.

So: every test starts from the same clean, seeded database, and leaves no trace.

---

## 5. Where the auth token comes from

The app authenticates with a **JWT Bearer token**. Tests mint real ones — there
is no mocking of the auth path:

1. `free_user` / `paid_user` / `other_user` fixtures insert real `User` rows into
   the test DB (distinct emails, `is_active=True`, different plans).
2. The `auth` fixture calls the app's own `create_access_token(user.id)`
   (`app/auth.py`) — the *exact same* function used in production login — and
   returns `{"Authorization": "Bearer <jwt>"}`.
3. A request sent with that header flows through the real `get_current_user`
   dependency: it decodes the JWT, looks the user up in the test DB, and checks
   `is_active`. Nothing is stubbed.

That's why the auth and ownership tests are meaningful: they exercise the genuine
token → decode → user-lookup → ownership-filter path. A test for `other_user`
fails to reach `free_user`'s project because the real ownership query filters by
`user_id`, not because anything is faked.

Two auth facts the tests pin (both verified at runtime, not assumed):
- **Missing** Authorization header → **401** "Not authenticated" (the app remaps
  HTTPBearer's default 403 to 401).
- **Invalid / garbage** token → **401** "Invalid or expired token".

### Two different tokens — don't confuse them

There are **two** tokens in play, and they're tested differently:

| Token | What it is | How tests handle it |
|---|---|---|
| **Our app's JWT** | issued by `create_access_token` after login; sent on every authed request | **minted for real** by the `auth` fixture (above) — never mocked |
| **Google ID token** | issued by Google; sent *once* to `POST /api/auth/google` to log in | **the verification is mocked** — we do NOT create a real Google token |

### How the Google-login test works (`POST /api/auth/google`)

We **cannot** create a real Google ID token — that requires Google's private
signing keys. So we don't try. The route does this:

```python
idinfo = id_token.verify_oauth2_token(body.credential, google_requests.Request(), CLIENT_ID)
# -> contacts Google, returns the verified identity: {"sub", "email", "name", "picture"}
```

In the test we **mock `id_token.verify_oauth2_token`** so it skips the call to
Google and returns a *fake identity dict* — exactly what Google would have returned
**after** verifying a real token:

```python
monkeypatch.setattr(
    auth_router.id_token, "verify_oauth2_token",
    lambda *a, **k: {"sub": "google-new-123", "email": "newuser@test.local",
                     "name": "New User", "picture": None},
)
resp = client.post("/api/auth/google", json={"credential": "fake-google-jwt"})
```

So we send **any dummy string** as the `credential` — the mock intercepts the
verification and hands back our fake identity. **Everything after that runs for
real**: the route creates the `User` row in the test DB, issues a genuine app JWT
via `create_access_token`, and returns it. The test then asserts the user was
actually persisted and a token came back.

The **invalid-token** test does the opposite: the mock is set to *raise*
`ValueError` — which is what the real `verify_oauth2_token` does on a bad/forged
token — and the test asserts the route returns **401**. The **duplicate** test
calls the endpoint twice with the same fake `sub`/email and asserts only **one**
user row exists.

In short: we mock *only the boundary to Google* (the one thing we can't reproduce),
and let the app's own create-user / issue-JWT logic run unmocked — so the test
proves the login flow, not the mock.

---

## 6. The test files — what each checks, and what pass / fail means

Filenames are numbered by group so the run output (and this list) reads in order.
For each file: what it covers, what a **PASS** proves, and what a **FAIL** is
actually telling you.

### `test_group1_public_endpoints.py` — Group 1: public routes (no auth)
Genuinely public routes (verified by reading each handler — several that *looked*
public are actually auth-gated and were moved to Group 2):
`GET /api/billing/plans`, `POST /api/contact/enterprise`,
`GET /api/custom-templates/public/featured`, `GET /api/embed/project/{token}`,
`GET /unsubscribe`, `GET /mcp/.well-known/oauth-authorization-server`,
`GET /api/health`, `GET /api/template-studio/auth/status`.
- **PASS:** the route returns its real status + shape, and bad input (unknown id /
  token) returns 404 / empty. (We don't test "missing required field → 422" — that
  is FastAPI/Pydantic's own validation, not our logic.)
- **FAIL:** a 500 means the route crashed (bad query / serializer / missing
  migration); a 401 here means a public route accidentally got an auth dependency;
  200 on bad input means a missing not-found guard.

### `test_group2_authenticated_reads.py` — Group 2: authenticated reads
`GET /api/auth/me`, `/api/billing/status|subscription|invoices`, `/api/projects`
(+ a two-user **isolation** test), `/template-availability`, `/api/voices/saved|custom`,
`/api/affiliate/link|stats`, `/api/background-music/tracks`, `/api/crafted-templates`,
`/cache-stats`. Plus a parametrized **no-token → 401** sweep.
- **PASS:** valid token → 200 + shape; no token → 401; a list returns only the
  caller's rows.
- **FAIL:** 200 without a token = an **open endpoint** (missing auth dependency);
  a list containing another user's rows = a **tenant leak** (query forgot
  `WHERE user_id = me`); 401 with a valid token = token decode/lookup broke.

### `test_group3_ownership_isolation.py` — Group 3: tenant isolation (security sweep)
Cross-user sweep over project-scoped routes (`GET/DELETE /api/projects/{id}`,
`/layouts`, `GET /api/pipeline/status|render-status|download-url`); owner-succeeds
direction; invalid-token → 401 sweep; the `chat/history` known-bug guard (xfail, §8).
- **PASS:** `other_user` → **404** on every route; the owner → 200; a garbage token → 401.
- **FAIL:** `other_user` getting **200** is the highest-severity failure — a user can
  read/delete another user's data. Owner getting 404 = ownership check too strict.

### `test_group4_create_endpoints.py` — Group 4: create / mutation endpoints
`POST /api/auth/google` (Google verify mocked — see §5), `/api/projects`,
`/api/voices/saved`, `/api/affiliate/survey` (2nd → 400), `/api/affiliate/invite`.
- **PASS:** 200/201 **and the row is actually in the DB**; no token → 401.
- **FAIL:** 200 but nothing persisted = a **silent write failure** (uncommitted txn /
  swallowed exception); 500 on `/auth/google` = login is down.

### `test_group5_paywall_quota_gates.py` — Group 5: paywall / quota / rate-limit
`POST /api/voice/preview` (FREE → 403, PRO → 200, rapid 2nd → 429, synthesis mocked);
`POST /api/projects` at the video limit → 403; `GET /api/crafted-templates/{id}`
while disabled → 404.
- **PASS:** ineligible caller is blocked (403/429/404), eligible caller passes.
- **FAIL:** an ineligible caller getting 200 = the **paywall / rate-limit is
  bypassable** (free use of paid features, or credit-burn abuse).

### `test_group6_background_dispatch.py` — Group 6: background-task dispatch
`BackgroundTasks.add_task` is **spied** (recorded, not run) so the heavy work never
executes. `POST /api/projects/{id}/change-voice` and `/delete-voiceover`.
- **PASS:** 200 + a job row persisted + the correct worker registered with the right
  `(project_id, job_id)`; plus ownership (404) and no-scenes (400) guards.
- **FAIL:** no job handle / 500 = the async flow never starts; wrong `add_task` args =
  the worker would act on the wrong project/job. (Job *completion* is depth tier.)

### `test_group7_webhooks_and_admin.py` — Group 7: webhooks / plan-change / studio / MCP
`POST /api/billing/webhook`, `/api/billing/change-plan`,
`POST /api/template-studio/auth/verify`, `GET /mcp/ui/template_gallery`.
- **PASS:** bad webhook signature → 400; valid event → 200 and dispatches to the
  correct `_handle_*`; unknown event → 200; change-plan is auth-gated + validates input.
- **FAIL:** a bad signature returning 200 = **anyone can POST forged payment events**
  (the most dangerous failure here); a valid event hitting the wrong/no handler = real
  Stripe events get dropped. (Idempotency / grant amounts / proration = depth tier.)

### `test_harness_killswitch.py` — self-verification of the harness
- **PASS:** a real socket connect is blocked, AND with the kill-switch active an
  anonymous request still 401s and cross-user still 404s.
- **FAIL:** a real connection succeeding = a missing mock (flaky + possibly real
  charges/emails from CI); auth/ownership passing here = the mocking is too broad and
  is manufacturing false greens.

---

## 6b. Depth tier — what the endpoints *compute* (not just that they respond)

Tier A (above) is breadth. These `test_depth_*` files are depth: the money-math,
the deterministic pipeline glue, and realistic LLM data via record/replay.

### `test_depth_credit_math.py` — credit / billing money-math (the centerpiece)
- `_recalculate_video_limit_bonus` absorption (the docstring Examples A/B/C + edges),
  `_count_active_per_video_credits` (sum/expiry/null), `User.video_limit` /
  `can_create_video` / `sync_video_limit_bonus`, and **deduct/refund symmetry**
  (`_refund_video_credit`: one refund per failure, never below zero).
- **PASS:** the credit arithmetic matches the documented contract.
- **FAIL:** a user is over-charged or handed free videos — a money bug.

### `test_depth_webhooks.py` — all Stripe webhook handlers
- **checkout** (`_handle_checkout_completed`): grants per-video credits / upgrades
  plan; the **idempotency** test (duplicate delivery → one grant) is `xfail`
  (§8.2 — real double-grant bug).
- **subscription lifecycle**: `deleted` → downgrade + cancel; `updated` → plan/status
  sync (active-pro, canceled).
- **invoices**: `paid` → reset usage + referral; `payment_failed` → past_due;
  `action_required` → requires_action.
- **dispute** (`charge.dispute.created`): SHOULD downgrade — `xfail` (§8.3 — real
  "chargeback keeps paid plan" bug).
- **PASS:** each event drives the right plan / status / credit change. **FAIL:**
  wrong grant or missed downgrade = money / abuse bug.

### `test_depth_pipeline_glue.py` — deterministic pipeline glue
- Pure functions: per-video pricing tiers, the CTA encoder, social-signal
  detection, generated-code validation, `_sanitize_script_layouts` /
  `_normalize_layout_id`, language normalisation.
- **PASS:** messy input is cleaned correctly. **FAIL:** e.g. a hallucinated layout
  reaches the renderer, or pricing tiers are wrong.

### `test_depth_pipeline_postprocess.py` — post-processing on (replayed) LLM output
- Real `_sanitize_script_layouts` against synthetic + (when captured) **recorded**
  LLM scenes; proves the replay fixture works. Recorded cases **skip** until you run
  `tests/recordings/capture_llm_fixtures.py` with real API keys.
- **PASS:** every scene binds to a template-valid layout. **FAIL:** a layout the
  template can't render slips through.

### `test_depth_pipeline_flow.py` — failure / refund integration
- `remove_failed_generation_project`: a failed generation soft-deletes the project
  AND refunds exactly one credit (never below zero); the no-refund flag is honoured.
- **PASS:** failures refund correctly. **FAIL:** failed generations either burn a
  user's credit or hand back credits they should keep.

### `tests/recordings/` — LLM record/replay
`capture_llm_fixtures.py` (a dev tool, not a test) captures real
`ScriptGenerator.generate()` output to JSON once, with real keys; CI replays those
files deterministically. No live model is ever called in the suite.

---

## 7. How the tests were written (the discipline)

Every test follows the same rules, because a *wrong* test is worse than no test —
a false green hides the bug it should catch.

1. **Read the route first, never guess.** Each assertion (status code, field names,
   error code) is copied from the actual handler. This caught real mistakes in the
   original plan: `background-music`, `crafted-templates`, and `free-download` are
   auth-gated (not public); `template-studio/auth/status` *is* public; missing-token
   is 401 (not 403).
2. **Red-green proof.** A test isn't trusted until it has been shown to **fail**
   when the thing it guards is broken. We did this by temporarily mutating the app:
   - dropped the `user_id` filter in `_get_user_project` → ownership sweep went RED
   - set `HTTPBearer(auto_error=False)` → no-token sweep went RED
   - made `billing/plans` return `[]` → plans tests went RED
   - made the webhook accept a bad signature → webhook test went RED
   - disabled the `can_create_video` quota gate → at-limit test went RED
   All mutations were reverted; the app source is unchanged.
3. **No vacuous assertions** — every assertion pins a specific, code-derived value.
4. **Determinism** — the suite passes identically across repeated and re-ordered
   runs (no inter-test state leakage).

---

## 8. Known findings surfaced by the suite

Both are encoded as `xfail(strict=True)` — the suite stays green while the bug
exists (documented, not hidden), and the moment it's fixed the test xPASSes and
strict mode turns that into a failure, forcing the xfail to be removed and the fix
locked in.

**8.1 — Tenant leak: chat history.**
`GET /api/projects/{project_id}/chat/history` (`app/routers/chat.py`) requires auth
but **does not check the project belongs to the caller** — it filters `ChatMessage`
by `project_id` only. Any logged-in user can read any project's chat history by
guessing the id. Verified directly: a second user receives `200` and the victim's
message content. Test: `test_cross_user_chat_history__should_return_404`.
**Fix:** call `_get_user_project(project_id, user.id, db)` before querying messages.

**8.2 — Money bug: webhook double-grant.**
`_handle_checkout_completed` (`app/routers/billing.py`) is **not idempotent** — it
does `user.video_limit_bonus += qty` with no guard against re-processing. Stripe
delivers webhooks more than once, so a duplicate `checkout.session.completed`
grants the credits **twice** (verified: 2 deliveries → bonus 4, two Subscription
rows). Test: `test_checkout_completed__duplicate_delivery__grants_once`.
**Fix:** before granting, check whether `stripe_checkout_session_id` (or the Stripe
event id) was already processed; skip if so.

**8.3 — Abuse risk: chargeback doesn't downgrade.**
`_handle_dispute_created` (`app/routers/billing.py`) looks up the free plan with
`filter_by(name="free")`, but the seeded plan name is `"Free"` — so the query
returns `None` and the whole downgrade block is skipped. A user who files a
chargeback **keeps their paid plan**. (The skipped block also assigns to
`User.video_limit`, which is a read-only `@property` and would raise.) Test:
`test_dispute_created__downgrades_user_to_free`.
**Fix:** look up by `slug="free"` (and set the plan, not the read-only property).

---

## 9. Test naming convention

`test_<method>_<route>__<condition>__<expected>` — e.g.
`test_get_project_by_id__other_users_token__returns_404`. The name alone tells you
the route, the scenario, and the expected outcome. Parametrized sweeps carry the
real route in their case id so the run output is self-describing.
