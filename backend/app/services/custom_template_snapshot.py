"""
Custom-template snapshot trigger.

The real snapshot is produced by a Node/puppeteer worker
(`frontend/scripts/capture-custom-thumbnails.ts`) that screenshots the deployed
frontend's `/_capture?custom=<id>` route and POSTs the image to
`/api/custom-templates/internal/preview-image/{id}`. This module is the backend
side that *asks* for a single template to be (re)snapshotted after create /
regenerate.

Because the backend Docker image does not contain the frontend or puppeteer, the
worker runs out-of-process. `request_snapshot` invokes it only when a worker
command is configured (`CAPTURE_WORKER_CMD`); otherwise it returns False so the
caller falls back to the legacy server-side Remotion still. It never raises into
the request path — a missing worker must never block template creation.
"""

import logging
import os
import shlex
import subprocess

logger = logging.getLogger(__name__)


def request_snapshot(template_id: int) -> bool:
    """Trigger a single-template snapshot via the external capture worker.

    Returns True if the worker was successfully invoked (it uploads the image
    itself via the internal preview-image endpoint), False if no worker is
    configured or the invocation failed — signalling the caller to fall back.
    """
    worker_cmd = os.environ.get("CAPTURE_WORKER_CMD", "").strip()
    if not worker_cmd:
        return False

    # Worker command receives the template id as a trailing argument, e.g.
    #   CAPTURE_WORKER_CMD="node /app/capture/capture-custom-thumbnails.mjs --ids"
    # -> node /app/capture/capture-custom-thumbnails.mjs --ids 42
    cmd = shlex.split(worker_cmd) + [str(template_id)]
    try:
        subprocess.run(cmd, check=True, timeout=180, capture_output=True, text=True)
        logger.info("Snapshot worker completed for template %d", template_id)
        return True
    except subprocess.CalledProcessError as e:
        logger.warning(
            "Snapshot worker failed for template %d (rc=%s): %s",
            template_id, e.returncode, (e.stderr or "")[:500],
        )
        return False
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        logger.warning("Snapshot worker unavailable for template %d: %s", template_id, e)
        return False
