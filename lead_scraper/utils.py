from __future__ import annotations

import csv
import logging
import os
from datetime import datetime, timezone
from typing import Optional, Tuple
from urllib.parse import urlparse

try:
    import whois  # type: ignore
except Exception:  # pragma: no cover - optional at runtime
    whois = None


logger = logging.getLogger("lead_scraper")


LOG_FILE = os.path.join("logs", "scraper.log")


def ensure_log_dir() -> None:
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)


def extract_domain(website: Optional[str]) -> Optional[str]:
    if not website:
        return None
    try:
        netloc = urlparse(website).netloc
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc or None
    except Exception:
        return None


def get_domain_creation_date(domain: str) -> Optional[datetime]:
    if not domain or whois is None:
        return None
    try:
        w = whois.whois(domain)
        created = w.creation_date
        if isinstance(created, list):
            created = min([d for d in created if d]) if created else None
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return created
    except Exception as e:
        logger.debug(f"WHOIS failed for {domain}: {e}")
        return None


def compute_business_age_years(website: Optional[str], review_unix_times: list[int]) -> Tuple[Optional[float], str]:
    """Return (years, method). method is 'domain', 'reviews', or 'unknown'."""
    now = datetime.now(tz=timezone.utc)
    # Try earliest review time first
    if review_unix_times:
        try:
            earliest = min(review_unix_times)
            dt = datetime.fromtimestamp(earliest, tz=timezone.utc)
            years = (now - dt).days / 365.25
            if years >= 0:
                return years, "reviews"
        except Exception:
            pass
    # Fallback to domain WHOIS
    domain = extract_domain(website)
    if domain:
        created = get_domain_creation_date(domain)
        if created:
            years = (now - created).days / 365.25
            return years, "domain"
    return None, "unknown"


def export_leads_to_csv(rows: list[dict], output_path: str) -> None:
    # Ensure directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    if not rows:
        # create empty file with header to keep workflow consistent
        header = [
            "business_name",
            "address",
            "phone",
            "email",
            "area",
            "city",
            "reviews_count",
            "rating",
            "website",
            "date_scraped",
            "status",
        ]
        with open(output_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(header)
        return

    fieldnames = list(rows[0].keys())
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
