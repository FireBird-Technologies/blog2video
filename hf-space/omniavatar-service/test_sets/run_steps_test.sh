#!/bin/bash
# Test 8 and 5 steps sequentially on one warm L4 (steps passed per-request,
# no rebuild needed). Same man2 image/audio/P8 prompt as the 10-step baseline.
set -e
cd "$(dirname "$0")"

export OMNIAVATAR_URL="https://firebird-technologies-avtr1-service.hf.space"
export AVATAR_SERVICE_SECRET="$(cat /private/tmp/claude-501/-Users-humeraraheel-firebird-blog2video/397684c4-0b34-446f-bcf8-92a5f1b66150/scratchpad/omni_secret.txt)"
export HF_TOKEN="$(python3 -c 'from huggingface_hub import HfFolder; print(HfFolder.get_token())')"

AUDIO="/Users/humeraraheel/firebird/blog2video/hf-space/avatar-service/musetalk_test_inputs/vo1_proj1059_scene1.mp3"
P8="A person speaking naturally to the camera, with lip movements and facial expressions that closely match the actual voiceover audio - driven by the real volume and emotion of the voice, calm delivery stays calm, emphasis stays understated, without over-exaggerated, dramatic, or theatrical motion. Natural head movement."

echo "=== 8 STEPS ==="
python3 -u run_test.py "man2_8steps_p8" images/candidate_man2.jpg "$AUDIO" "$P8" 8

echo "=== 5 STEPS ==="
python3 -u run_test.py "man2_5steps_p8" images/candidate_man2.jpg "$AUDIO" "$P8" 5

echo "=== STEPS TEST COMPLETE ==="
