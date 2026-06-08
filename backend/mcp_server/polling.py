import time
from typing import Callable


class PollTimeout(Exception):
    pass


def poll_until(
    check_fn: Callable[[], dict],
    is_done: Callable[[dict], bool],
    is_error: Callable[[dict], tuple[bool, str]],
    interval: int,
    timeout: int,
    label: str,
) -> dict:
    """Synchronously poll check_fn every `interval` seconds until done, error, or timeout.

    Returns the final dict on success.
    Raises PollTimeout if timeout exceeded, or re-raises APIError from check_fn.
    """
    deadline = time.time() + timeout
    while True:
        result = check_fn()
        errored, err_msg = is_error(result)
        if errored:
            from mcp_server.client import APIError
            raise APIError(500, f"{label} failed: {err_msg}")
        if is_done(result):
            return result
        if time.time() >= deadline:
            raise PollTimeout(f"{label} did not complete within {timeout}s")
        time.sleep(interval)
