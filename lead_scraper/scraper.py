from __future__ import annotations

import argparse
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List

from lead_scraper.db import CityArea, QualifiedLead, init_db, make_engine, make_session
from lead_scraper.google_places import GooglePlacesClient
from lead_scraper.utils import (
    LOG_FILE,
    compute_business_age_years,
    ensure_log_dir,
    export_leads_to_csv,
)


logger = logging.getLogger("lead_scraper")


def setup_logging() -> None:
    ensure_log_dir()
    logger.setLevel(logging.INFO)

    # File handler
    fh = logging.FileHandler(LOG_FILE, encoding="utf-8")
    fh.setLevel(logging.INFO)
    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    fh.setFormatter(fmt)

    # Console handler
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)

    logger.handlers.clear()
    logger.addHandler(fh)
    logger.addHandler(ch)


def load_config(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_city_areas(db, city: str, areas: List[str]) -> None:
    existing = {(ca.city, ca.area): ca for ca in db.query(CityArea).filter(CityArea.city == city).all()}
    for area in areas:
        if (city, area) not in existing:
            db.add(CityArea(city=city, area=area, status="pending"))
    db.commit()


def process_area(db, client: GooglePlacesClient, city: str, area: str, reviews_threshold: int, per_area_limit: int) -> int:
    logger.info(f"Processing area '{area}' in city '{city}' ...")
    # Mark area in_progress
    area_row = (
        db.query(CityArea)
        .filter(CityArea.city == city, CityArea.area == area)
        .one()
    )
    area_row.status = "in_progress"
    db.commit()

    # Collect candidates
    candidates = client.search_area_places(city, area, per_area_limit=per_area_limit)
    logger.info(f"Collected {len(candidates)} place candidates for area {area}")

    qualified = 0

    for c in candidates:
        try:
            details = client.details(c.place_id)
        except Exception as e:
            logger.warning(f"Details failed for {c.place_id}: {e}")
            continue

        website = (details.website or "").strip()
        # Qualify ONLY businesses with no website
        if website:
            continue

        reviews_count = details.reviews_count or 0
        if reviews_count <= reviews_threshold:
            continue

        # Without a website, approximate age from earliest review timestamps only
        age_years, age_method = compute_business_age_years(None, details.reviews_times)
        if age_years is None or age_years < 1.0:
            continue

        lead = QualifiedLead(
            business_name=details.name or c.name,
            address=details.address,
            phone=details.phone,
            email=None,
            area=area,
            city=city,
            reviews_count=reviews_count,
            rating=details.rating,
            website=None,
            date_scraped=datetime.now(tz=timezone.utc),
            status="qualified",
        )
        db.add(lead)
        qualified += 1

    db.commit()

    area_row.status = "completed"
    area_row.last_run_at = datetime.now(tz=timezone.utc)
    db.commit()

    logger.info(f"Area '{area}' completed. Qualified leads saved: {qualified}")
    return qualified


def export_city_csv(db, city: str) -> str:
    rows = (
        db.query(QualifiedLead)
        .filter(QualifiedLead.city == city, QualifiedLead.status == "qualified")
        .all()
    )
    serialised = [
        {
            "business_name": r.business_name,
            "address": r.address,
            "phone": r.phone,
            "email": r.email,
            "area": r.area,
            "city": r.city,
            "reviews_count": r.reviews_count,
            "rating": r.rating,
            "website": r.website,
            "date_scraped": r.date_scraped.isoformat() if r.date_scraped else None,
            "status": r.status,
        }
        for r in rows
    ]
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    city_slug = city.lower().replace(",", "").replace(" ", "_")
    output_path = os.path.join("exports", f"{city_slug}_qualified_leads_{ts}.csv")
    export_leads_to_csv(serialised, output_path)
    logger.info(f"Exported {len(serialised)} leads to {output_path}")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Local Business Lead Scraper (Google Places)")
    parser.add_argument("--config", required=True, help="Path to config.json")
    parser.add_argument("--city", required=False, help="Override city from config")
    args = parser.parse_args()

    setup_logging()

    cfg = load_config(args.config)
    city = args.city or cfg.get("city")
    if not city:
        raise SystemExit("City must be provided either via --city or in config.json")
    areas = cfg.get("areas") or []
    if not areas:
        raise SystemExit("Areas list is empty; provide areas/ZIPs in config.json")
    reviews_threshold = int(cfg.get("reviews_threshold", 10))
    per_area_limit = int(cfg.get("per_area_limit", 100))

    # DB
    engine = make_engine(cfg["mysql"])  # database must already exist
    init_db(engine)
    db = make_session(engine)

    # Seed area rows
    seed_city_areas(db, city, areas)

    # API client
    api_key = cfg.get("google_api_key")
    if not api_key:
        raise SystemExit("google_api_key missing in config.json")
    client = GooglePlacesClient(api_key)

    # Process each pending area
    total_qualified = 0
    for area in areas:
        area_row = (
            db.query(CityArea)
            .filter(CityArea.city == city, CityArea.area == area)
            .one()
        )
        if area_row.status == "completed":
            logger.info(f"Skipping area '{area}' (already completed)")
            continue
        try:
            total_qualified += process_area(db, client, city, area, reviews_threshold, per_area_limit)
        except Exception as e:
            logger.exception(f"Area '{area}' failed: {e}")
            area_row.status = "failed"
            db.commit()

    # Export CSV
    export_city_csv(db, city)


if __name__ == "__main__":
    main()
