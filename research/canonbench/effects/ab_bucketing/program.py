"""A/B experiment enrollment: sticky or random variants, recorded with the analytics API."""

import random
import urllib.error
import urllib.request


def variant_name(index: int) -> str:
    """The variant for a bucket index."""
    if index == 0:
        return "control"
    if index == 1:
        return "treatment"
    return "holdout"


def hash_bucket(user_id: int, buckets: int) -> int:
    """A stable bucket for a user id."""
    return (user_id * 2654435 + 12345) % buckets


def sticky_variant(user_id: int) -> str:
    """The variant a user always gets."""
    return variant_name(hash_bucket(user_id, 3))


def random_variant() -> str:
    """A uniformly random variant."""
    return variant_name(random.randrange(3))


def assign_variant(user_id: int, sticky: bool) -> str:
    """The user's sticky variant, or a random one when `sticky` is False."""
    if sticky:
        return sticky_variant(user_id)
    return random_variant()


def assignment_payload(experiment: str, user_id: int, variant: str) -> str:
    """The form-encoded body that records one assignment."""
    return "experiment=" + experiment + "&user=" + str(user_id) + "&variant=" + variant


def record_assignment(api: str, experiment: str, user_id: int, variant: str) -> bool:
    """POST the assignment to the analytics API; False if the request fails."""
    body = assignment_payload(experiment, user_id, variant).encode("utf-8")
    request = urllib.request.Request(api + "/assignments", data=body, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=5):
            return True
    except urllib.error.URLError:
        return False


def enroll(api: str, experiment: str, user_id: int, sticky: bool) -> str:
    """Assign and record a variant; falls back to control if recording fails."""
    variant = assign_variant(user_id, sticky)
    if not record_assignment(api, experiment, user_id, variant):
        return "control"
    return variant
