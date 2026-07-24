# Exposing a Live HTTP Endpoint from a Kaggle GPU Kernel

Kaggle's CLI (`kaggle kernels push` / `status` / `output`) is built around **batch jobs**: a script runs once, writes files to `/kaggle/working/`, finishes, and you pull the files down. There is no "deploy as an API" feature and no way to pass environment variables into a pushed kernel.

This doc covers a different pattern, confirmed working on 2026-07-21: run a script whose entire job *is* to serve HTTP requests, and tunnel it out to a real public HTTPS URL. Useful for prototyping against a model that needs a CUDA GPU (no Apple Silicon/CPU path) — e.g. driving [MuseTalk](https://github.com/TMElyralab/MuseTalk) for the avatar-video feature — without paying for hosting yet.

See also: `kaggle-skill.md` (general CLI push/poll/pull workflow), `kaggle-secrets.md` / `kaggle-token-setup.md` (private-dataset secrets pattern, still needed here for anything beyond a hardcoded dev secret).

## The core trick

A Kaggle kernel script can run a **blocking** process (e.g. `uvicorn.run(...)`) as its main/foreground execution. That's not "backgrounding a subprocess" (which Kaggle restricts) — it's just the script's entire body being a long-running call, which is allowed for the full session length (up to 12h).

Pair that with [Cloudflare Quick Tunnel](https://github.com/cloudflare/cloudflared) (`cloudflared tunnel --url http://localhost:8000`):
- No Cloudflare account needed.
- Generates a random public URL like `https://fly-examples-lindsay-triumph.trycloudflare.com` that forwards to the local port.
- The URL is only valid while the `cloudflared` process is alive — it dies with the kernel.
- No built-in auth — anything hitting the URL while it's live can reach your server. Always add your own shared-secret check.

(`pyngrok`/ngrok also works and is more commonly documented for Colab/Kaggle, but requires an ngrok account + authtoken and has free-tier connection limits. Cloudflare Quick Tunnel needs neither.)

## Minimal working example

This was pushed and verified live on 2026-07-21 — see `kaggle/avatar-service/hello.py` in this repo for the full file.

```python
import subprocess, re, threading, time
import uvicorn
from fastapi import FastAPI
from starlette.responses import JSONResponse

SHARED_SECRET = "changeme-dev-secret"
app = FastAPI()

@app.middleware("http")
async def check_secret(request, call_next):
    if request.headers.get("x-avatar-key") != SHARED_SECRET:
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)

@app.get("/ping")
def ping():
    return {"ok": True}

def start_tunnel():
    subprocess.check_call([
        "wget", "-q",
        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
        "-O", "/kaggle/working/cloudflared",
    ])
    subprocess.check_call(["chmod", "+x", "/kaggle/working/cloudflared"])
    proc = subprocess.Popen(
        ["/kaggle/working/cloudflared", "tunnel", "--url", "http://localhost:8000"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    def watch():
        for line in proc.stdout:
            print(line, end="")
            m = re.search(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", line)
            if m:
                print(f"\n>>> TUNNEL URL: {m.group(0)}\n", flush=True)
    threading.Thread(target=watch, daemon=True).start()

if __name__ == "__main__":
    start_tunnel()
    time.sleep(3)  # let cloudflared establish before serving
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

`kernel-metadata.json` for this kind of kernel is the same shape as any script kernel — the only thing that matters here is `enable_gpu: true` and `enable_internet: true`:

```json
{
  "id": "{{KAGGLE_USERNAME}}/avatar-service-hello",
  "title": "avatar-service-hello",
  "code_file": "hello.py",
  "language": "python",
  "kernel_type": "script",
  "is_private": true,
  "enable_gpu": true,
  "enable_internet": true,
  "dataset_sources": [],
  "competition_sources": [],
  "kernel_sources": []
}
```

## GPU accelerator selection — CLI version matters

`docs copy/kaggle-skill.md` documents a `--accelerator NvidiaTeslaT4` flag on `kaggle kernels push`. As of `kaggle` CLI **1.7.4.5** (pip, July 2026), that flag **no longer exists**:

```
$ kaggle kernels push -p ./dir/ --accelerator NvidiaTeslaT4
kaggle: error: unrecognized arguments: --accelerator NvidiaTeslaT4
```

`kaggle kernels push --help` on this version only accepts `-p/--path` and `-t/--timeout`. GPU type is no longer selectable via the CLI at all in this version — `enable_gpu: true` in `kernel-metadata.json` is the only lever, and Kaggle assigns whatever GPU it gives script kernels (observed: request succeeded and ran; did not separately confirm which GPU model was assigned — check the kernel's session info in the web UI if it matters for your workload).

**Lesson**: don't trust flags from older docs without checking `--help` first — the Kaggle CLI's interface has changed across versions.

## Retrieving the tunnel URL — the one step that needs a browser

`kaggle kernels output <user>/<slug> -p ./local/` returns **nothing** while the kernel is still running — confirmed empirically. That command is designed for *completed* batch jobs pulling result files, not for tailing a live server's stdout.

The only way to get the URL each time the kernel (re)starts:
1. `kaggle kernels push -p <dir>` (starts the run)
2. Poll `kaggle kernels status <user>/<slug>` until it says `RUNNING` (see polling snippet below)
3. Open `https://www.kaggle.com/code/<user>/<slug>/log` in a browser
4. Copy the printed line, e.g. `>>> TUNNEL URL: https://fly-examples-lindsay-triumph.trycloudflare.com`

This is a manual, once-per-restart step. There's no way to script around it with the current CLI — treat whatever backend config holds this URL (e.g. `AVATAR_SERVICE_URL`) as something you update by hand, not something auto-discovered.

### Polling status from the shell

```bash
kernel_state=""
while true; do
  new_state=$(kaggle kernels status humerar34/avatar-service-hello 2>&1 || echo "CLI_ERROR")
  [ "$new_state" != "$kernel_state" ] && echo "$(date +%H:%M:%S) $new_state"
  kernel_state="$new_state"
  case "$kernel_state" in
    *RUNNING*) echo "running - check the Logs tab for the URL"; break ;;
    *ERROR*|*CANCEL*) echo "failed/cancelled"; break ;;
  esac
  sleep 20
done
```

**Zsh pitfall**: do not name the loop variable `status` — it's a read-only special variable in zsh (`read-only variable: status`), and assigning to it silently kills the script. Use `kernel_state` or similar instead.

`QUEUED` for a while before `RUNNING` is normal — Kaggle GPU slots are shared and first-come-first-served (consistent with what `kaggle-skill.md` already notes for batch kernels).

## Verifying the endpoint

Once you have the URL:

```bash
curl -H "X-Avatar-Key: changeme-dev-secret" https://<random>.trycloudflare.com/ping
# {"ok":true,"msg":"kaggle tunnel is alive"}

curl https://<random>.trycloudflare.com/ping                       # no key -> 401
curl -H "X-Avatar-Key: wrong" https://<random>.trycloudflare.com/ping  # wrong key -> 401
```

Confirmed working end-to-end on 2026-07-21: request from an external machine (not Kaggle), through the tunnel, into the FastAPI middleware, correctly enforcing the shared secret.

## Stopping the kernel

There is no `kaggle kernels cancel` command (also noted in `kaggle-skill.md`). To stop a running live-server kernel and free up GPU quota, you must go to the kernel's page in the Kaggle web UI and click **Stop**. Re-pushing (a new version) also supersedes/drops a queued run, but does not stop an already-running one from the CLI.

## Constraints to keep in mind

- **Session cap**: 12h max runtime. **Quota**: ~30 GPU-hours/week (T4), shared across all notebook + CLI usage.
- **URL is ephemeral**: changes on every kernel restart (new tunnel = new random subdomain).
- **No real auth on the tunnel itself**: only your app-level shared-secret header protects it. Don't put real secrets in a script that gets committed — see `kaggle-secrets.md` for the private-dataset pattern.
- **This is a prototyping pattern, not production hosting.** Once a model (e.g. MuseTalk) is validated this way, move to real always-on infrastructure (e.g. RunPod Serverless) for a stable URL and real uptime.
