import sys
import os
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ml.trainer import CSV_PATH, GESTURES, generate_single_synthetic_sequence
from ml.sequence_model import GestureLSTM

# Load dataset
df = pd.read_csv(CSV_PATH)

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

label_to_idx = {label: idx for idx, label in enumerate(GESTURES)}
y_idx = np.array([label_to_idx[lbl] for lbl in y], dtype=np.int64)

# Reshape features to (batch_size, sequence_length, features) -> (N, 30, 63)
X_seq = X.reshape(-1, 30, 63)

print(f"Original dataset shape: {df.shape}")
print(f"Augmented features shape: {X_seq.shape}")
print("Augmented label distribution:")
print(df_augmented["label"].value_counts())

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

print("\nTraining GestureLSTM on augmented dataset...")
model.train()
for epoch in range(10):
    epoch_loss = 0
    for inputs, targets in train_loader:
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)
        loss.backward()
        optimizer.step()
        epoch_loss += loss.item()
    print(f"Epoch {epoch+1}/10 - Loss: {epoch_loss/len(train_loader):.4f}")

model.eval()
with torch.no_grad():
    test_inputs = torch.tensor(X_test)
    test_outputs = model(test_inputs)
    y_pred = torch.argmax(test_outputs, dim=1).numpy()

# Convert back to labels for report
y_test_labels = [GESTURES[idx] for idx in y_test]
y_pred_labels = [GESTURES[idx] for idx in y_pred]
unique_labels = GESTURES

print("\nClassification Report:")
print(classification_report(y_test_labels, y_pred_labels, zero_division=0))

print("\nConfusion Matrix Labels Order:")
print(unique_labels)
print("\nConfusion Matrix:")
print(confusion_matrix(y_test_labels, y_pred_labels, labels=unique_labels))
