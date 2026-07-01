import json
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_websocket_prediction():
    """
    Tests the real-time WebSocket prediction loop with a simulated 1890-coordinate landmark sequence.
    """
    with client.websocket_connect("/api/ws/predict") as websocket:
        # Prepare 1890 flat coordinates (30 frames of 63 values)
        landmarks_seq = [0.0] * 1890
        
        # Set non-zero scale references (joint 9 relative to wrist 0) for each of the 30 frames
        # to prevent division-by-zero errors in landmark normalization
        for frame in range(30):
            base_idx = frame * 63
            landmarks_seq[base_idx + 27] = 1.0  # joint 9 x
            landmarks_seq[base_idx + 28] = 1.0  # joint 9 y
            landmarks_seq[base_idx + 29] = 1.0  # joint 9 z
            
        # Send coordinates to WebSocket endpoint
        websocket.send_text(json.dumps({"landmarks_seq": landmarks_seq}))
        
        # Receive and assert response
        response = websocket.receive_json()
        assert response["success"] is True
        assert "gesture" in response
        assert "confidence" in response
        assert "translated_text" in response
        
        # Verify invalid input size is caught and handled
        websocket.send_text(json.dumps({"landmarks_seq": [0.0] * 100}))
        response_error = websocket.receive_json()
        assert response_error["success"] is False
        assert "error" in response_error
