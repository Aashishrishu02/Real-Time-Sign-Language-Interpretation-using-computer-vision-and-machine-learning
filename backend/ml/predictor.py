import os
import torch
import numpy as np
from ml.trainer import normalize_landmarks_numpy, MODELS_DIR, train_model, GESTURES
from ml.sequence_model import GestureLSTM

ACTIVE_MODEL_PATH = os.path.join(MODELS_DIR, "active_model.pt")

class GesturePredictor:
    def __init__(self):
        self.model = None
        self._load_active_model()
        
    def _load_active_model(self):
        """Loads active PyTorch model from disk. Trains a default model if none exists."""
        if os.path.exists(ACTIVE_MODEL_PATH):
            try:
                # Instantiate GestureLSTM
                model = GestureLSTM(input_dim=63, hidden_dim=64, num_layers=2, num_classes=len(GESTURES))
                # Load state dict
                state_dict = torch.load(ACTIVE_MODEL_PATH, map_location=torch.device('cpu'))
                model.load_state_dict(state_dict)
                model.eval()
                self.model = model
                print("Active PyTorch LSTM model loaded successfully.")
            except Exception as e:
                print(f"Error loading PyTorch model: {e}. Attempting to retrain.")
                self._train_and_load_default()
        else:
            print("No active PyTorch model found. Training default synthetic sequence model.")
            self._train_and_load_default()

    def _train_and_load_default(self):
        """Trains a default model and loads it."""
        try:
            metrics = train_model()
            # Instantiate GestureLSTM
            model = GestureLSTM(input_dim=63, hidden_dim=64, num_layers=2, num_classes=len(GESTURES))
            state_dict = torch.load(ACTIVE_MODEL_PATH, map_location=torch.device('cpu'))
            model.load_state_dict(state_dict)
            model.eval()
            self.model = model
            print(f"Default sequence model trained and loaded: {metrics['model_name']} (Accuracy: {metrics['accuracy']:.2f})")
        except Exception as e:
            print(f"Failed to train fallback sequence model: {e}")
            self.model = None

    def reload(self, model_name=None):
        """Reloads model, either specific model_name or the active_model."""
        if model_name:
            target_path = os.path.join(MODELS_DIR, f"{model_name}.pt")
        else:
            target_path = ACTIVE_MODEL_PATH
            
        if os.path.exists(target_path):
            try:
                model = GestureLSTM(input_dim=63, hidden_dim=64, num_layers=2, num_classes=len(GESTURES))
                state_dict = torch.load(target_path, map_location=torch.device('cpu'))
                model.load_state_dict(state_dict)
                model.eval()
                self.model = model
                
                # If loaded a specific model, also write it as active_model.pt
                if model_name:
                    torch.save(state_dict, ACTIVE_MODEL_PATH)
                return True
            except Exception as e:
                print(f"Error reloading model: {e}")
                return False
        return False

    def predict(self, sequence_flat):
        """
        Takes 1890 flat coordinates (30 frames x 63 landmarks), normalizes each frame,
        and returns (label, confidence) using the PyTorch LSTM network.
        """
        if self.model is None:
            self._load_active_model()
            if self.model is None:
                return "Unknown", 0.0
                
        try:
            # Reshape raw sequence landmarks to (30, 21, 3)
            raw_seq = np.array(sequence_flat).reshape(30, 21, 3)
            
            # Normalize each frame individually
            normalized_seq = []
            for frame_coords in raw_seq:
                flat_norm = normalize_landmarks_numpy(frame_coords)
                normalized_seq.append(flat_norm)
                
            # Convert sequence to PyTorch tensor shape (1, 30, 63) -> [batch, sequence, features]
            tensor_seq = torch.tensor([normalized_seq], dtype=torch.float32)
            
            # Predict
            with torch.no_grad():
                outputs = self.model(tensor_seq)
                probabilities = torch.softmax(outputs, dim=1).numpy()[0]
                class_idx = np.argmax(probabilities)
                
            gesture = GESTURES[class_idx]
            confidence = float(probabilities[class_idx])
            
            return gesture, confidence
        except Exception as e:
            print(f"LSTM Sequence Prediction error: {e}")
            return "Error", 0.0

# Singleton instance
predictor = GesturePredictor()
