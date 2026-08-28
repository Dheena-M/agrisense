"""
Baseline crop-leaf disease classifier.

IMPORTANT — read before a demo or before shipping this further:
This module classifies leaf photos using colour-distribution heuristics
(ratio of healthy green / brown-necrotic / yellow-chlorotic / dark-spot
pixels). It is a legitimate, deterministic image-analysis baseline —
NOT a trained deep-learning model — so treat its output as a working
placeholder for the real pipeline, not a clinically validated result.

To upgrade to a real trained classifier:
1. Download the PlantVillage dataset (Kaggle) — ~54k labelled leaf images.
2. Fine-tune a small pretrained CNN (MobileNetV2 / EfficientNet-B0) in
   TensorFlow or PyTorch — a few epochs on a free Colab GPU is enough.
3. Export the model (e.g. SavedModel / TorchScript) and replace the body
   of `analyze_leaf()` below with: load image -> preprocess -> model.predict
   -> map class index to DISEASE_PROFILES. Keep the same return shape so
   the API and frontend don't need to change.
"""

import io
from typing import Dict

import numpy as np
from PIL import Image

DISEASE_PROFILES: Dict[str, Dict] = {
    "Bacterial Leaf Blight": {
        "severity": "high",
        "tips": [
            "Remove and destroy infected leaves away from the field",
            "Avoid overhead irrigation; water at the base instead",
            "Improve field drainage to reduce standing water",
            "Consult a local agricultural officer before applying any treatment",
        ],
    },
    "Early Blight (Alternaria)": {
        "severity": "medium",
        "tips": [
            "Rotate crops each season to break the disease cycle",
            "Mulch soil to reduce spore splash onto lower leaves",
            "Remove lower, older leaves that show first symptoms",
            "Seek expert confirmation before broad treatment",
        ],
    },
    "Powdery Mildew": {
        "severity": "medium",
        "tips": [
            "Increase spacing between plants for better airflow",
            "Prune affected foliage and dispose of it away from crops",
            "Avoid excess nitrogen fertiliser, which encourages soft growth",
            "Monitor nearby plants for early spread",
        ],
    },
    "Healthy Leaf": {
        "severity": "none",
        "tips": [
            "No signs of disease detected in this sample",
            "Continue routine field monitoring on a weekly basis",
            "Maintain balanced watering and nutrient schedule",
            "Recheck if new spots or discoloration appear",
        ],
    },
}


def _masks(arr: np.ndarray):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    brightness = arr.mean(axis=2)

    green_mask = (g > r) & (g > b) & (g > 0.22)
    brown_mask = (r > 0.28) & (b < 0.35) & (r > b + 0.08) & (np.abs(r - g) < 0.20)
    yellow_mask = (r > 0.5) & (g > 0.5) & (b < 0.45) & (np.abs(r - g) < 0.12)
    dark_mask = (brightness < 0.20) & ~((r < 0.05) & (g < 0.05) & (b < 0.05))  # exclude pure black background

    return {
        "green": float(green_mask.mean()),
        "brown": float(brown_mask.mean()),
        "yellow": float(yellow_mask.mean()),
        "dark": float(dark_mask.mean()),
    }


def analyze_leaf(image_bytes: bytes) -> Dict:
    """Classify a leaf image and return {name, severity, confidence, tips}."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((256, 256))
    arr = np.asarray(img).astype(float) / 255.0
    m = _masks(arr)

    scores = {
        "Bacterial Leaf Blight": m["brown"] * 1.3 + m["dark"] * 0.7,
        "Early Blight (Alternaria)": m["brown"] * 0.9 + m["dark"] * 1.0,
        "Powdery Mildew": m["yellow"] * 1.2 + (1 - m["green"]) * 0.25,
        "Healthy Leaf": max(0.0, m["green"] * 1.35 - (m["brown"] + m["yellow"] + m["dark"]) * 1.6),
    }

    name = max(scores, key=scores.get)
    top_score = scores[name]

    # Map the raw heuristic score into a plausible confidence band.
    confidence = int(max(58, min(96, 58 + top_score * 90)))

    profile = DISEASE_PROFILES[name]
    return {
        "name": name,
        "severity": profile["severity"],
        "confidence": confidence,
        "tips": profile["tips"],
    }
