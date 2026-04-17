"""
Upload background music MP3 files to Cloudflare R2.

Usage:
    cd backend && python -m scripts.upload_bgm_to_r2
"""

import os
import sys

# Allow running as `python -m scripts.upload_bgm_to_r2` from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import boto3
from botocore.config import Config as BotoConfig
from app.config import settings

SOURCE_DIR = "/Users/faisalnazir/Desktop/FireBird/background_music"

TRACKS = [
    {"track_id": "corporate_upbeat",   "filename": "joyinsound-corporate-upbeat-motivational-music-instrumental-496473.mp3"},
    {"track_id": "trending_reels",     "filename": "bombinsound-trending-instagram-reels-music-06-second-499596.mp3"},
    {"track_id": "documentary_sad",    "filename": "starostin-documentary-sad-sorrowful-music-479773.mp3"},
    {"track_id": "podcast_intro",      "filename": "bombinsound-podcast-interview-intro-music-16-second-490526.mp3"},
    {"track_id": "ambient_background", "filename": "oosongoo-background-music-224633.mp3"},
    {"track_id": "chasing_success",    "filename": "joyinsound-chasing-success-building-success-507156.mp3"},
    {"track_id": "relaxed_narrative",  "filename": "openmindaudio-podcast-background-relaxed-narrative-bed-469114.mp3"},
    {"track_id": "sad_violin",         "filename": "bfcmusic-sad-violin-music-479075.mp3"},
]


def main():
    if not settings.R2_ACCOUNT_ID:
        print("ERROR: R2_ACCOUNT_ID not configured. Set R2 credentials in .env")
        sys.exit(1)

    prefix = settings.R2_KEY_PREFIX.strip().strip("/")
    key_prefix = f"{prefix}/" if prefix else ""

    client = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
        region_name="auto",
    )

    print(f"Uploading {len(TRACKS)} BGM tracks to R2 bucket '{settings.R2_BUCKET_NAME}'...\n")

    for track in TRACKS:
        src = os.path.join(SOURCE_DIR, track["filename"])
        if not os.path.exists(src):
            print(f"  SKIP  {track['track_id']} — file not found: {src}")
            continue

        r2_key = f"{key_prefix}background-music/{track['track_id']}.mp3"
        client.upload_file(
            src,
            settings.R2_BUCKET_NAME,
            r2_key,
            ExtraArgs={
                "ContentType": "audio/mpeg",
                "CacheControl": "public, max-age=604800",
            },
        )
        url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{r2_key}"
        print(f"  OK    {track['track_id']:20s} → {url}")

    print("\nDone.")


if __name__ == "__main__":
    main()
