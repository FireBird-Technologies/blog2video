# Kaggle CLI GPU Execution

Run Python scripts on Kaggle GPUs from the local terminal without using the notebook web UI. This skill covers pushing scripts, monitoring runs, pulling results, and avoiding common pitfalls learned from real iteration.

## Core Workflow

### 1. Setup (one-time)

```bash
pip install kaggle
# Download API token from kaggle.com → Settings → "Create New Token"
# Place at ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json
```

### 2. Kernel Structure

A kernel needs two files in a directory:

**`kernel-metadata.json`:**
```json
{
  "id": "USERNAME/kernel-slug",
  "title": "kernel-slug",
  "code_file": "script.py",
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

**`script.py`:** Your Python script. All output must be written to `/kaggle/working/` — that's the only directory retrievable via CLI.

### Repo-specific metadata rule

Do not hardcode real Kaggle usernames in checked-in `kernel-metadata.json` files. Kaggle requires `id` to be `{username}/{kernel-slug}` at push time, so this repo keeps placeholders in source metadata and generates temporary push directories from the active CLI user:

```bash
python kaggle/prepare_kernel.py phase1 --hf-token-dataset auto
kaggle kernels push -p /tmp/nsa-kaggle-kernels/phase1/ --accelerator NvidiaTeslaT4
```

The helper detects the logged-in user from `KAGGLE_USERNAME`, `~/.kaggle/kaggle.json`, or `kaggle config view`, then writes generated metadata under `/tmp/nsa-kaggle-kernels/<phase>/`.

### 3. Push, Monitor, Pull

```bash
# Push and start running
kaggle kernels push -p ./kernel-dir/ --accelerator NvidiaTeslaT4

# Check status
kaggle kernels status USERNAME/kernel-slug

# Pull output when complete
kaggle kernels output USERNAME/kernel-slug -p ./local-output/
```

## GPU Selection

**CRITICAL:** The `enable_gpu` field in `kernel-metadata.json` only enables GPU — it does NOT select the GPU type. It defaults to P100 (old Pascal architecture).

To get a T4, you MUST pass the `--accelerator` flag on the CLI:
```bash
kaggle kernels push -p ./dir/ --accelerator NvidiaTeslaT4
```

Valid accelerator values: `NvidiaTeslaP100`, `NvidiaTeslaT4`, `TpuVm`.

Do NOT put `"accelerator": "nvidiaTeslaT4"` in `kernel-metadata.json` — this field is silently ignored by the API. The GPU type can only be set via the CLI flag. This is a known gap in the Kaggle API (see: https://github.com/Kaggle/kaggle-cli/issues/821).

## Secrets and Environment Variables

### The Problem

Kaggle has a "Secrets" feature (Add-ons → Secrets in the notebook editor UI), but **secrets set via the web UI do NOT propagate to CLI-pushed script kernels.** The `kaggle_secrets.UserSecretsClient` will fail silently or raise an exception when called from a CLI-pushed script.

There is **no CLI flag or API parameter to pass environment variables** during `kaggle kernels push`. This is an open feature request: https://github.com/Kaggle/kaggle-cli/issues/582

This does **not** work for the remote Kaggle runtime:

```bash
HF_TOKEN=hf_... kaggle kernels push -p ./kaggle/phase1/ --accelerator NvidiaTeslaT4
```

That only sets `HF_TOKEN` for the local `kaggle` process. The uploaded script kernel will not receive it.

### Better Solution: Private Token Dataset

Do not hardcode HF tokens into GPU scripts. Instead, create a private Kaggle dataset containing a token file and attach it to the kernel.

Recommended dataset slug: `hf-token-dataset`

Each user creates their own private dataset: `YOUR_KAGGLE_USERNAME/hf-token-dataset`

The token in the dataset should belong to an HF account that has accepted all required gated model/dataset licenses (e.g., `meta-llama/Llama-Guard-3-8B`).

File names supported by the repo wrappers:

```text
/kaggle/input/hf-token-dataset/hf_token.txt
/kaggle/input/hf-token-dataset/token.txt
/kaggle/input/nsa-hf-token/hf_token.txt
/kaggle/input/nsa-hf-token/token.txt
```

Create/update the private dataset from a local temp directory:

```bash
mkdir -p /tmp/hf-token-dataset
printf '%s' "$HF_TOKEN" > /tmp/hf-token-dataset/hf_token.txt
kaggle datasets init -p /tmp/hf-token-dataset
# Edit /tmp/hf-token-dataset/dataset-metadata.json:
#   id: YOUR_KAGGLE_USERNAME/hf-token-dataset
#   title: hf-token-dataset
kaggle datasets create -p /tmp/hf-token-dataset --dir-mode zip
```

Kaggle CLI 2.0.x creates datasets privately by default. Do not pass `--public`.

Then attach `YOUR_KAGGLE_USERNAME/hf-token-dataset` to the generated push metadata.

Use the repo helper:

```bash
# Logged-in Kaggle user, with matching USERNAME/hf-token-dataset dataset.
python kaggle/prepare_kernel.py all --hf-token-dataset auto

# Explicit user.
python kaggle/prepare_kernel.py all --username YOUR_KAGGLE_USERNAME --hf-token-dataset YOUR_KAGGLE_USERNAME/hf-token-dataset
```

### Last-Resort Solution

Hardcoding secrets directly in the script file works because the script is uploaded directly to Kaggle by `kaggle kernels push`, but it should be treated as a last resort.

```python
import os
os.environ["HF_TOKEN"] = "hf_actualtoken"
```

**Safety measures:**
- Add the secret line only when pushing, remove after
- Or keep it in the file but ensure it's not committed (use `git diff` to verify before any commit)
- Or add the kernel directory to `.gitignore` if it only exists for execution
- NEVER use `git add -A` or `git add .` if the script contains secrets

### Fallback chain

```python
def setup_token():
    token = os.environ.get("HF_TOKEN")
    if not token:
        try:
            from kaggle_secrets import UserSecretsClient
            token = UserSecretsClient().get_secret("HF_TOKEN")
        except Exception:
            pass
    if not token:
        for token_file in (
            "/kaggle/input/hf-token-dataset/hf_token.txt",
            "/kaggle/input/hf-token-dataset/token.txt",
            "/kaggle/input/nsa-hf-token/hf_token.txt",
            "/kaggle/input/nsa-hf-token/token.txt",
        ):
            if os.path.exists(token_file):
                with open(token_file) as f:
                    token = f.read().strip()
                break
    if token:
        os.environ["HF_TOKEN"] = token
    else:
        print("WARNING: No token found")
```

The private dataset path is the primary method. The env-var and `kaggle_secrets` branches are only fallbacks for direct notebook/debug use.

## Installing Custom Packages

### Do NOT use `pip install -e` (editable installs)

Kaggle's Python environment often lacks the build backend (e.g., `hatchling`, `flit`). Editable installs (`pip install -e .`) will fail even if you install the build backend first — there are environment conflicts.

### Use `sys.path.insert` instead

```python
import subprocess, sys

# Clone your repo
subprocess.check_call(["git", "clone", "--depth", "1", "https://github.com/user/repo.git", "/tmp/repo"])

# Add source to path directly — no pip install needed
sys.path.insert(0, "/tmp/repo/src")

# Now import works
from my_package import main
```

This is faster and avoids all build system issues.

### For pip dependencies, install in the script

```python
subprocess.check_call([
    sys.executable, "-m", "pip", "install", "-q",
    "torch", "transformers>=4.51", "bitsandbytes>=0.43",
])
```

Kaggle images come with many packages pre-installed (torch, transformers, numpy, pandas, etc.), so you may not need to install everything. But versions may differ — pin if it matters.

## Environment Details

| Property | Value |
|----------|-------|
| Python | 3.12 (as of May 2026) |
| GPU (T4) | 15GB VRAM |
| GPU quota | ~30 hours/week (shared across UI and CLI) |
| Max runtime | 12 hours per session |
| Internet | Available if `enable_internet: true` |
| Output dir | `/kaggle/working/` only |
| Temp disk | ~70GB |

### T4 GPU constraints

- **No native bf16.** T4 is Turing (compute capability 7.5). Use fp16 for compute dtype.
- **No flash-attention.** Use `attn_implementation: eager` in model configs.
- **15GB VRAM.** An 8B model in bf16 won't fit. Use 4-bit quantization (NF4 via bitsandbytes), which brings it to ~5-6GB.

## Common Pitfalls (Learned from Iteration)

### 1. "Queued..." for 30+ minutes
Normal. Kaggle GPU slots are shared and first-come-first-served. Peak hours are worse. Just wait.

### 2. Kernel shows wrong GPU type
You forgot `--accelerator NvidiaTeslaT4` on the push command. Re-push with the flag.

### 3. `Preparing editable metadata (pyproject.toml) did not run successfully`
Don't use `pip install -e`. Use `sys.path.insert(0, "/path/to/src")` instead.

### 4. Gated dataset access denied
Even with a valid `HF_TOKEN`, gated datasets (like `walledai/AdvBench`) require you to visit the dataset page on huggingface.co and click "Request Access" first. The token alone isn't enough.

### 5. `AttributeError` on `apply_chat_template` return value
Kaggle may have a different `transformers` version than your local env. The return type of `apply_chat_template(return_tensors="pt")` varies across versions — sometimes a raw tensor, sometimes a `BatchEncoding`. Always use `hasattr(encoded, "input_ids")` checks, not `isinstance(encoded, dict)`.

### 6. Secrets not found despite setting them in the UI
Secrets set via the notebook editor do not reliably carry over to CLI-pushed scripts. Use a private token dataset and attach it through `dataset_sources`.

### 6b. `HF_TOKEN=... kaggle kernels push ...` still cannot see the token
Expected. That environment variable is local to the CLI command and is not transferred into the remote kernel. Attach `USERNAME/hf-token-dataset` instead.

### 7. Status check shows old version
Re-pushing creates a new version but the status endpoint always returns the latest completed/errored run. If you just pushed, wait ~60 seconds before polling.

### 8. No way to cancel a queued/running kernel
There's no `kaggle kernels cancel` command. You can try re-pushing (new version supersedes), or stop it from the web UI if there's a stop button visible. Queued runs that get superseded are dropped.

### 9. Output files not found
Files must be written to `/kaggle/working/`. Any other path (including `/tmp/`) is not retrievable via `kaggle kernels output`.

## Monitoring Pattern

Poll status in a loop. Kaggle kernels can take minutes to hours:

```bash
# Simple poll
while true; do
    status=$(kaggle kernels status USERNAME/kernel-slug 2>&1)
    echo "$(date +%H:%M:%S) $status"
    case "$status" in
        *complete*|*COMPLETE*|*error*|*ERROR*) break;;
    esac
    sleep 60
done

# Then pull
kaggle kernels output USERNAME/kernel-slug -p ./output/
```

## Re-running After Code Changes

The kernel script clones from a git repo at runtime. So the workflow is:

1. Make code changes locally
2. `git commit` and `git push` to remote
3. `kaggle kernels push -p ./kernel-dir/ --accelerator NvidiaTeslaT4`

The kernel clones fresh each run, so it always gets the latest code. Do not hardcode secrets; attach a private token dataset through `kaggle/prepare_kernel.py --hf-token-dataset auto`.
