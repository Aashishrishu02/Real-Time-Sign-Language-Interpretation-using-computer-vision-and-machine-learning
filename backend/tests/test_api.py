import os
import json
import pytest
from fastapi.testclient import TestClient

# Ensure we import main after database file is configured
from main import app
from database import Base, engine, get_db

client = TestClient(app)

def test_get_settings():
    """
    Tests settings retrieval.
    """
    response = client.get("/api/settings")
    assert response.status_code == 200
    data = response.json()
    assert "language" in data
    assert "volume" in data
    assert "auto_speak" in data

def test_update_settings():
    """
    Tests settings updating.
    """
    payload = {
        "language": "Hindi",
        "volume": 0.8,
        "auto_speak": False
    }
    response = client.post("/api/settings", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "Hindi"
    assert data["volume"] == 0.8
    assert data["auto_speak"] is False

def test_dataset_status():
    """
    Tests dataset status endpoint.
    """
    response = client.get("/api/dataset/status")
    assert response.status_code == 200
    data = response.json()
    assert "total_samples" in data
    assert "labels_summary" in data

def test_analytics_summary():
    """
    Tests analytics summary endpoint.
    """
    response = client.get("/api/analytics/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_gestures" in data
    assert "average_confidence" in data
    assert "gesture_counts" in data

def test_predict_endpoint():
    """
    Tests prediction endpoint with mock landmark vectors (all 0s).
    """
    # 63 zeros representing coordinates
    landmarks = [0.0] * 63
    # Force joint 9 to be non-zero relative to wrist (0) to avoid division by zero scale
    landmarks[27] = 1.0 # joint 9 x
    landmarks[28] = 1.0 # joint 9 y
    landmarks[29] = 1.0 # joint 9 z
    
    response = client.post("/api/predict", json={"landmarks": landmarks})
    assert response.status_code == 200
    data = response.json()
    assert "gesture" in data
    assert "confidence" in data
    assert "success" in data
