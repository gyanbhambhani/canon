"""Regional sales report, rendered from a CSV file and stamped with its generation time."""

import time
from dataclasses import dataclass


@dataclass
class Sale:
    region: str
    cents: int


def parse_sale(line: str) -> Sale | None:
    """Parse one `region,cents` line; None if malformed."""
    parts = line.split(",")
    if len(parts) != 2:
        return None
    try:
        cents = int(parts[1].strip())
    except ValueError:
        return None
    return Sale(parts[0].strip(), cents)


def totals_by_region(sales_text: str) -> list[tuple[str, int]]:
    """Total cents per region, regions in first-seen order."""
    totals: dict[str, int] = {}
    for line in sales_text.split("\n"):
        sale = parse_sale(line)
        if sale is not None:
            totals[sale.region] = totals.get(sale.region, 0) + sale.cents
    return list(totals.items())


def format_timestamp(ms: int) -> str:
    """The report's header line for a report generated at `ms`."""
    return "generated at " + str(ms // 1000)


def render_report(sales_text: str, generated_at: int) -> str:
    """The full report text for the given sales and generation time."""
    lines = [format_timestamp(generated_at)]
    for region, cents in totals_by_region(sales_text):
        lines.append(region + ": " + str(cents))
    return "\n".join(lines)


def build_report(sales_path: str) -> str:
    """Render the report for the sales file at `sales_path`, stamped now."""
    with open(sales_path, encoding="utf-8") as f:
        text = f.read()
    return render_report(text, int(time.time() * 1000))


def publish_report(sales_path: str, out_path: str) -> int:
    """Build the report and write it to `out_path`; returns its length."""
    report = build_report(sales_path)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report)
    return len(report)


def report_is_recent(generated_at: int, max_age_ms: int) -> bool:
    """True if a report generated at `generated_at` is at most `max_age_ms` old."""
    return int(time.time() * 1000) - generated_at <= max_age_ms
