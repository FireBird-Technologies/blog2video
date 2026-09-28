# Beehiiv API mock

A local stand-in for the Beehiiv API v2, for when `api.beehiiv.com` can't be reached.
It serves the fixtures in `tests/fixtures/beehiiv/` and keeps posts in memory.

## Run it

```bash
cd backend
uvicorn dev.beehiiv_mock:app --port 4010
```

Point the backend at it (shell export or a local env file — **not** `backend/.env`, which points at the live DB):

```bash
export BEEHIIV_API_BASE_URL=http://127.0.0.1:4010/v2
```

Leave `BEEHIIV_API_BASE_URL` unset in production; it defaults to `https://api.beehiiv.com/v2`.

## Keys

The mock ignores real keys; the key you paste in the Connect dialog picks the behaviour.
Prefixes ignore case, and `-` works like `_` (`free-key` = `free_key`):

| Key prefix     | Behaviour                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| anything else  | success (e.g. `test_key`)                                                 |
| `bad_…`        | 401 on every call → "check the key"; the connection is marked disconnected |
| `free_…`       | reads work; creating/editing posts → 401 `SEND_API_NOT_ENTERPRISE_PLAN` → yellow plan warning, button disabled |
| `ratelimit_…`  | 429 on every call → "Too many requests. Please try again shortly." (retryable)                      |
| `outage_…`     | 503 on every call → "Beehiiv is currently unavailable. Please try again later."                |
| `slow_…`       | answers after 25 s, past the 20 s client timeout → "Beehiiv did not respond in time. Please try again." |
| `gone_…`       | connect works; the publication then 404s → "Your Beehiiv publication could not be found. Please reconnect Beehiiv." + Reconnect |
| `flaky_…`      | connect and plan check work; loading/importing posts → 500 → outage message |

Stop the mock entirely to get "Unable to connect to Beehiiv. Please try again."

The workspace has two publications, so connecting shows the publication picker.
"The Weekly Brief" has 24 posts (two pages; drafts, published, premium, archived).

## Inspect / reset

- `GET  http://127.0.0.1:4010/_mock/requests` — every call the app made (method, path, query, key, JSON body)
- `POST http://127.0.0.1:4010/_mock/reset` — back to the fixtures

## Tests

`pytest tests/test_beehiiv_contract.py` runs the real client against this same app in-process.
With access to Beehiiv: `BEEHIIV_LIVE_API_KEY=… pytest -m live` runs a read-only smoke test against the real API.

## Prism (optional)

If you can get Beehiiv's OpenAPI file (developers.beehiiv.com), a spec-generated mock works too:

```bash
npx @stoplight/prism-cli mock beehiiv-openapi.json -p 4010
```

Point `BEEHIIV_API_BASE_URL` at it — Prism serves the spec's `paths` without the server's
`/v2` prefix, so this is likely `http://127.0.0.1:4010` rather than `…/v2`. Prism serves spec examples rather than
stateful data, and error cases are forced with a `Prefer: code=403` request header.
