"""Password hashing, session tokens, login throttling. Standard library only (scrypt), no extra dependencies."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
import threading
import time
from collections import defaultdict, deque

PASSWORD_MIN = 10
PASSWORD_MAX = 128
_N, _R, _P = 2**14, 8, 1
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, dk_b64 = stored.split("$")
        n, r, p = int(n), int(r), int(p)
        if scheme != "scrypt" or n > 2**16 or r > 16 or p > 4:  # a tampered hash must not be able to demand huge work
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(dk_b64)
        got = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=len(expected), maxmem=128 * n * r * 2 + 2**20)
        return hmac.compare_digest(got, expected)
    except (ValueError, TypeError, AttributeError):
        return False


_dummy: str | None = None


def dummy_hash() -> str:
    """Verified against when the email is unknown, so unknown and known emails take the same time."""
    global _dummy
    if _dummy is None:
        _dummy = hash_password(secrets.token_urlsafe(16))
    return _dummy


def normalise_email(value: str) -> str:
    v = value.strip().lower()
    if len(v) > 254 or not _EMAIL.match(v):
        raise ValueError("not a valid email address")
    return v


def check_password_policy(password: str, email: str | None = None) -> None:
    if len(password) < PASSWORD_MIN:
        raise ValueError(f"password must be at least {PASSWORD_MIN} characters")
    if len(password) > PASSWORD_MAX:
        raise ValueError(f"password must be at most {PASSWORD_MAX} characters")
    if email and password.lower() == email.lower():
        raise ValueError("password must not be the same as the email address")


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class LoginThrottle:
    """In-memory failed-login counter per email and per IP. Resets on restart; fine for one process."""

    def __init__(self) -> None:
        self._fails: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, now: float, window: float) -> deque[float]:
        q = self._fails[key]
        while q and now - q[0] > window:
            q.popleft()
        return q

    def blocked_for(self, email: str, ip: str, max_failures: int, window_s: float, now: float | None = None) -> int:
        """Seconds until the next attempt is allowed, or 0."""
        now = now if now is not None else time.monotonic()
        with self._lock:
            wait = 0
            for key, limit in ((f"e:{email}", max_failures), (f"i:{ip}", max_failures * 6)):
                q = self._prune(key, now, window_s)
                if len(q) >= limit:
                    wait = max(wait, int(window_s - (now - q[0])) + 1)
            return wait

    def fail(self, email: str, ip: str, now: float | None = None) -> None:
        now = now if now is not None else time.monotonic()
        with self._lock:
            self._fails[f"e:{email}"].append(now)
            self._fails[f"i:{ip}"].append(now)

    def clear_email(self, email: str) -> None:
        with self._lock:
            self._fails.pop(f"e:{email}", None)

    def reset(self) -> None:
        with self._lock:
            self._fails.clear()


throttle = LoginThrottle()
