# Blog2Video Chrome Extension

Turn the page you're on into a video without leaving the browser: connect
your Blog2Video account, auto-extract the article text, pick a template and
voice, and generate.

## Develop

```sh
npm install
npm run build      # one-shot build into dist/
npm run dev         # rebuilds on file change
```

Load `dist/` as an unpacked extension at `chrome://extensions` (enable
Developer Mode first). Reload the extension after each build.

`src/config.ts` points at `http://localhost:8000` (backend) and
`http://localhost:5173` (frontend) for local dev — swap both for the
production origins before shipping a build, and update
`public/manifest.json`'s `host_permissions` to match.

## How it works

Auth mirrors the WordPress plugin's device-code handshake
(`backend/app/routers/extension_integration.py`): the popup starts a pending
connection, opens `/extension-connect?code=...` on the web app for the
already-logged-in user to approve, and polls for an install-scoped
`b2v_ext_...` bearer token. That token is stored in `chrome.storage.local`
and sent on every subsequent API call.

Once connected, the popup reads the active tab's URL, injects a content
script to extract the article text, lets the user pick a template/voice from
`GET /catalog`, and calls `POST /projects` → polls `/status` → `POST /render`
→ polls `/render-status` → shows the resulting video inline, with links to
preview it (embed token) or edit it on the site (`/project/:id`).
