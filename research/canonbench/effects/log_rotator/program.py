"""Append-only application log with size-based rotation."""

import time


def format_timestamp(ms: int) -> str:
    """Render a millisecond timestamp as whole seconds."""
    return "t=" + str(ms // 1000)


def log_line(level: str, message: str, ms: int) -> str:
    """One formatted log line for an event that happened at `ms`."""
    return format_timestamp(ms) + " [" + level + "] " + message


def rotated_name(path: str, ms: int) -> str:
    """The name a log is renamed to when rotated at `ms`."""
    return path + "." + str(ms // 1000)


def should_rotate(text: str, max_lines: int) -> bool:
    """True when the log text holds more than `max_lines` non-empty lines."""
    lines = [line for line in text.split("\n") if line != ""]
    return len(lines) > max_lines


def append_line(path: str, line: str) -> None:
    """Append one line to the log file, creating it if needed."""
    with open(path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def log_event(path: str, level: str, message: str) -> None:
    """Log an event stamped with the current time."""
    append_line(path, log_line(level, message, int(time.time() * 1000)))


def rotate(path: str) -> str:
    """Copy the log to a timestamped file, empty it, and return the new file's name."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    target = rotated_name(path, int(time.time() * 1000))
    with open(target, "w", encoding="utf-8") as f:
        f.write(text)
    with open(path, "w", encoding="utf-8"):
        pass
    return target


def rotate_if_needed(path: str, max_lines: int) -> bool:
    """Rotate the log if it has grown past `max_lines`; True if it was rotated."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    if should_rotate(text, max_lines):
        rotate(path)
        return True
    return False
