import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from ml.trainer import GESTURES, generate_synthetic_data, normalize_landmarks_numpy

# Synthesize a single hand for each of the confused gestures and inspect values
coords_hello = np.zeros((21, 3))
coords_stop = np.zeros((21, 3))
coords_thanks = np.zeros((21, 3))
coords_help = np.zeros((21, 3))

def set_finger(coords, start_idx, mcp_pos, is_extended, finger_dir):
    coords[start_idx] = mcp_pos
    dx, dy, dz = finger_dir
    for i in range(1, 4):
        factor = i * 0.15 if is_extended else i * 0.05
        if not is_extended and i >= 2:
            coords[start_idx + i] = coords[start_idx + i - 1] + np.array([dx*0.02, 0.05, dz*0.02])
        else:
            coords[start_idx + i] = coords[start_idx + i - 1] + np.array([dx*factor, dy*factor, dz*factor])

# Stop
set_finger(coords_stop, 5, np.array([0.08, -0.2, 0.0]), True, (0.05, -1.0, 0.0))
set_finger(coords_stop, 9, np.array([0.0, -0.22, 0.0]), True, (0.0, -1.0, 0.0))
set_finger(coords_stop, 13, np.array([-0.08, -0.2, 0.0]), True, (-0.05, -1.0, 0.0))
set_finger(coords_stop, 17, np.array([-0.15, -0.16, 0.0]), True, (-0.1, -1.0, 0.0))

# Hello
set_finger(coords_hello, 5, np.array([0.15, -0.2, 0.0]), True, (0.4, -0.9, 0.0))
set_finger(coords_hello, 9, np.array([0.0, -0.22, 0.0]), True, (0.0, -1.0, 0.0))
set_finger(coords_hello, 13, np.array([-0.15, -0.2, 0.0]), True, (-0.4, -0.9, 0.0))
set_finger(coords_hello, 17, np.array([-0.3, -0.16, 0.0]), True, (-0.8, -0.6, 0.0))

# Thank You
set_finger(coords_thanks, 5, np.array([0.1, -0.15, 0.0]), True, (0.1, -0.7, -0.7))
set_finger(coords_thanks, 9, np.array([0.0, -0.17, 0.0]), True, (0.0, -0.7, -0.7))
set_finger(coords_thanks, 13, np.array([-0.1, -0.15, 0.0]), True, (-0.1, -0.7, -0.7))
set_finger(coords_thanks, 17, np.array([-0.2, -0.12, 0.0]), True, (-0.2, -0.7, -0.7))

# Help
set_finger(coords_help, 5, np.array([-0.1, 0.05, 0.0]), True, (-1.0, 0.0, 0.0))
set_finger(coords_help, 9, np.array([-0.1, -0.05, 0.0]), True, (-1.0, 0.0, 0.0))
set_finger(coords_help, 13, np.array([-0.1, -0.15, 0.0]), True, (-1.0, -0.05, 0.0))
set_finger(coords_help, 17, np.array([-0.1, -0.25, 0.0]), True, (-1.0, -0.1, 0.0))

# Normalize
norm_stop = normalize_landmarks_numpy(coords_stop)
norm_hello = normalize_landmarks_numpy(coords_hello)
norm_thanks = normalize_landmarks_numpy(coords_thanks)
norm_help = normalize_landmarks_numpy(coords_help)

# Print a subset of landmarks to compare (e.g. Index Tip lm_15, lm_16, lm_17 which corresponds to tip of index finger)
# start_idx = 5 is index MCP, start_idx+3 = 8 is TIP.
# Coordinates are at indices 24, 25, 26 (TIP 8 x, y, z) in the flat array.
print("Index Finger TIP (x, y, z) after normalization:")
print(f"Stop:       {[round(x, 2) for x in norm_stop[24:27]]}")
print(f"Hello:      {[round(x, 2) for x in norm_hello[24:27]]}")
print(f"Thanks:     {[round(x, 2) for x in norm_thanks[24:27]]}")
print(f"Help:       {[round(x, 2) for x in norm_help[24:27]]}")

print("\nPinky Finger TIP (x, y, z) after normalization:")
# start_idx = 17 is Pinky MCP, start_idx+3 = 20 is TIP.
# Coordinates are at indices 60, 61, 62 in flat array.
print(f"Stop:       {[round(x, 2) for x in norm_stop[60:63]]}")
print(f"Hello:      {[round(x, 2) for x in norm_hello[60:63]]}")
print(f"Thanks:     {[round(x, 2) for x in norm_thanks[60:63]]}")
print(f"Help:       {[round(x, 2) for x in norm_help[60:63]]}")
