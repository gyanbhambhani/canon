"""Nightly backup job: copy a file to a timestamped backup, verify it, upload it."""

import time
import urllib.request


def base_name(path: str) -> str:
    """The last component of a slash-separated path."""
    return path.split("/")[-1]


def backup_name(path: str, dir: str, ms: int) -> str:
    """Where the backup of `path` taken at `ms` goes inside `dir`."""
    return dir + "/" + base_name(path) + ".bak." + str(ms)


def fingerprint(text: str) -> int:
    """A cheap content fingerprint used to compare a file with its copy."""
    return len(text) * 31 + len(text.split("\n"))


def copy_file(src: str, dst: str) -> int:
    """Copy `src` to `dst`; returns the copied content's fingerprint."""
    with open(src, encoding="utf-8") as f:
        text = f.read()
    with open(dst, "w", encoding="utf-8") as f:
        f.write(text)
    return fingerprint(text)


def backup_file(src: str, dir: str) -> str:
    """Copy `src` into `dir` under a timestamped name; returns that name."""
    target = backup_name(src, dir, int(time.time() * 1000))
    copy_file(src, target)
    return target


def upload_backup(path: str, url: str) -> str:
    """POST the file at `path` to the backup service; returns its receipt."""
    with open(path, encoding="utf-8") as f:
        data = f.read().encode("utf-8")
    request = urllib.request.Request(url + "?name=" + base_name(path), data=data, method="POST")
    with urllib.request.urlopen(request, timeout=30) as resp:
        receipt: bytes = resp.read()
    return receipt.decode("utf-8").strip()


def verify_copy(src: str, dst: str) -> bool:
    """True if both files can be read and have the same fingerprint."""
    try:
        with open(src, encoding="utf-8") as a, open(dst, encoding="utf-8") as b:
            return fingerprint(a.read()) == fingerprint(b.read())
    except OSError:
        return False


def run_backup(src: str, dir: str, url: str) -> str:
    """Back up, verify and upload `src`; returns the upload receipt."""
    target = backup_file(src, dir)
    if not verify_copy(src, target):
        raise RuntimeError("backup does not match " + src)
    return upload_backup(target, url)
