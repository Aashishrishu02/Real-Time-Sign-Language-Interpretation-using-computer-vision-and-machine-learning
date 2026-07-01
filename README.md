# SignSpeak AI - Real-Time Sign Language Recognition & Interpretation System

SignSpeak AI is an AI-powered web application that detects hand gestures using a webcam and translates sign language into text and speech in real-time. It is designed to bridge the communication gap between deaf/mute individuals and those who do not understand sign language.

---

## Tech Stack

### Frontend
- **React.js** (Vite scaffolded)
- **Tailwind CSS** (v3, styling & utility-first styling)
- **Framer Motion** (smooth transitions and animations)
- **MediaPipe Hands** (CDN-loaded client-side browser hand landmark tracker)
- **Web Speech API** (built-in browser speech synthesizer with English & Hindi support)

### Backend
- **FastAPI** (Uvicorn HTTP engine)
- **SQLAlchemy & SQLite** (local lightweight relational database storing recognition history, trained checkpoints, and preferences)

### AI/ML
- **Scikit-Learn** (RandomForestClassifier)
- **NumPy & Pandas** (matrix normalization & coordinate compilation)
- **Joblib** (binary serialization of ML weights)

---

## System Architecture

```
Webcam (Browser)
   ↓
MediaPipe Hand Detection (21 points)
   ↓
Feature Extraction (Relative translation-invariant & scale-normalized coordinate vector)
   ↓
FastAPI Prediction Endpoint (/api/predict)
   ↓
Random Forest Inference (Backend)
   ↓
Text Translation (English/Hindi) & Log SQLite DB
   ↓
Speech Output (Web Speech API Audio TTS)
```

---

## Folder Structure

```
SignSpeak-AI/
├── backend/
│   ├── main.py                 # FastAPI Main Application Router
│   ├── database.py             # SQLite Connection Helpers
│   ├── models.py               # SQLAlchemy Database Schemas
│   ├── schemas.py              # Pydantic Request/Response models
│   ├── ml/
│   │   ├── predictor.py        # Normalization and model runner
│   │   ├── trainer.py          # Model fitting, metrics, synthetic generator
│   │   └── models/             # Directory storing weights (.joblib files)
│   ├── data/
│   │   └── gestures.csv        # Local coordinates database
│   ├── tests/
│   │   ├── test_ml.py          # ML normalization unit tests
│   │   └── test_api.py         # Route logic endpoints tests
│   └── requirements.txt        # Python packages lockfile
└── frontend/
    ├── index.html              # MediaPipe CDN script imports
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx             # State router & system panels loader
    │   ├── index.css           # Glassmorphic custom CSS variables
    │   ├── components/
    │   │   ├── Navbar.jsx      # Navigation header & connectivity widget
    │   │   └── WebcamFeed.jsx  # MediaPipe webcam processor
    │   └── pages/
    │       ├── LandingPage.jsx     # Landing, guides, and workflows
    │       ├── RecognitionPage.jsx  # Live translator workspace
    │       ├── DatasetPage.jsx     # Custom coordinate label capture
    │       └── AdminPage.jsx       # Training controls, accuracy, metrics
    └── tailwind.config.js      # Styling extension configurations
```

---

## Installation & Setup

### Prerequisites
- **Python** (version 3.8 to 3.14)
- **Node.js** (version 18 or newer)
- **npm** (version 9 or newer)

---

### 1. Backend Setup

1. Open your terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python3 -m venv venv
   ```

3. Activate the virtual environment:
   - **Mac/Linux**:
     ```bash
     source venv/bin/activate
     ```
   - **Windows**:
     ```bash
     venv\Scripts\activate
     ```

4. Install the required packages:
   ```bash
   # Use PyO3 bypass flag if compiling on Python 3.14 (pre-releases)
   PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 pip install -r requirements.txt
   ```

5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *Note: On first boot, the system will automatically generate a default synthetic dataset of coordinates for all 10 gestures and train a fallback active ML model so that the application works out-of-the-box.*

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

3. Run the Vite development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5180](http://localhost:5180) in your web browser.

---

## Running Automated Tests

To run the test suite and verify ML math and API endpoint routing:
1. Make sure you are in the `backend` folder and your virtual environment is active.
2. Install test packages:
   ```bash
   pip install pytest httpx
   ```
3. Run the tests:
   ```bash
   pytest tests/
   ```

---

## Key Features Guide

### 1. Real-Time Sign Recognition
Go to the **Translator** page, turn on your camera, and perform hand signs. The system classifies gestures and plays corresponding voice sounds. Toggle between English and Hindi to read spoken output in the selected language.

### 2. Dataset Collection Module
Open **Dataset Recorder**, enter a custom gesture label or select a default one, stand in front of the camera, and click **Record**. The system automatically records 50 sequential frames of coordinates and appends them to your database. You can download the compiled CSV at any time.

### 3. Model Training Dashboard
Open the **Admin Panel**, and click **Train Model**. The system fits a Random Forest Classifier on all recorded coordinates and outputs diagnostic evaluation metrics (accuracy, precision, recall) along with a colored confusion matrix grid showing predictions vs. actual gestures.
