"""
Shared DSPy configuration. Called once at import time so all modules
share the same LM instance and thread context.
"""
import threading
import dspy
from app.config import settings

_lock = threading.Lock()
_configured = False


def ensure_dspy_configured():
    """Configure DSPy exactly once, thread-safe."""
    global _configured
    if _configured:
        return
    with _lock:
        if _configured:
            return
        lm = dspy.LM(
            "anthropic/claude-sonnet-4-5-20250929",
            api_key=settings.ANTHROPIC_API_KEY,
        )
        dspy.configure(lm=lm, async_max_workers=100)
        _configured = True
