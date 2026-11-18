#!/usr/bin/env bash
# Helper for the task 1 demo: transcribe both demo clips and read sentiment + career.
cd ~/Downloads/TalentFlow/prototype || exit 1
exec > >(tee data/runs/video_demo.log) 2>&1
source .venv/bin/activate
for f in "docs/demos/audio_VIDEO-2026-08-31-14-35-23.m4a" \
         "docs/demos/audio_VIDEO-2026-08-31-at_6.32_PM.m4a"; do
  echo "=== $f ==="
  python scripts/16_video.py "$f"
done
echo VIDEO_RUN_COMPLETE
