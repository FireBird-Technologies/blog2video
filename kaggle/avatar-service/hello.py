"""
Phase 0.2a sanity check: proves a Kaggle kernel can run a live FastAPI server
reachable from the outside world via a Cloudflare Quick Tunnel.

No MuseTalk here on purpose — this isolates "does the tunnel trick work" from
"does MuseTalk install cleanly", which is a separate, much riskier step.

Deploy: kaggle kernels push -p <dir-with-this-as-script.py> --accelerator NvidiaTeslaT4
Then open the kernel's Logs tab on kaggle.com and copy the printed
https://xxxx.trycloudflare.com URL.
"""
import subprocess
import re
import threading
import time

import uvicorn
from fastapi import FastAPI

SHARED_SECRET = "changeme-dev-secret"

app = FastAPI()


@app.middleware("http")
async def check_secret(request, call_next):
    if request.url.path == "/ping" and request.headers.get("x-avatar-key") != SHARED_SECRET:
        from starlette.responses import JSONResponse
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    return await call_next(request)


@app.get("/ping")
def ping():
    return {"ok": True, "msg": "kaggle tunnel is alive"}


def start_tunnel():
    subprocess.check_call(
        [
            "wget", "-q",
            "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
            "-O", "/kaggle/working/cloudflared",
        ]
    )
    subprocess.check_call(["chmod", "+x", "/kaggle/working/cloudflared"])
    proc = subprocess.Popen(
        ["/kaggle/working/cloudflared", "tunnel", "--url", "http://localhost:8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    def watch():
        for line in proc.stdout:
            print(line, end="")
            m = re.search(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", line)
            if m:
                print(f"\n>>> TUNNEL URL: {m.group(0)}\n", flush=True)
                with open("/kaggle/working/tunnel_url.txt", "w") as f:
                    f.write(m.group(0))

    threading.Thread(target=watch, daemon=True).start()
    return proc


if __name__ == "__main__":
    start_tunnel()
    time.sleep(3)  # give cloudflared a moment to establish before serving
    uvicorn.run(app, host="0.0.0.0", port=8000)
