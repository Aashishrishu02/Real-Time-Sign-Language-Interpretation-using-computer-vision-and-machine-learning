import os
import csv
import json
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import shutil

from database import engine, Base, get_db, SessionLocal

import models
import schemas
from ml.predictor import predictor, ACTIVE_MODEL_PATH
from ml.trainer import train_model, CSV_PATH, MODELS_DIR

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SignSpeak AI API", version="1.0.0")

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-language translations
TRANSLATIONS = {
    "English": {
        "Hello": "Hello", "Thank You": "Thank You", "Yes": "Yes", "No": "No", "Help": "Help",
        "Water": "Water", "Food": "Food", "Stop": "Stop", "Good": "Good", "Bad": "Bad",
        "Neutral": "Neutral", "Unknown": "Unknown", "Error": "Error"
    },
    "Hindi": {
        "Hello": "नमस्ते", "Thank You": "धन्यवाद", "Yes": "हाँ", "No": "नहीं", "Help": "मदद",
        "Water": "पानी", "Food": "खाना", "Stop": "रुकिए", "Good": "अच्छा", "Bad": "खराब",
        "Neutral": "न्यूट्रल", "Unknown": "अज्ञात", "Error": "त्रुटि"
    }
}

# In-memory settings cache to avoid SQLite database querying on every single frame prediction
SETTINGS_CACHE = {
    "language": "English",
    "volume": 1.0,
    "auto_speak": True
}

def update_settings_cache(language: str, volume: float, auto_speak: bool):
    global SETTINGS_CACHE
    SETTINGS_CACHE["language"] = language
    SETTINGS_CACHE["volume"] = volume
    SETTINGS_CACHE["auto_speak"] = auto_speak

# Track the last logged gesture globally to implement transition-based database logging
# This prevents database bloat when holding a gesture
LAST_LOGGED_GESTURE = None

def log_gesture_transition(gesture: str, confidence: float, lang: str, db: Session) -> bool:
    """
    Logs the gesture to RecognitionHistory only if it transitions (changes)
    from the last logged state. Neutral, Error, and Unknown gestures update the transition state
    but are not written to the database.
    """
    global LAST_LOGGED_GESTURE
    if gesture == LAST_LOGGED_GESTURE:
        return False  # No change, don't log
        
    # Update transition state
    LAST_LOGGED_GESTURE = gesture
    
    # Only write to DB for meaningful gestures
    if gesture not in ["Neutral", "Error", "Unknown"]:
        try:
            history_entry = models.RecognitionHistory(
                gesture=gesture,
                confidence=confidence,
                language=lang
            )
            db.add(history_entry)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            print(f"Error saving gesture to database: {e}")
            
    return False

@app.on_event("startup")
def startup_event():
    # Pre-populate settings if empty
    db = next(get_db())
    try:
        settings = db.query(models.SystemSettings).first()
        if not settings:
            default_settings = models.SystemSettings(language="English", volume=1.0, auto_speak=True)
            db.add(default_settings)
            db.commit()
            db.refresh(default_settings)
            settings = default_settings
            print("Default settings initialized.")
            
        # Populate in-memory settings cache on startup
        update_settings_cache(settings.language, settings.volume, settings.auto_speak)
        print(f"In-memory settings cache pre-populated: {SETTINGS_CACHE}")
    except Exception as e:
        print(f"Error initializing settings: {e}")
    finally:
        db.close()

# --- PREDICTION API ---
@app.post("/api/predict", response_model=schemas.PredictionResponse)
def predict_gesture(request: schemas.PredictionRequest, db: Session = Depends(get_db)):
    try:
        gesture, confidence = predictor.predict(request.landmarks)
        
        # Query active language settings from memory cache
        lang = SETTINGS_CACHE["language"]
        
        # Translate gesture
        translated_text = TRANSLATIONS.get(lang, {}).get(gesture, gesture)
        
        # Save to database log using transition-based rules
        log_gesture_transition(gesture, confidence, lang, db)
        
        return schemas.PredictionResponse(
            gesture=gesture,
            translated_text=translated_text,
            confidence=confidence,
            success=True
        )
    except Exception as e:
        print(f"Endpoint prediction error: {e}")
        return schemas.PredictionResponse(
            gesture="Error",
            translated_text=TRANSLATIONS.get("English", {}).get("Error"),
            confidence=0.0,
            success=False
        )

@app.post("/api/predict/sequence", response_model=schemas.PredictionResponse)
def predict_sequence(request: schemas.SequencePredictionRequest, db: Session = Depends(get_db)):
    try:
        gesture, confidence = predictor.predict(request.landmarks_seq)
        
        # Query active language settings from memory cache
        lang = SETTINGS_CACHE["language"]
        
        # Translate gesture
        translated_text = TRANSLATIONS.get(lang, {}).get(gesture, gesture)
        
        # Save to database log using transition-based rules
        log_gesture_transition(gesture, confidence, lang, db)
            
        return schemas.PredictionResponse(
            gesture=gesture,
            translated_text=translated_text,
            confidence=confidence,
            success=True
        )
    except Exception as e:
        print(f"Sequence endpoint prediction error: {e}")
        return schemas.PredictionResponse(
            gesture="Error",
            translated_text=TRANSLATIONS.get("English", {}).get("Error"),
            confidence=0.0,
            success=False
        )

@app.websocket("/api/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive flat landmark sequence coordinates from frontend as a JSON-encoded string
            data = await websocket.receive_text()
            request_data = json.loads(data)
            landmarks_seq = request_data.get("landmarks_seq", [])
            
            if not landmarks_seq or len(landmarks_seq) != 1890:
                await websocket.send_json({
                    "success": False,
                    "error": "Invalid landmarks sequence length. Expected 1890 coordinates."
                })
                continue
                
            # Perform inference using our PyTorch model
            gesture, confidence = predictor.predict(landmarks_seq)
            
            # Retrieve active language translations from memory cache
            lang = SETTINGS_CACHE["language"]
            translated_text = TRANSLATIONS.get(lang, {}).get(gesture, gesture)
            
            # Save to database log using transition-based rules
            # We open/close database connection on demand here to prevent holding open connection
            db = SessionLocal()
            try:
                log_gesture_transition(gesture, confidence, lang, db)
            except Exception as db_err:
                print(f"Error inside WebSocket db logging: {db_err}")
            finally:
                db.close()
                
            await websocket.send_json({
                "gesture": gesture,
                "translated_text": translated_text,
                "confidence": confidence,
                "success": True
            })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket prediction error: {e}")

# --- DATASET API ---
@app.post("/api/dataset/record", response_model=schemas.DatasetStatusResponse)
def record_landmark(request: schemas.RecordDatasetRequest):
    label = request.label
    landmarks = request.landmarks
    
    # Normalize landmarks to ensure coordinate consistency (invariant features)
    import numpy as np
    from ml.trainer import normalize_landmarks_numpy
    try:
        coords = np.array(landmarks).reshape(21, 3)
        normalized_landmarks = list(normalize_landmarks_numpy(coords))
    except Exception as e:
        print(f"Error normalizing recorded landmarks: {e}")
        normalized_landmarks = landmarks
        
    # Write to CSV
    file_exists = os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0
    
    with open(CSV_PATH, mode="a", newline="") as file:
        writer = csv.writer(file)
        if not file_exists:
            # Header
            header = ["label"] + [f"lm_{i}" for i in range(63)]
            writer.writerow(header)
        
        row = [label] + normalized_landmarks
        writer.writerow(row)
        
    return get_dataset_status()

@app.post("/api/dataset/record-sequence", response_model=schemas.DatasetStatusResponse)
def record_sequence(request: schemas.RecordDatasetSequenceRequest):
    label = request.label
    landmarks_seq = request.landmarks_seq
    
    # Normalize landmarks in sequence frame by frame
    import numpy as np
    from ml.trainer import normalize_landmarks_numpy
    try:
        raw_seq = np.array(landmarks_seq).reshape(30, 21, 3)
        normalized_seq = []
        for frame_coords in raw_seq:
            flat_norm = normalize_landmarks_numpy(frame_coords)
            normalized_seq.extend(flat_norm)
    except Exception as e:
        print(f"Error normalizing recorded sequence: {e}")
        normalized_seq = landmarks_seq
        
    # Write to CSV
    file_exists = os.path.exists(CSV_PATH) and os.path.getsize(CSV_PATH) > 0
    
    with open(CSV_PATH, mode="a", newline="") as file:
        writer = csv.writer(file)
        if not file_exists:
            # Header
            header = ["label"] + [f"lm_{i}" for i in range(1890)]
            writer.writerow(header)
        
        row = [label] + list(normalized_seq)
        writer.writerow(row)
        
    return get_dataset_status()

@app.get("/api/dataset/status", response_model=schemas.DatasetStatusResponse)
def get_dataset_status():
    if not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0:
        return schemas.DatasetStatusResponse(total_samples=0, labels_summary={})
        
    total_samples = 0
    labels_summary = {}
    
    try:
        with open(CSV_PATH, mode="r") as file:
            reader = csv.reader(file)
            header = next(reader)  # Skip header
            for row in reader:
                if not row:
                    continue
                total_samples += 1
                label = row[0]
                labels_summary[label] = labels_summary.get(label, 0) + 1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset: {str(e)}")
        
    return schemas.DatasetStatusResponse(total_samples=total_samples, labels_summary=labels_summary)

@app.get("/api/dataset/download")
def download_dataset():
    if not os.path.exists(CSV_PATH) or os.path.getsize(CSV_PATH) == 0:
        raise HTTPException(status_code=404, detail="Dataset CSV file is empty or does not exist.")
    return FileResponse(CSV_PATH, media_type="text/csv", filename="gestures_dataset.csv")

@app.delete("/api/dataset/clear")
def clear_dataset(db: Session = Depends(get_db)):
    # Remove CSV file
    if os.path.exists(CSV_PATH):
        os.remove(CSV_PATH)
        
    # Reset active model link if deleted
    if os.path.exists(ACTIVE_MODEL_PATH):
        os.remove(ACTIVE_MODEL_PATH)
        
    # Delete model metric records
    db.query(models.ModelMetrics).delete()
    db.commit()
    
    predictor.model = None
    
    return {"message": "Dataset and trained models cleared successfully."}

# --- MODEL API ---
@app.post("/api/model/train", response_model=schemas.TrainModelResponse)
def train_new_model(db: Session = Depends(get_db)):
    try:
        metrics = train_model()
        
        # Save metrics record to SQLite
        metrics_record = models.ModelMetrics(
            model_name=metrics["model_name"],
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            confusion_matrix=json.dumps(metrics["confusion_matrix"]),
            is_active=True
        )
        
        # Set all other models to inactive
        db.query(models.ModelMetrics).update({models.ModelMetrics.is_active: False})
        db.add(metrics_record)
        db.commit()
        
        # Reload active predictor
        predictor.reload()
        
        return schemas.TrainModelResponse(
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            confusion_matrix=metrics["confusion_matrix"],
            model_name=metrics["model_name"],
            labels=metrics["labels"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model training failed: {str(e)}")

@app.get("/api/model/active", response_model=schemas.ModelMetricsResponse)
def get_active_model(db: Session = Depends(get_db)):
    active_model = db.query(models.ModelMetrics).filter(models.ModelMetrics.is_active == True).first()
    if not active_model:
        raise HTTPException(status_code=404, detail="No active model record in database.")
    
    # Deserialize confusion matrix
    cm_list = json.loads(active_model.confusion_matrix)
    return schemas.ModelMetricsResponse(
        id=active_model.id,
        model_name=active_model.model_name,
        accuracy=active_model.accuracy,
        precision=active_model.precision,
        recall=active_model.recall,
        confusion_matrix=cm_list,
        is_active=active_model.is_active,
        created_at=active_model.created_at
    )

@app.get("/api/model/list", response_model=List[schemas.ModelMetricsResponse])
def get_model_list(db: Session = Depends(get_db)):
    models_list = db.query(models.ModelMetrics).order_by(models.ModelMetrics.created_at.desc()).all()
    results = []
    for m in models_list:
        results.append(schemas.ModelMetricsResponse(
            id=m.id,
            model_name=m.model_name,
            accuracy=m.accuracy,
            precision=m.precision,
            recall=m.recall,
            confusion_matrix=json.loads(m.confusion_matrix),
            is_active=m.is_active,
            created_at=m.created_at
        ))
    return results

@app.post("/api/model/activate/{model_id}")
def activate_model(model_id: int, db: Session = Depends(get_db)):
    model_record = db.query(models.ModelMetrics).filter(models.ModelMetrics.id == model_id).first()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model record not found.")
        
    # Mark all as inactive
    db.query(models.ModelMetrics).update({models.ModelMetrics.is_active: False})
    # Mark target as active
    model_record.is_active = True
    db.commit()
    
    # Reload predictor
    success = predictor.reload(model_record.model_name)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to load model file from disk.")
        
    return {"message": f"Activated model: {model_record.model_name}"}

@app.post("/api/model/upload", response_model=schemas.ModelMetricsResponse)
def upload_custom_model(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pt"):
        raise HTTPException(status_code=400, detail="Only .pt PyTorch files are supported.")
        
    # Save the file
    filename = file.filename
    target_path = os.path.join(MODELS_DIR, filename)
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Generate dummy metrics
    model_name = filename.replace(".pt", "")
    metrics_record = models.ModelMetrics(
        model_name=model_name,
        accuracy=0.95,  # Assume high metric for external custom model
        precision=0.95,
        recall=0.95,
        confusion_matrix=json.dumps([[10 if i == j else 0 for i in range(11)] for j in range(11)]), # dummy CM for 11 classes
        is_active=True
    )
    
    # Set all other models to inactive
    db.query(models.ModelMetrics).update({models.ModelMetrics.is_active: False})
    db.add(metrics_record)
    db.commit()
    
    predictor.reload(model_name)
    
    return schemas.ModelMetricsResponse(
        id=metrics_record.id,
        model_name=metrics_record.model_name,
        accuracy=metrics_record.accuracy,
        precision=metrics_record.precision,
        recall=metrics_record.recall,
        confusion_matrix=json.loads(metrics_record.confusion_matrix),
        is_active=metrics_record.is_active,
        created_at=metrics_record.created_at
    )

# --- ANALYTICS API ---
@app.get("/api/analytics/summary", response_model=schemas.AnalyticsSummaryResponse)
def get_analytics_summary(db: Session = Depends(get_db)):
    total_gestures = db.query(models.RecognitionHistory).count()
    if total_gestures == 0:
        return schemas.AnalyticsSummaryResponse(
            total_gestures=0,
            average_confidence=0.0,
            most_used_gesture=None,
            gesture_counts={}
        )
        
    # Average confidence
    avg_conf = db.query(func.avg(models.RecognitionHistory.confidence)).scalar() or 0.0
    
    # Group by gesture
    gesture_stats = db.query(
        models.RecognitionHistory.gesture, 
        func.count(models.RecognitionHistory.gesture)
    ).group_by(models.RecognitionHistory.gesture).all()
    
    gesture_counts = {g: count for g, count in gesture_stats}
    
    most_used = max(gesture_counts, key=gesture_counts.get) if gesture_counts else None
    
    return schemas.AnalyticsSummaryResponse(
        total_gestures=total_gestures,
        average_confidence=float(avg_conf),
        most_used_gesture=most_used,
        gesture_counts=gesture_counts
    )

@app.get("/api/analytics/daily", response_model=List[schemas.DailyUsageItem])
def get_daily_usage(db: Session = Depends(get_db)):
    # Group logs by date
    daily_stats = db.query(
        func.strftime("%Y-%m-%d", models.RecognitionHistory.timestamp).label("date"),
        func.count(models.RecognitionHistory.id).label("count")
    ).group_by("date").order_by("date").limit(30).all()
    
    return [schemas.DailyUsageItem(date=row.date, count=row.count) for row in daily_stats]

@app.get("/api/analytics/history", response_model=List[schemas.HistoryItemResponse])
def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    history_logs = db.query(models.RecognitionHistory)\
        .order_by(models.RecognitionHistory.timestamp.desc())\
        .offset(skip).limit(limit).all()
    return history_logs

@app.delete("/api/analytics/history/clear")
def clear_history(db: Session = Depends(get_db)):
    db.query(models.RecognitionHistory).delete()
    db.commit()
    return {"message": "Recognition history cleared successfully."}

@app.get("/api/analytics/history/export")
def export_history(db: Session = Depends(get_db)):
    logs = db.query(models.RecognitionHistory).order_by(models.RecognitionHistory.timestamp.desc()).all()
    
    export_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    export_path = os.path.join(export_dir, "recognition_history_export.csv")
    
    with open(export_path, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["ID", "Gesture", "Confidence", "Language", "Timestamp"])
        for log in logs:
            writer.writerow([log.id, log.gesture, log.confidence, log.language, log.timestamp.isoformat()])
            
    return FileResponse(export_path, media_type="text/csv", filename="signspeak_history.csv")

# --- CONVERSATION HISTORY API ---
@app.get("/api/history", response_model=List[schemas.ConversationHistoryResponse])
def get_conversation_history(db: Session = Depends(get_db)):
    try:
        return db.query(models.ConversationHistory).order_by(models.ConversationHistory.timestamp.desc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversation history: {str(e)}")

@app.post("/api/history", response_model=schemas.ConversationHistoryResponse)
def create_conversation_history(entry: schemas.ConversationHistorySchema, db: Session = Depends(get_db)):
    try:
        db_entry = models.ConversationHistory(
            transcript=entry.transcript,
            translation=entry.translation,
            language=entry.language
        )
        db.add(db_entry)
        db.commit()
        db.refresh(db_entry)
        return db_entry
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save conversation entry: {str(e)}")

@app.delete("/api/history")
def clear_conversation_history(db: Session = Depends(get_db)):
    try:
        db.query(models.ConversationHistory).delete()
        db.commit()
        return {"message": "Conversation history cleared successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear conversation history: {str(e)}")

# --- TRANSLATION API ---
def translate_text(text: str, target_lang: str) -> str:
    if not text:
        return ""
        
    en_to_hi = TRANSLATIONS["Hindi"]
    hi_to_en = {v: k for k, v in en_to_hi.items()}
    
    res = text
    if target_lang == "Hindi":
        for k in sorted(en_to_hi.keys(), key=len, reverse=True):
            import re
            pattern = re.compile(re.escape(k), re.IGNORECASE)
            res = pattern.sub(en_to_hi[k], res)
    elif target_lang == "English":
        for k in sorted(hi_to_en.keys(), key=len, reverse=True):
            import re
            pattern = re.compile(re.escape(k), re.IGNORECASE)
            res = pattern.sub(hi_to_en[k], res)
    return res

@app.post("/api/translate", response_model=schemas.TranslationResponse)
def translate_sentence(request: schemas.TranslationRequest):
    try:
        translated = translate_text(request.text, request.target_language)
        return schemas.TranslationResponse(
            translated_text=translated,
            success=True
        )
    except Exception as e:
        print(f"Translation endpoint error: {e}")
        return schemas.TranslationResponse(
            translated_text=request.text,
            success=False
        )

# --- SETTINGS API ---
@app.get("/api/settings", response_model=schemas.SystemSettingsSchema)
def get_settings(db: Session = Depends(get_db)):
    # Read from cache for super fast response
    global SETTINGS_CACHE
    return schemas.SystemSettingsSchema(
        language=SETTINGS_CACHE["language"],
        volume=SETTINGS_CACHE["volume"],
        auto_speak=SETTINGS_CACHE["auto_speak"]
    )

@app.post("/api/settings", response_model=schemas.SystemSettingsSchema)
def update_settings(new_settings: schemas.SystemSettingsSchema, db: Session = Depends(get_db)):
    settings = db.query(models.SystemSettings).first()
    if not settings:
        settings = models.SystemSettings()
        db.add(settings)
        
    settings.language = new_settings.language
    settings.volume = new_settings.volume
    settings.auto_speak = new_settings.auto_speak
    
    db.commit()
    db.refresh(settings)
    
    # Sync cache
    update_settings_cache(settings.language, settings.volume, settings.auto_speak)
    
    return schemas.SystemSettingsSchema(
        language=settings.language,
        volume=settings.volume,
        auto_speak=settings.auto_speak
    )
