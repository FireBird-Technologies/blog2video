# Kaggle Secrets Setup

This repo uses a private Kaggle dataset for runtime secrets because `kaggle kernels push` does not support passing environment variables into the remote kernel run.

## Private Token Dataset

Each team member creates their own private Kaggle dataset containing a token file.

Recommended dataset slug: `hf-token-dataset`

The checked-in metadata files are username-free templates:

```text
kaggle/kernel-metadata.json
kaggle/phase1/kernel-metadata.json
```

Use `kaggle/prepare_kernel.py` to generate push directories with the active username and token dataset attached. Generated metadata is written under:

```text
/tmp/nsa-kaggle-kernels/phase0/kernel-metadata.json
/tmp/nsa-kaggle-kernels/phase1/kernel-metadata.json
```

## How The Kernel Reads The Token

The Kaggle wrapper scripts read these paths:

```text
/kaggle/input/hf-token-dataset/hf_token.txt
/kaggle/input/hf-token-dataset/token.txt
/kaggle/input/nsa-hf-token/hf_token.txt
/kaggle/input/nsa-hf-token/token.txt
```

Recommended file name: `hf_token.txt`

## Creating Your Private Token Dataset

Create a private dataset with your HuggingFace token:

```bash
source ~/.zshrc  # if needed
mkdir -p /tmp/hf-token-dataset
printf '%s' "$HF_TOKEN" > /tmp/hf-token-dataset/hf_token.txt
kaggle datasets init -p /tmp/hf-token-dataset
```

Edit `/tmp/hf-token-dataset/dataset-metadata.json`:

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

Create the dataset:

```bash
kaggle datasets create -p /tmp/hf-token-dataset --dir-mode zip
```

Kaggle CLI 2.0.x creates datasets as private by default. Do not pass `--public`.

Then prepare generated kernel metadata:

```bash
python kaggle/prepare_kernel.py all --username YOUR_KAGGLE_USERNAME --hf-token-dataset YOUR_KAGGLE_USERNAME/hf-token-dataset
```

Push:

```bash
kaggle kernels push -p /tmp/nsa-kaggle-kernels/phase1/ --accelerator NvidiaTeslaT4
```

## Auto-Detect Active User

For the currently logged-in Kaggle CLI account:

```bash
python kaggle/prepare_kernel.py all --hf-token-dataset auto
```

Check active Kaggle CLI user:

```bash
kaggle config view
```

## Cleanup

After creating the dataset, remove the local temp token file:

```bash
rm -f /tmp/hf-token-dataset/hf_token.txt
```

Never commit token files or hardcode tokens into scripts.
