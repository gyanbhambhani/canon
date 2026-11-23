"""Signed webhook delivery with retries and a local delivery log."""

import time
import urllib.error
import urllib.request


def sign(body: str, secret: str) -> str:
    """A toy signature over the body and the shared secret."""
    return "sig-" + str(len(body) * 7 + len(secret) * 13)


def build_payload(event: str, sent_at: int) -> str:
    """The form-encoded webhook body for an event sent at `sent_at`."""
    return "event=" + event + "&ts=" + str(sent_at)


def signed_payload(event: str, secret: str, sent_at: int) -> str:
    """The webhook body with its signature appended."""
    body = build_payload(event, sent_at)
    return body + "&sig=" + sign(body, secret)


def post_once(url: str, body: str) -> bool:
    """POST once; True only if the receiver answers `accepted`."""
    request = urllib.request.Request(url, data=body.encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(request, timeout=10) as resp:
            reply: bytes = resp.read()
    except urllib.error.URLError:
        return False
    return reply.decode("utf-8").strip() == "accepted"


def send_webhook(url: str, event: str, secret: str) -> bool:
    """Send one signed, timestamped webhook."""
    return post_once(url, signed_payload(event, secret, int(time.time() * 1000)))


def send_with_retry(url: str, event: str, secret: str, attempts: int) -> int:
    """Send with linear backoff; returns the attempt that succeeded, or 0."""
    for attempt in range(1, attempts + 1):
        if send_webhook(url, event, secret):
            return attempt
        time.sleep(0.5 * attempt)
    return 0


def delivery_line(url: str, event: str, attempts: int) -> str:
    """The delivery log line for one webhook."""
    if attempts == 0:
        return "FAILED " + event + " -> " + url
    return "OK " + event + " -> " + url + " after " + str(attempts)


def deliver(url: str, event: str, secret: str, log_path: str) -> bool:
    """Deliver a webhook (up to 3 tries) and append the outcome to the delivery log."""
    attempts = send_with_retry(url, event, secret, 3)
    try:
        with open(log_path, encoding="utf-8") as f:
            previous = f.read()
    except OSError:
        previous = ""
    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(previous + delivery_line(url, event, attempts) + "\n")
    except OSError:
        return False
    return attempts > 0
