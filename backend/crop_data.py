"""
Reference crop data and the rule-based scoring used for crop matching
and yield simulation.

This mirrors the logic already used in the frontend mock so the backend
becomes the single source of truth. Swap CROPS or the scoring formula
for a trained regression model later without changing the API shape.
"""

from typing import Dict, List

CROPS: List[Dict] = [
    {"name": "Rice (Paddy)", "icon": "🌾", "n": 80, "p": 45, "k": 40, "ph": (5.5, 6.5), "rain": "high"},
    {"name": "Sugarcane", "icon": "🎋", "n": 70, "p": 55, "k": 60, "ph": (6.0, 7.5), "rain": "high"},
    {"name": "Groundnut", "icon": "🥜", "n": 35, "p": 55, "k": 45, "ph": (6.0, 7.0), "rain": "medium"},
    {"name": "Cotton", "icon": "🌱", "n": 55, "p": 40, "k": 35, "ph": (6.0, 8.0), "rain": "medium"},
    {"name": "Maize", "icon": "🌽", "n": 65, "p": 40, "k": 40, "ph": (5.8, 7.0), "rain": "medium"},
    {"name": "Millet (Ragi)", "icon": "🌿", "n": 30, "p": 25, "k": 25, "ph": (5.0, 7.5), "rain": "low"},
]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def score_crop(crop: Dict, n: float, p: float, k: float, ph: float) -> int:
    """Weighted-distance match score (0-100) between a soil profile and a crop's needs."""
    d_n = 100 - min(100, abs(crop["n"] - n) * 1.4)
    d_p = 100 - min(100, abs(crop["p"] - p) * 1.4)
    d_k = 100 - min(100, abs(crop["k"] - k) * 1.4)
    ph_low, ph_high = crop["ph"]
    ph_ok = (ph_low - 0.6) <= ph <= (ph_high + 0.6)
    ph_score = 100 if ph_ok else 55
    match = round((d_n + d_p + d_k + ph_score) / 4)
    return int(_clamp(match, 30, 98))


def rank_crops(n: float, p: float, k: float, ph: float) -> List[Dict]:
    ranked = []
    for crop in CROPS:
        match = score_crop(crop, n, p, k, ph)
        ranked.append({
            "name": crop["name"],
            "icon": crop["icon"],
            "match": match,
            "rain": crop["rain"],
            "ph_range": list(crop["ph"]),
        })
    ranked.sort(key=lambda c: c["match"], reverse=True)
    return ranked


def yield_scenarios(crop_name: str, n: float, p: float, k: float) -> Dict:
    crop = next((c for c in CROPS if c["name"] == crop_name), CROPS[0])
    d_n = 100 - min(100, abs(crop["n"] - n) * 1.4)
    d_p = 100 - min(100, abs(crop["p"] - p) * 1.4)
    d_k = 100 - min(100, abs(crop["k"] - k) * 1.4)
    base = round((d_n + d_p + d_k) / 3)
    expected = int(_clamp(base, 25, 95))
    return {
        "crop": crop["name"],
        "scenarios": [
            {"name": "Low rainfall", "value": int(_clamp(expected - 22, 15, 100))},
            {"name": "Expected", "value": expected},
            {"name": "Favourable", "value": int(_clamp(expected + 18, 0, 97))},
        ],
    }
