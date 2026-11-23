"""Password reset: a six-digit code emailed as a link, valid for a fixed time."""

import random
import time
import urllib.error
import urllib.request


def reset_code() -> str:
    """A random six-digit code."""
    return "".join(str(random.randint(0, 9)) for _ in range(6))


def reset_link(base_url: str, user: str, code: str) -> str:
    """The link a user follows to reset their password."""
    return base_url + "/reset?user=" + user + "&code=" + code


def expires_at(issued_ms: int, ttl_minutes: int) -> int:
    """When a code issued at `issued_ms` stops being valid."""
    return issued_ms + ttl_minutes * 60000


def code_valid(issued_ms: int, ttl_minutes: int, now_ms: int) -> bool:
    """True if a code issued at `issued_ms` is still valid at `now_ms`."""
    return now_ms < expires_at(issued_ms, ttl_minutes)


def email_body(user: str, link: str) -> str:
    """The form-encoded request body for the email API."""
    return "to=" + user + "&subject=Reset your password&text=" + link


def send_email(api: str, body: str) -> bool:
    """Send one email through the email API; False if the request fails."""
    request = urllib.request.Request(api + "/v1/messages", data=body.encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10):
            return True
    except urllib.error.URLError:
        return False


def start_reset(api: str, base_url: str, user: str) -> int:
    """Email a reset link to `user`; returns the code's expiry time, or 0 if sending failed."""
    link = reset_link(base_url, user, reset_code())
    if not send_email(api, email_body(user, link)):
        return 0
    return expires_at(int(time.time() * 1000), 30)


def is_reset_valid(issued_ms: int, ttl_minutes: int) -> bool:
    """True if a code issued at `issued_ms` is still valid now."""
    return code_valid(issued_ms, ttl_minutes, int(time.time() * 1000))
