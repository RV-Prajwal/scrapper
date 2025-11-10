from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Set, Tuple

import requests


GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
GOOGLE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"


@dataclass
class PlaceSummary:
    place_id: str
    name: str
    lat: float
    lng: float


@dataclass
class PlaceDetails:
    place_id: str
    name: str
    address: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    rating: Optional[float]
    reviews_count: Optional[int]
    reviews_times: List[int]  # unix epoch seconds


class GooglePlacesClient:
    def __init__(self, api_key: str, session: Optional[requests.Session] = None, per_request_sleep: float = 0.0):
        self.api_key = api_key
        self.http = session or requests.Session()
        self.per_request_sleep = per_request_sleep

    def _request(self, url: str, params: Dict) -> Dict:
        params = {**params, "key": self.api_key}
        resp = self.http.get(url, params=params, timeout=30)
        if self.per_request_sleep:
            time.sleep(self.per_request_sleep)
        resp.raise_for_status()
        data = resp.json()
        status = data.get("status")
        if status in {"OK", "ZERO_RESULTS"}:
            return data
        if status == "INVALID_REQUEST":
            # Often happens when next_page_token isn't ready. Caller should sleep and retry.
            return data
        if status == "OVER_QUERY_LIMIT":
            # Respectful backoff
            time.sleep(2)
            return data
        raise RuntimeError(f"Google API error: {status} | {data.get('error_message')}")

    def geocode_area(self, area_label: str) -> Tuple[float, float, Optional[Dict]]:
        data = self._request(GOOGLE_GEOCODE_URL, {"address": area_label})
        results = data.get("results", [])
        if not results:
            raise ValueError(f"No geocode results for '{area_label}'")
        r0 = results[0]
        loc = r0["geometry"]["location"]
        viewport = r0["geometry"].get("viewport")
        return loc["lat"], loc["lng"], viewport

    def _nearby_once(self, location: Tuple[float, float], radius_m: int) -> Dict:
        lat, lng = location
        params = {"location": f"{lat},{lng}", "radius": radius_m, "type": "establishment"}
        return self._request(GOOGLE_NEARBY_URL, params)

    def nearby_search_collect(self, center: Tuple[float, float], radius_m: int, max_pages: int = 3) -> List[Dict]:
        """Run Nearby Search at a point, collecting up to 60 results (3 pages)."""
        data = self._nearby_once(center, radius_m)
        results = list(data.get("results", []))
        next_page_token = data.get("next_page_token")
        pages = 1
        while next_page_token and pages < max_pages:
            time.sleep(2.0)  # required for token to activate
            data = self._request(GOOGLE_NEARBY_URL, {"pagetoken": next_page_token})
            if data.get("status") == "INVALID_REQUEST":
                # token not ready; wait and try again
                time.sleep(2.0)
                continue
            results.extend(data.get("results", []))
            next_page_token = data.get("next_page_token")
            pages += 1
        return results

    def details(self, place_id: str) -> PlaceDetails:
        fields = (
            "name,formatted_address,formatted_phone_number,"
            "international_phone_number,website,rating,user_ratings_total,reviews"
        )
        data = self._request(GOOGLE_DETAILS_URL, {"place_id": place_id, "fields": fields})
        result = data.get("result", {})
        phone = result.get("international_phone_number") or result.get("formatted_phone_number")
        reviews = result.get("reviews", [])
        review_times = [int(r.get("time")) for r in reviews if r.get("time") is not None]
        return PlaceDetails(
            place_id=place_id,
            name=result.get("name"),
            address=result.get("formatted_address"),
            phone=phone,
            website=result.get("website"),
            rating=(float(result["rating"]) if result.get("rating") is not None else None),
            reviews_count=(int(result["user_ratings_total"]) if result.get("user_ratings_total") is not None else None),
            reviews_times=review_times,
        )

    @staticmethod
    def _grid_points(viewport: Optional[Dict], fallback_center: Tuple[float, float], steps: int = 4) -> List[Tuple[float, float]]:
        if not viewport:
            return [fallback_center]
        ne = viewport["northeast"]
        sw = viewport["southwest"]
        min_lat, max_lat = sw["lat"], ne["lat"]
        min_lng, max_lng = sw["lng"], ne["lng"]
        lats = [min_lat + i * (max_lat - min_lat) / (steps - 1) for i in range(steps)]
        lngs = [min_lng + j * (max_lng - min_lng) / (steps - 1) for j in range(steps)]
        points = [(lat, lng) for lat in lats for lng in lngs]
        return points

    @staticmethod
    def _cell_radius_m(viewport: Optional[Dict], steps: int = 4, at_lat: Optional[float] = None) -> int:
        if not viewport:
            return 1500
        ne = viewport["northeast"]
        sw = viewport["southwest"]
        lat_span = abs(ne["lat"] - sw["lat"]) / steps
        lng_span = abs(ne["lng"] - sw["lng"]) / steps
        lat_m = lat_span * 111320.0
        base_lat = at_lat if at_lat is not None else (ne["lat"] + sw["lat"]) / 2.0
        lng_m = lng_span * 111320.0 * math.cos(math.radians(base_lat))
        diagonal = math.sqrt(lat_m ** 2 + lng_m ** 2)
        radius = max(500, min(2000, int(diagonal / 2)))
        return radius

    def search_area_places(self, city: str, area: str, per_area_limit: int = 100) -> List[PlaceSummary]:
        area_label = f"{area}, {city}"
        lat, lng, viewport = self.geocode_area(area_label)
        grid = self._grid_points(viewport, (lat, lng), steps=4)
        radius = self._cell_radius_m(viewport, steps=4, at_lat=lat)

        collected: Dict[str, PlaceSummary] = {}
        for point in grid:
            results = self.nearby_search_collect(point, radius)
            for r in results:
                pid = r.get("place_id")
                if not pid or pid in collected:
                    continue
                gloc = r.get("geometry", {}).get("location", {})
                collected[pid] = PlaceSummary(
                    place_id=pid,
                    name=r.get("name", ""),
                    lat=float(gloc.get("lat") or 0.0),
                    lng=float(gloc.get("lng") or 0.0),
                )
                if len(collected) >= per_area_limit:
                    break
            if len(collected) >= per_area_limit:
                break
        return list(collected.values())
