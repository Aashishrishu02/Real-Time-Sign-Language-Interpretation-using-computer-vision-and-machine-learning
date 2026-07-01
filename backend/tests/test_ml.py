import numpy as np
import pytest
from ml.trainer import normalize_landmarks_numpy, generate_synthetic_data, CSV_PATH
from ml.predictor import predictor

def test_landmark_normalization_translation_invariance():
    """
    Tests that translating coordinates by a random offset yields identical normalized coordinates.
    """
    # 21 random 3D landmarks
    coords = np.random.rand(21, 3)
    coords_normalized = normalize_landmarks_numpy(coords)
    
    # Translate
    offset = np.array([2.5, -4.8, 10.1])
    coords_translated = coords + offset
    coords_translated_normalized = normalize_landmarks_numpy(coords_translated)
    
    # Check close match
    assert np.allclose(coords_normalized, coords_translated_normalized, atol=1e-5)

def test_landmark_normalization_scale_invariance():
    """
    Tests that scaling coordinates by a random factor yields identical normalized coordinates.
    """
    # 21 random 3D landmarks (ensuring joint 9 isn't 0 relative to wrist)
    coords = np.random.rand(21, 3)
    coords[9] = coords[0] + np.array([0.5, 0.5, 0.5])
    
    coords_normalized = normalize_landmarks_numpy(coords)
    
    # Scale relative to wrist (point 0)
    wrist = coords[0]
    coords_rel = coords - wrist
    
    scale_factor = 3.5
    coords_scaled = wrist + (coords_rel * scale_factor)
    coords_scaled_normalized = normalize_landmarks_numpy(coords_scaled)
    
    # Check close match
    assert np.allclose(coords_normalized, coords_scaled_normalized, atol=1e-5)

def test_synthetic_data_generation():
    """
    Tests that the synthetic data generator constructs a CSV file with 10 labels.
    """
    import os
    if os.path.exists(CSV_PATH):
        os.remove(CSV_PATH)
        
    generate_synthetic_data(num_samples_per_gesture=2)
    
    assert os.path.exists(CSV_PATH)
    assert os.path.getsize(CSV_PATH) > 0
    
    # Verify contents
    import pandas as pd
    from ml.trainer import GESTURES
    df = pd.read_csv(CSV_PATH)
    assert len(df) == len(GESTURES) * 2
    assert "label" in df.columns
    assert len(df.columns) == 1891 # label + 1890 features
