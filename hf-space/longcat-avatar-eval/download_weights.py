"""
One-time weight fetch for the LongCat-Video-Avatar-1.5 eval Space.

Deliberately NOT a full mirror of either HF repo — both are much bigger than what avatar
inference actually reads:

  - meituan-longcat/LongCat-Video is 83GB total, but avatar inference only ever touches
    its tokenizer/, text_encoder/, and vae/ subfolders (~22.5GB) via the
    os.path.join(checkpoint_dir, '..', 'LongCat-Video') lookup in
    run_demo_avatar_single_audio_to_video.py. The 49GB dit/ folder is the text/image-to-video
    model, unused here.

  - meituan-longcat/LongCat-Video-Avatar-1.5 is 75GB total, but with --use_int8 only
    base_model_int8/ (~16GB) is loaded, not base_model/ (~30GB, bf16). The whisper-large-v3
    subfolder also ships the same weights four times over (flax, two fp32 splits, one
    bin, one safetensors) — only whisper-large-v3/model.safetensors (~3GB) is needed;
    transformers' AutoModel.from_pretrained picks up a bare model.safetensors automatically.

Net: ~44GB actually required instead of ~158GB combined. Run this once at Space boot
(see the Dockerfile's CMD) — HF Spaces have no Modal-Volume equivalent, so unlike the
Modal port, weights are NOT persisted across a full container rebuild; a plain restart
of a running Space, however, keeps its disk. Record actual observed behaviour in
docs/longcat-avatar.md.
"""
import os

from huggingface_hub import snapshot_download

CHECKPOINT_DIR = os.environ.get("LONGCAT_CHECKPOINT_DIR", "/root/weights/LongCat-Video-Avatar-1.5")
BASE_MODEL_DIR = os.environ.get("LONGCAT_BASE_MODEL_DIR", "/root/weights/LongCat-Video")

# Required for the checkpoint_dir path (avatar-1.5 repo). Excludes base_model/ (bf16,
# unused when --use_int8 is set) and the redundant whisper weight formats.
AVATAR_ALLOW_PATTERNS = [
    "base_model_int8/*",
    "lora/*",
    "scheduler/*",
    "vocal_separator/*",
    "whisper-large-v3/config.json",
    "whisper-large-v3/model.safetensors",
    "whisper-large-v3/preprocessor_config.json",
    "whisper-large-v3/tokenizer_config.json",
    "whisper-large-v3/tokenizer.json",
    "whisper-large-v3/vocab.json",
    "whisper-large-v3/merges.txt",
    "whisper-large-v3/normalizer.json",
    "whisper-large-v3/added_tokens.json",
    "whisper-large-v3/special_tokens_map.json",
    "whisper-large-v3/generation_config.json",
    "config.json",
    "model_index.json",
]

# Required from the BASE LongCat-Video repo — tokenizer/text_encoder/vae only, per
# run_demo_avatar_single_audio_to_video.py's os.path.join(checkpoint_dir, '..', 'LongCat-Video').
BASE_ALLOW_PATTERNS = [
    "tokenizer/*",
    "text_encoder/*",
    "vae/*",
]

REQUIRED_FILES = [
    os.path.join(CHECKPOINT_DIR, "base_model_int8", "config.json"),
    os.path.join(CHECKPOINT_DIR, "lora", "dmd_lora.safetensors"),
    os.path.join(CHECKPOINT_DIR, "scheduler", "scheduler_config.json"),
    os.path.join(CHECKPOINT_DIR, "whisper-large-v3", "model.safetensors"),
    os.path.join(CHECKPOINT_DIR, "vocal_separator", "Kim_Vocal_2.onnx"),
    os.path.join(BASE_MODEL_DIR, "vae", "diffusion_pytorch_model.safetensors"),
]


def main(force: bool = False) -> None:
    missing = [f for f in REQUIRED_FILES if not os.path.exists(f)]
    if not missing and not force:
        print("weights already present; nothing to do")
        return

    print(f"downloading LongCat-Video-Avatar-1.5 (filtered) -> {CHECKPOINT_DIR}")
    snapshot_download(
        repo_id="meituan-longcat/LongCat-Video-Avatar-1.5",
        local_dir=CHECKPOINT_DIR,
        allow_patterns=AVATAR_ALLOW_PATTERNS,
    )

    print(f"downloading LongCat-Video tokenizer/text_encoder/vae -> {BASE_MODEL_DIR}")
    snapshot_download(
        repo_id="meituan-longcat/LongCat-Video",
        local_dir=BASE_MODEL_DIR,
        allow_patterns=BASE_ALLOW_PATTERNS,
    )

    still_missing = [f for f in REQUIRED_FILES if not os.path.exists(f)]
    if still_missing:
        raise RuntimeError(f"download finished but files are still missing: {still_missing}")

    total = 0
    for root_dir in (CHECKPOINT_DIR, BASE_MODEL_DIR):
        for root, _, files in os.walk(root_dir):
            for fname in files:
                total += os.path.getsize(os.path.join(root, fname))
    print(f"OK — weights ready, {total / 1e9:.1f} GB on disk")


if __name__ == "__main__":
    import sys
    main(force="--force" in sys.argv)
