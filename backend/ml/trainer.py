import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, confusion_matrix

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "ml", "models")
CSV_PATH = os.path.join(DATA_DIR, "gestures.csv")

# Create directories if they do not exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

GESTURES = ["Hello", "Thank You", "Yes", "No", "Help", "Water", "Food", "Stop", "Good", "Bad", "Neutral"]

def normalize_landmarks_numpy(coords):
    """
    Normalizes 21 landmarks (x, y, z) to be scale and translation invariant.
    Input coords is a numpy array of shape (21, 3).
    """
    # 1. Translation Invariance: subtract wrist (index 0)
    wrist = coords[0]
    coords_rel = coords - wrist
    
    # 2. Scale Invariance: divide by distance from wrist (0) to middle MCP (9)
    scale = np.linalg.norm(coords_rel[9])
    if scale == 0:
        scale = 1e-6
    coords_norm = coords_rel / scale
    
    return coords_norm.flatten()

def generate_gesture_coords(gesture):
    """
    Generates base landmark coordinates (21, 3) for a given gesture template.
    """
    coords = np.zeros((21, 3))
    
    # Helper to set finger landmarks
    # extended=True means finger points straight, False means folded
    def set_finger(start_idx, mcp_pos, is_extended, finger_dir):
        coords[start_idx] = mcp_pos
        dx, dy, dz = finger_dir
        for i in range(1, 4):
            factor = i * 0.15 if is_extended else i * 0.05
            # Bend folded finger slightly back
            if not is_extended and i >= 2:
                coords[start_idx + i] = coords[start_idx + i - 1] + np.array([dx*0.02, 0.05, dz*0.02])
            else:
                coords[start_idx + i] = coords[start_idx + i - 1] + np.array([dx*factor, dy*factor, dz*factor])

    # Configure thumb
    if gesture == "Good":
        set_finger(1, np.array([0.1, -0.1, 0.0]), True, (0.1, -0.8, 0.0))
    elif gesture == "Bad":
        set_finger(1, np.array([0.1, 0.1, 0.0]), True, (0.1, 0.8, 0.0))
    elif gesture in ["Hello", "Stop", "Thank You", "Help"]:
        set_finger(1, np.array([0.15, 0.02, 0.0]), True, (0.6, -0.2, 0.0))
    else: # Folded thumb
        set_finger(1, np.array([0.08, 0.02, 0.0]), False, (0.2, 0.1, 0.0))
        
    # Configure other fingers
    if gesture == "Stop":
        set_finger(5, np.array([0.08, -0.2, 0.0]), True, (0.05, -1.0, 0.0))
        set_finger(9, np.array([0.0, -0.22, 0.0]), True, (0.0, -1.0, 0.0))
        set_finger(13, np.array([-0.08, -0.2, 0.0]), True, (-0.05, -1.0, 0.0))
        set_finger(17, np.array([-0.15, -0.16, 0.0]), True, (-0.1, -1.0, 0.0))
    elif gesture == "Hello":
        set_finger(5, np.array([0.15, -0.2, 0.0]), True, (0.4, -0.9, 0.0))
        set_finger(9, np.array([0.0, -0.22, 0.0]), True, (0.0, -1.0, 0.0))
        set_finger(13, np.array([-0.15, -0.2, 0.0]), True, (-0.4, -0.9, 0.0))
        set_finger(17, np.array([-0.3, -0.16, 0.0]), True, (-0.8, -0.6, 0.0))
    elif gesture == "Thank You":
        set_finger(5, np.array([0.1, -0.15, 0.0]), True, (0.1, -0.7, -0.7))
        set_finger(9, np.array([0.0, -0.17, 0.0]), True, (0.0, -0.7, -0.7))
        set_finger(13, np.array([-0.1, -0.15, 0.0]), True, (-0.1, -0.7, -0.7))
        set_finger(17, np.array([-0.2, -0.12, 0.0]), True, (-0.2, -0.7, -0.7))
    elif gesture == "Help":
        set_finger(5, np.array([-0.1, 0.05, 0.0]), True, (-1.0, 0.0, 0.0))
        set_finger(9, np.array([-0.1, -0.05, 0.0]), True, (-1.0, 0.0, 0.0))
        set_finger(13, np.array([-0.1, -0.15, 0.0]), True, (-1.0, -0.05, 0.0))
        set_finger(17, np.array([-0.1, -0.25, 0.0]), True, (-1.0, -0.1, 0.0))
    elif gesture == "Yes":
        set_finger(5, np.array([0.1, -0.2, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(9, np.array([0.0, -0.22, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(13, np.array([-0.1, -0.2, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(17, np.array([-0.2, -0.16, 0.0]), False, (0.0, -0.2, 0.0))
    elif gesture == "No":
        set_finger(5, np.array([0.1, -0.2, 0.0]), True, (0.2, -1.0, 0.0))
        set_finger(9, np.array([0.0, -0.22, 0.0]), True, (-0.2, -1.0, 0.0))
        set_finger(13, np.array([-0.1, -0.2, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(17, np.array([-0.2, -0.16, 0.0]), False, (0.0, -0.2, 0.0))
    elif gesture == "Water":
        set_finger(5, np.array([0.1, -0.2, 0.0]), True, (0.2, -1.0, 0.0))
        set_finger(9, np.array([0.0, -0.22, 0.0]), True, (0.0, -1.0, 0.0))
        set_finger(13, np.array([-0.1, -0.2, 0.0]), True, (-0.2, -1.0, 0.0))
        set_finger(17, np.array([-0.2, -0.16, 0.0]), False, (0.0, -0.2, 0.0))
    elif gesture == "Food":
        set_finger(1, np.array([0.02, -0.05, 0.0]), False, (0.1, -0.3, 0.0))
        set_finger(5, np.array([0.03, -0.08, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(9, np.array([0.0, -0.09, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(13, np.array([-0.03, -0.08, 0.0]), False, (0.0, -0.2, 0.0))
        set_finger(17, np.array([-0.05, -0.07, 0.0]), False, (0.0, -0.2, 0.0))
        tip_target = np.array([0.0, -0.12, 0.0])
        coords[4] = tip_target + np.array([0.01, 0.0, 0.0])
        coords[8] = tip_target + np.array([0.0, 0.01, 0.0])
        coords[12] = tip_target
        coords[16] = tip_target + np.array([-0.01, 0.0, 0.0])
        coords[20] = tip_target + np.array([0.0, -0.01, 0.0])
    elif gesture == "Neutral":
        set_finger(1, np.array([0.08, -0.02, 0.0]), False, (0.3, -0.3, 0.0))
        set_finger(5, np.array([0.06, -0.12, 0.0]), False, (0.2, -0.5, 0.0))
        set_finger(9, np.array([0.0, -0.13, 0.0]), False, (0.0, -0.5, 0.0))
        set_finger(13, np.array([-0.06, -0.12, 0.0]), False, (-0.2, -0.5, 0.0))
        set_finger(17, np.array([-0.12, -0.1, 0.0]), False, (-0.4, -0.4, 0.0))
        
    return coords

def generate_single_synthetic_sequence(gesture):
    """
    Generates a single 1890-dimensional sequence trajectory (30 frames of 63 coordinates) for a gesture.
    Interpolates Neutral -> Peak Gesture -> Neutral to match continuous timing.
    """
    neutral_coords = generate_gesture_coords("Neutral")
    target_coords = generate_gesture_coords(gesture)
    
    sequence_flat = []
    for f in range(30):
        # Linear interpolation
        if f < 10:
            alpha = f / 10.0
        elif f < 20:
            alpha = 1.0
        else:
            alpha = (30 - f) / 10.0
            
        coords = (1 - alpha) * neutral_coords + alpha * target_coords
        
        # Add slight Gaussian noise
        noise = np.random.normal(0, 0.003, coords.shape)
        coords_noisy = coords + noise
        
        # Normalize
        flat_norm = normalize_landmarks_numpy(coords_noisy)
        sequence_flat.extend(flat_norm)
        
    return np.array(sequence_flat)

def generate_synthetic_data(num_samples_per_gesture=50):
    """
    Generates synthetic landmark data sequences for 11 gestures.
    Alternate X mirroring is applied to double training variety.
    """
    data = []
    
    for gesture in GESTURES:
        for i in range(num_samples_per_gesture):
            flat_norm = generate_single_synthetic_sequence(gesture)
            # Alternate X mirroring for left/right hand support
            if i % 2 == 1:
                flat_norm_temp = list(flat_norm)
                for idx in range(0, 1890, 3):
                    flat_norm_temp[idx] = -flat_norm_temp[idx]
                flat_norm = np.array(flat_norm_temp)
                
            row = [gesture] + list(flat_norm)
            data.append(row)
            
    # Write to gestures.csv
    cols = ["label"] + [f"lm_{i}" for i in range(1890)]
    df = pd.DataFrame(data, columns=cols)
    df.to_csv(CSV_PATH, index=False)
    print(f"Generated synthetic sequence dataset with {len(df)} rows at {CSV_PATH}")

def ensure_dataset_exists():
    """Checks if dataset exists, generates if not. Migrates old single-frame CSVs."""
    if os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0:
        try:
            df = pd.read_csv(CSV_PATH, nrows=5)
            if len(df.columns) < 1891:
                print("Detected legacy single-frame CSV dataset. Backing up and clearing to regenerate sequence-based dataset.")
                backup_path = CSV_PATH + ".bak"
                import shutil
                if os.path.exists(backup_path):
                    os.remove(backup_path)
                shutil.move(CSV_PATH, backup_path)
        except Exception as e:
            print(f"Error checking CSV columns: {e}")

    if not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0:
        generate_synthetic_data()

def train_model(csv_path=CSV_PATH):
    """
    Trains a PyTorch GestureLSTM model. Automatically balances classes up to 100 samples each
    using synthetic sequence templates. Duplicates all samples with X-axis mirroring.
    """
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader
    from ml.sequence_model import GestureLSTM
    
    ensure_dataset_exists()
    
    # Read dataset
    df = pd.read_csv(csv_path)
    
    # Organize existing samples
    existing_samples = {}
    for _, row in df.iterrows():
        label = row['label']
        features = list(row[1:])
        if label not in existing_samples:
            existing_samples[label] = []
        
        # Add original
        existing_samples[label].append(features)
        
        # Add mirrored version of recorded samples for left/right hand symmetry
        mirrored_features = features.copy()
        for idx in range(0, 1890, 3):
            mirrored_features[idx] = -mirrored_features[idx]
        existing_samples[label].append(mirrored_features)
        
    augmented_data = []
    target_samples = 100
    
    # Balance every class to exactly target_samples
    for gesture in GESTURES:
        samples = existing_samples.get(gesture, [])
        num_existing = len(samples)
        
        # Add existing samples (original + mirrored)
        for s in samples:
            augmented_data.append([gesture] + s)
            
        # Supplement with synthetic templates if we have fewer than target_samples
        if num_existing < target_samples:
            needed = target_samples - num_existing
            for i in range(needed):
                syn_feat = generate_single_synthetic_sequence(gesture)
                # Alternate mirroring for synthetic data
                if i % 2 == 1:
                    syn_feat_temp = list(syn_feat)
                    for idx in range(0, 1890, 3):
                        syn_feat_temp[idx] = -syn_feat_temp[idx]
                    syn_feat = np.array(syn_feat_temp)
                augmented_data.append([gesture] + list(syn_feat))
                
    cols = ["label"] + [f"lm_{i}" for i in range(1890)]
    df_augmented = pd.DataFrame(augmented_data, columns=cols)
    
    X = df_augmented.iloc[:, 1:].values.astype(np.float32)
    y = df_augmented.iloc[:, 0].values
    
    # Label mapping
    label_to_idx = {label: idx for idx, label in enumerate(GESTURES)}
    y_idx = np.array([label_to_idx[lbl] for lbl in y], dtype=np.int64)
    
    # Reshape features to (batch_size, sequence_length, features) -> (N, 30, 63)
    X_seq = X.reshape(-1, 30, 63)
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X_seq, y_idx, test_size=0.2, random_state=42, stratify=y_idx
    )
    
    # Create DataLoaders
    train_dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    
    # Instantiate Model
    model = GestureLSTM(input_dim=63, hidden_dim=64, num_layers=2, num_classes=len(GESTURES))
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.002)
    
    # Simple PyTorch training loop
    model.train()
    for epoch in range(15):
        for inputs, targets in train_loader:
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            loss.backward()
            optimizer.step()
            
    # Evaluation
    model.eval()
    with torch.no_grad():
        test_inputs = torch.tensor(X_test)
        test_outputs = model(test_inputs)
        y_pred = torch.argmax(test_outputs, dim=1).numpy()
        
    accuracy = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)
    
    unique_idx = sorted(list(set(y_idx)))
    unique_labels = [GESTURES[idx] for idx in unique_idx]
    
    # Confusion matrix
    cm = confusion_matrix(y_test, y_pred, labels=unique_idx)
    cm_list = cm.tolist()
    
    # Save active model (.pt format)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    model_name = f"model_{timestamp}"
    model_path = os.path.join(MODELS_DIR, f"{model_name}.pt")
    active_path = os.path.join(MODELS_DIR, "active_model.pt")
    
    torch.save(model.state_dict(), model_path)
    torch.save(model.state_dict(), active_path)
    
    # Clean up any old joblib model if it exists
    legacy_joblib_active = os.path.join(MODELS_DIR, "active_model.joblib")
    if os.path.exists(legacy_joblib_active):
        os.remove(legacy_joblib_active)
        
    return {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "confusion_matrix": cm_list,
        "model_name": model_name,
        "labels": unique_labels
    }
