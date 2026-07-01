from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class PredictionRequest(BaseModel):
    landmarks: List[float] = Field(..., min_items=63, max_items=63, description="63 coordinates of 21 landmarks (x, y, z)")

class PredictionResponse(BaseModel):
    gesture: str
    translated_text: str
    confidence: float
    success: bool

class RecordDatasetRequest(BaseModel):
    label: str = Field(..., description="Gesture label name")
    landmarks: List[float] = Field(..., min_items=63, max_items=63, description="63 coordinates of 21 landmarks (x, y, z)")

class DatasetStatusResponse(BaseModel):
    total_samples: int
    labels_summary: Dict[str, int]

class TrainModelResponse(BaseModel):
    accuracy: float
    precision: float
    recall: float
    confusion_matrix: List[List[int]]
    model_name: str
    labels: List[str]

class ModelMetricsResponse(BaseModel):
    id: int
    model_name: str
    accuracy: float
    precision: float
    recall: float
    confusion_matrix: List[List[int]]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
        orm_mode = True

class SystemSettingsSchema(BaseModel):
    language: str = Field("English", description="Language preference (English or Hindi)")
    volume: float = Field(1.0, ge=0.0, le=1.0, description="Text-to-speech volume level (0.0 to 1.0)")
    auto_speak: bool = Field(True, description="Enable automatic text-to-speech output")

class AnalyticsSummaryResponse(BaseModel):
    total_gestures: int
    average_confidence: float
    most_used_gesture: Optional[str] = None
    gesture_counts: Dict[str, int]

class DailyUsageItem(BaseModel):
    date: str
    count: int

class HistoryItemResponse(BaseModel):
    id: int
    gesture: str
    confidence: float
    language: str
    timestamp: datetime

    class Config:
        from_attributes = True
        orm_mode = True

class SequencePredictionRequest(BaseModel):
    landmarks_seq: List[float] = Field(..., min_items=1890, max_items=1890, description="1890 flat coordinates (30 frames of 21 landmarks x 3 coordinates)")

class RecordDatasetSequenceRequest(BaseModel):
    label: str = Field(..., description="Gesture label name")
    landmarks_seq: List[float] = Field(..., min_items=1890, max_items=1890, description="1890 flat coordinates (30 frames of 21 landmarks x 3 coordinates)")

class ConversationHistorySchema(BaseModel):
    transcript: str = Field(..., description="Original transcript text")
    translation: str = Field(..., description="Translated text")
    language: str = Field(..., description="Target language")

class ConversationHistoryResponse(BaseModel):
    id: int
    transcript: str
    translation: str
    language: str
    timestamp: datetime

    class Config:
        from_attributes = True
        orm_mode = True

class TranslationRequest(BaseModel):
    text: str = Field(..., description="Text sentence to translate")
    target_language: str = Field(..., description="Target language ('English' or 'Hindi')")

class TranslationResponse(BaseModel):
    translated_text: str
    success: bool

