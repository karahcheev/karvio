from __future__ import annotations

import threading
import time

_lock = threading.Lock()
_buckets: dict[str, list[float]] = {}


def _prune(timestamps: list[float], window: float, now: float) -> list[float]:
    cutoff = now - window
    return [t for t in timestamps if t > cutoff]


def is_rate_limited(key: str, *, max_attempts: int, window_seconds: float) -> bool:
    """Sliding-window check. Records the attempt and returns True if over the limit.

    In-process only; sufficient as a brute-force speed bump for password logins.
    """
    now = time.monotonic()
    with _lock:
        timestamps = _prune(_buckets.get(key, []), window_seconds, now)
        timestamps.append(now)
        _buckets[key] = timestamps
        return len(timestamps) > max_attempts


def reset(key: str) -> None:
    with _lock:
        _buckets.pop(key, None)


def clear_all() -> None:
    with _lock:
        _buckets.clear()
