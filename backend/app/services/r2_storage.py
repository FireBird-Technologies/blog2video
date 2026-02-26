"""
Cloudflare R2 storage service.

Provides upload, download URL generation, and deletion for project assets
(images, audio, rendered videos). Uses boto3 with S3-compatible API.

R2 key structure:
    {prefix}users/{user_id}/projects/{project_id}/images/{filename}
    {prefix}users/{user_id}/projects/{project_id}/audio/{filename}
    {prefix}users/{user_id}/projects/{project_id}/output/video.mp4

    Set R2_KEY_PREFIX in .env (e.g. "dev") to namespace local uploads
    away from production data. In production leave it empty.
"""
import os
import mimetypes
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings


# ─── Lazy-initialised S3 client ──────────────────────────────

_s3_client = None


def _get_client():
    """Return a cached boto3 S3 client configured for Cloudflare R2."""
    global _s3_client
    if _s3_client is None:
        if not settings.R2_ACCOUNT_ID:
            raise RuntimeError(
                "R2_ACCOUNT_ID is not configured. "
                "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env"
            )
        _s3_client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
            region_name="auto",
        )
    return _s3_client


def is_r2_configured() -> bool:
    """Return True if R2 credentials are configured."""
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET_NAME
    )


# ─── Key helpers ──────────────────────────────────────────────


def _prefix() -> str:
    """Return the R2 key prefix (e.g. 'dev/' for local, '' for production).
    Set R2_KEY_PREFIX=dev in .env to isolate local uploads from production data."""
    p = settings.R2_KEY_PREFIX.strip().strip("/")
    return f"{p}/" if p else ""


def image_key(user_id: int, project_id: int, filename: str) -> str:
    """R2 object key for a project image."""
    return f"{_prefix()}users/{user_id}/projects/{project_id}/images/{filename}"


def audio_key(user_id: int, project_id: int, filename: str) -> str:
    """R2 object key for a project audio file."""
    return f"{_prefix()}users/{user_id}/projects/{project_id}/audio/{filename}"


def video_key(user_id: int, project_id: int) -> str:
    """R2 object key for a project's rendered video (legacy — same key every time)."""
    return f"{_prefix()}users/{user_id}/projects/{project_id}/output/video.mp4"


def video_key_versioned(user_id: int, project_id: int, version: str) -> str:
    """R2 object key for a project's rendered video with a version (e.g. timestamp).
    Use this so each re-render gets a new URL and caches don't serve the old file."""
    return f"{_prefix()}users/{user_id}/projects/{project_id}/output/video_{version}.mp4"


def project_prefix(user_id: int, project_id: int) -> str:
    """R2 key prefix for all objects belonging to a project."""
    return f"{_prefix()}users/{user_id}/projects/{project_id}/"


def user_prefix(user_id: int) -> str:
    """R2 key prefix for all objects belonging to a user."""
    return f"{_prefix()}users/{user_id}/"


# ─── Public URL ───────────────────────────────────────────────


def public_url(key: str) -> str:
    """
    Return the public URL for an R2 object.
    Uses R2_PUBLIC_URL (custom domain or r2.dev subdomain).
    """
    base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{base}/{key}"


# ─── Upload ───────────────────────────────────────────────────


def upload_file(local_path: str, key: str, content_type: Optional[str] = None) -> str:
    """
    Upload a local file to R2.

    Args:
        local_path: Path to the local file.
        key: The R2 object key (e.g. "projects/42/images/img_abc123.webp").
        content_type: Optional MIME type. Auto-detected if not provided.

    Returns:
        The public URL of the uploaded object.
    """
    if not is_r2_configured():
        print("[R2] Skipping upload — R2 not configured")
        return ""

    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Local file not found: {local_path}")

    if not content_type:
        content_type, _ = mimetypes.guess_type(local_path)
        content_type = content_type or "application/octet-stream"

    client = _get_client()
    extra_args = {"ContentType": content_type}

    # Set cache and disposition headers based on file type
    if content_type.startswith("video/"):
        extra_args["CacheControl"] = "public, max-age=86400"  # 1 day
        extra_args["ContentDisposition"] = "attachment; filename=\"video.mp4\""
    elif content_type.startswith("image/"):
        extra_args["CacheControl"] = "public, max-age=604800"  # 7 days
    elif content_type.startswith("audio/"):
        extra_args["CacheControl"] = "public, max-age=604800"  # 7 days

    client.upload_file(
        Filename=local_path,
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        ExtraArgs=extra_args,
    )

    url = public_url(key)
    print(f"[R2] Uploaded {key} ({content_type})")
    return url


def upload_project_image(user_id: int, project_id: int, local_path: str, filename: str) -> str:
    """Upload a project image to R2. Returns the public URL."""
    key = image_key(user_id, project_id, filename)
    return upload_file(local_path, key)


def upload_project_audio(user_id: int, project_id: int, local_path: str, filename: str) -> str:
    """Upload a project audio file to R2. Returns the public URL."""
    key = audio_key(user_id, project_id, filename)
    return upload_file(local_path, key, content_type="audio/mpeg")


def upload_project_video(user_id: int, project_id: int, local_path: str) -> str:
    """Upload a rendered video to R2. Uses legacy key (same URL every time). Prefer upload_project_video_versioned for re-renders."""
    key = video_key(user_id, project_id)
    return upload_file(local_path, key, content_type="video/mp4")


def upload_project_video_versioned(
    user_id: int, project_id: int, local_path: str, version: str
) -> str:
    """Upload a rendered video to R2 with a versioned key. Returns the public URL.
    Each render (including re-render) should use a new version so the URL changes and caches serve fresh content."""
    key = video_key_versioned(user_id, project_id, version)
    return upload_file(local_path, key, content_type="video/mp4")


# ─── Presigned URLs ───────────────────────────────────────────


def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    """
    Generate a presigned URL for downloading an R2 object.
    Useful for private buckets or time-limited access.

    Args:
        key: The R2 object key.
        expires_in: URL validity in seconds (default 1 hour).

    Returns:
        A presigned download URL.
    """
    client = _get_client()
    url = client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
    return url


# ─── Delete ───────────────────────────────────────────────────


def delete_object(key: str) -> bool:
    """
    Delete a single object from R2.

    Returns:
        True if deleted (or already absent), False on error.
    """
    if not is_r2_configured():
        return False

    try:
        client = _get_client()
        client.delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        print(f"[R2] Deleted {key}")
        return True
    except ClientError as e:
        print(f"[R2] Failed to delete {key}: {e}")
        return False


def delete_project_files(user_id: int, project_id: int) -> int:
    """
    Delete ALL R2 objects for a project (images, audio, video).
    Uses list + batch delete for efficiency.

    Returns:
        Number of objects deleted.
    """
    if not is_r2_configured():
        return 0

    client = _get_client()
    prefix = project_prefix(user_id, project_id)
    deleted_count = 0

    try:
        # List all objects under the project prefix
        paginator = client.get_paginator("list_objects_v2")
        pages = paginator.paginate(
            Bucket=settings.R2_BUCKET_NAME,
            Prefix=prefix,
        )

        for page in pages:
            contents = page.get("Contents", [])
            if not contents:
                continue

            # Batch delete (up to 1000 at a time)
            objects_to_delete = [{"Key": obj["Key"]} for obj in contents]
            client.delete_objects(
                Bucket=settings.R2_BUCKET_NAME,
                Delete={"Objects": objects_to_delete, "Quiet": True},
            )
            deleted_count += len(objects_to_delete)

        if deleted_count > 0:
            print(f"[R2] Deleted {deleted_count} objects for project {project_id}")

    except ClientError as e:
        print(f"[R2] Error deleting project {project_id} files: {e}")

    return deleted_count


# ─── Check existence ─────────────────────────────────────────


def object_exists(key: str) -> bool:
    """Check if an object exists in R2."""
    if not is_r2_configured():
        return False

    try:
        client = _get_client()
        client.head_object(Bucket=settings.R2_BUCKET_NAME, Key=key)
        return True
    except ClientError:
        return False
