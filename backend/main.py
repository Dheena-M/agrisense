"""
AgriSense backend — FastAPI service for the Smart Agriculture dashboard.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Endpoints:
    POST /api/predict-disease   multipart image upload -> disease classification
    POST /api/crop-match        soil profile -> ranked crop list
    POST /api/yield-predict     crop + soil profile -> yield scenarios
    GET  /api/climate           lat, lon -> real temperature/rainfall forecast
    GET  /api/health            liveness check
"""

from typing import Optional

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from crop_data import rank_crops, yield_scenarios
from disease_model import analyze_leaf

app = FastAPI(title="AgriSense API", version="1.0.0")

# Wide-open CORS for hackathon convenience — tighten before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class SoilProfile(BaseModel):
    n: float = Field(..., ge=0, le=100, description="Nitrogen, kg/ha")
    p: float = Field(..., ge=0, le=100, description="Phosphorus, kg/ha")
    k: float = Field(..., ge=0, le=100, description="Potassium, kg/ha")
    ph: float = Field(..., ge=3, le=10, description="Soil pH")


class YieldRequest(SoilProfile):
    crop: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/predict-disease")
async def predict_disease(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    data = await image.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    try:
        result = analyze_leaf(data)
    except Exception:
        raise HTTPException(status_code=422, detail="Could not read this image. Try a clear JPG or PNG of a single leaf.")
    return result


@app.post("/api/crop-match")
def crop_match(soil: SoilProfile):
    return {"crops": rank_crops(soil.n, soil.p, soil.k, soil.ph)}


@app.post("/api/yield-predict")
def yield_predict(req: YieldRequest):
    return yield_scenarios(req.crop, req.n, req.p, req.k)


@app.get("/api/climate")
def climate(lat: float = 11.664, lon: float = 78.146):
    """
    Real short-range forecast from Open-Meteo (free, no API key).
    Falls back to a static seasonal estimate if the request fails
    (offline dev, blocked network, etc.) so the frontend never breaks.
    """
    try:
        resp = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,precipitation_sum",
                "timezone": "auto",
                "forecast_days": 7,
            },
            timeout=6,
        )
        resp.raise_for_status()
        daily = resp.json()["daily"]
        points = [
            {"label": day[5:], "temp": round(t), "rain": round(r)}
            for day, t, r in zip(daily["time"], daily["temperature_2m_max"], daily["precipitation_sum"])
        ]
        return {"source": "open-meteo", "points": points}
    except Exception:
        fallback = [
            {"label": "Mar", "temp": 31, "rain": 12},
            {"label": "Apr", "temp": 34, "rain": 18},
            {"label": "May", "temp": 36, "rain": 28},
            {"label": "Jun", "temp": 33, "rain": 74},
            {"label": "Jul", "temp": 30, "rain": 96},
            {"label": "Aug", "temp": 29, "rain": 88},
        ]
        return {"source": "fallback-estimate", "points": fallback}
