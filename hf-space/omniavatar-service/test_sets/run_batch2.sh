#!/bin/bash
# Batch 2: P7 (calibrated lip-sync intensity) on woman1 (replaces the
# dropped lena/P4 case) and man2, sequentially on the same warm L4 Space.
set -e
cd "$(dirname "$0")"

export OMNIAVATAR_URL="https://firebird-technologies-avtr1-service.hf.space"
export AVATAR_SERVICE_SECRET="$(cat /private/tmp/claude-501/-Users-humeraraheel-firebird-blog2video/397684c4-0b34-446f-bcf8-92a5f1b66150/scratchpad/omni_secret.txt)"
export HF_TOKEN="$(python3 -c 'from huggingface_hub import HfFolder; print(HfFolder.get_token())')"

AUDIO="/Users/humeraraheel/firebird/blog2video/hf-space/avatar-service/musetalk_test_inputs/vo1_proj1059_scene1.mp3"
P7="A person speaking naturally to the camera, with lip movements and facial expressions that closely and subtly match the actual volume and pacing of their voice - calm delivery stays calm, emphasis stays understated, without exaggerated or theatrical motion. Natural head movement."

echo "=== TEST 4: woman1_calibrated_lipsync (P7) ==="
python3 -u run_test.py \
  "woman1_calibrated_lipsync" \
  images/candidate_woman1.jpg \
  "$AUDIO" \
  "$P7"

echo "=== TEST 5: man2_calibrated_lipsync (P7) ==="
python3 -u run_test.py \
  "man2_calibrated_lipsync" \
  images/candidate_man2.jpg \
  "$AUDIO" \
  "$P7"

echo "=== BATCH 2 COMPLETE ==="
