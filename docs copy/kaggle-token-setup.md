# Kaggle HF Token Dataset Setup

Kaggle CLI `kernels push` does not support passing environment variables into remote kernel runs. We use a **private Kaggle dataset** to store the HuggingFace token, which gets mounted at `/kaggle/input/` in the kernel environment.

## Per-User Datasets

Each team member creates their own private dataset with their Kaggle username as the namespace.

| Field             | Value                              |
|-------------------|------------------------------------|
| Dataset slug      | `hf-token-dataset`                 |
| Dataset ID        | `YOUR_KAGGLE_USERNAME/hf-token-dataset` |

## Setup Steps

### 1. Prerequisites

- Kaggle CLI installed and configured (`~/.kaggle/kaggle.json` exists)
- HuggingFace token available (get from https://huggingface.co/settings/tokens)
- HF token should belong to an account that has accepted any required gated model/dataset licenses

### 2. Create the Dataset

```bash
# Create a temp directory for the token file
mkdir -p /tmp/hf-token-dataset

# Write your HF token to a file (replace with your actual token)
# Option A: If you have HF_TOKEN in your shell env
printf '%s' "$HF_TOKEN" > /tmp/hf-token-dataset/hf_token.txt

# Option B: Paste it directly (replace hf_xxx with your token)
# printf '%s' "hf_xxx" > /tmp/hf-token-dataset/hf_token.txt

# Initialize Kaggle dataset metadata
kaggle datasets init -p /tmp/hf-token-dataset
```

### 3. Edit the Metadata

Open `/tmp/hf-token-dataset/dataset-metadata.json` and set:

```json
{
  "title": "hf-token-dataset",
  "id": "YOUR_KAGGLE_USERNAME/hf-token-dataset",
  "licenses": [
    {
      "name": "CC0-1.0"
    }
  ]
}
```

Replace `YOUR_KAGGLE_USERNAME` with your actual Kaggle username.

### 4. Create the Dataset on Kaggle

```bash
kaggle datasets create -p /tmp/hf-token-dataset --dir-mode zip
```

Kaggle CLI 2.0.x creates datasets as **private by default**. Do NOT pass `--public`.

### 5. Verify

```bash
kaggle datasets list --mine | grep hf-token-dataset
```

### 6. Clean Up

```bash
rm -rf /tmp/hf-token-dataset
```

## How Kernel Scripts Read the Token

The kernel scripts check these paths in order:

```
/kaggle/input/hf-token-dataset/hf_token.txt
/kaggle/input/hf-token-dataset/token.txt
/kaggle/input/nsa-hf-token/hf_token.txt
/kaggle/input/nsa-hf-token/token.txt
```

The dataset is attached to kernels automatically by `kaggle/prepare_kernel.py`:

```bash
python kaggle/prepare_kernel.py phase0 --hf-token-dataset auto
# 'auto' resolves to {your_username}/hf-token-dataset
```

## Updating the Token

If you need to update the token:

```bash
mkdir -p /tmp/hf-token-dataset
printf '%s' "$NEW_HF_TOKEN" > /tmp/hf-token-dataset/hf_token.txt

# Copy the same metadata from above
cat > /tmp/hf-token-dataset/dataset-metadata.json << 'EOF'
{
  "title": "hf-token-dataset",
  "id": "YOUR_KAGGLE_USERNAME/hf-token-dataset",
  "licenses": [{"name": "CC0-1.0"}]
}
EOF

kaggle datasets version -p /tmp/hf-token-dataset -m "update token" --dir-mode zip
rm -rf /tmp/hf-token-dataset
```
