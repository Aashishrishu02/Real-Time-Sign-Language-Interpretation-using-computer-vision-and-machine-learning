import os
import pytest
import numpy as np
import torch
from fastapi.testclient import TestClient
from main import app
from database import Base, engine, get_db
from ml.sequence_model import GestureLSTM
from ml.predictor import predictor
from ml.trainer import GESTURES

client = TestClient(app)

def test_gesture_lstm_forward():
    """
    Validates that the GestureLSTM forward pass handles inputs of shape [batch, 30, 63]
    and produces [batch, 11] class logits.
    """
    model = GestureLSTM(input_dim=63, hidden_dim=64, num_layers=2, num_classes=11)
    # Batch size of 4, sequence length of 30, features 63
    dummy_input = torch.randn(4, 30, 63)
    outputs = model(dummy_input)
    assert outputs.shape == (4, 11)

def test_predict_sequence_endpoint():
    """
    Tests the sequence prediction endpoint `/api/predict/sequence` with 1890 features.
    """
    # 1890 zeros representing coordinates (30 frames x 63)
    landmarks_seq = [0.0] * 1890
    
    # Establish wrist relative points for scale normalization checks
    # Index 0 is frame 0 wrist, Index 9 * 3 is frame 0 MCP 9
    landmarks_seq[9 * 3] = 1.0
    landmarks_seq[9 * 3 + 1] = 1.0
    landmarks_seq[9 * 3 + 2] = 1.0
    
    payload = {"landmarks_seq": landmarks_seq}
    response = client.post("/api/predict/sequence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "gesture" in data
    assert "confidence" in data
    assert "success" in data
    assert data["success"] is True

def test_record_sequence_endpoint():
    """
    Tests the dataset sequence recording endpoint `/api/dataset/record-sequence`.
    """
    landmarks_seq = [0.0] * 1890
    payload = {
        "label": "Hello",
        "landmarks_seq": landmarks_seq
    }
    response = client.post("/api/dataset/record-sequence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "total_samples" in data
    assert "labels_summary" in data

def test_translate_endpoint():
    """
    Tests the bilingual translation endpoint `/api/translate`.
    """
    # English -> Hindi
    payload = {
        "text": "Hello Stop Water",
        "target_language": "Hindi"
    }
    response = client.post("/api/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "नमस्ते" in data["translated_text"]
    assert "रुकिए" in data["translated_text"]
    assert "पानी" in data["translated_text"]

    # Hindi -> English
    payload = {
        "text": "नमस्ते रुकिए पानी",
        "target_language": "English"
    }
    response = client.post("/api/translate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Hello" in data["translated_text"]
    assert "Stop" in data["translated_text"]
    assert "Water" in data["translated_text"]

def test_conversation_history_endpoints():
    """
    Tests GET, POST, and DELETE conversation history endpoints.
    """
    # 1. Clear first to ensure a clean state
    response = client.delete("/api/history")
    assert response.status_code == 200

    # 2. Add history record
    payload = {
        "transcript": "Hello Water Thank You",
        "translation": "नमस्ते पानी धन्यवाद",
        "language": "Hindi"
    }
    response = client.post("/api/history", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["transcript"] == "Hello Water Thank You"
    assert data["translation"] == "नमस्ते पानी धन्यवाद"
    assert data["language"] == "Hindi"
    assert "id" in data

    # 3. List history records
    response = client.get("/api/history")
    assert response.status_code == 200
    history = response.json()
    assert len(history) >= 1
    assert history[0]["transcript"] == "Hello Water Thank You"

    # 4. Clear history
    response = client.delete("/api/history")
    assert response.status_code == 200
    
    # 5. Verify cleared
    response = client.get("/api/history")
    assert response.status_code == 200
    assert len(response.json()) == 0
