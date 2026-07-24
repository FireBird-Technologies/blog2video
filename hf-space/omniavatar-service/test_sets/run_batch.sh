#!/bin/bash
# Runs a queued batch of test cases SEQUENTIALLY (one GPU, no parallelism
# possible) back-to-back without pausing/rebooting the Space between them.
set -e
cd "$(dirname "$0")"

export OMNIAVATAR_URL="https://firebird-technologies-avtr1-service.hf.space"
export AVATAR_SERVICE_SECRET="$(cat /private/tmp/claude-501/-Users-humeraraheel-firebird-blog2video/397684c4-0b34-446f-bcf8-92a5f1b66150/scratchpad/omni_secret.txt)"
export HF_TOKEN="$(python3 -c 'from huggingface_hub import HfFolder; print(HfFolder.get_token())')"

AUDIO="/Users/humeraraheel/firebird/blog2video/hf-space/avatar-service/musetalk_test_inputs/vo1_proj1059_scene1.mp3"

echo "=== TEST 2: man1_no_hands_clean (P3) ==="
python3 -u run_test.py \
  "man1_no_hands_clean" \
  images/candidate_man1.jpg \
  "$AUDIO" \
  "A person looking at the camera, speaking naturally with facial expressions that match the emotion and tone of their voice, with natural head and neck movement."

echo "=== TEST 3: lena_enthusiastic_feature (P4) ==="
python3 -u run_test.py \
  "lena_enthusiastic_feature" \
  images/fixture_lena.jpg \
  "$AUDIO" \
  "A person excitedly presenting a feature or product highlight directly to camera, energetic facial expressions and lively head movement that track the excitement in their voice, speaking as if genuinely enthusiastic about what they're explaining."

echo "=== BATCH COMPLETE ==="
