import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from database import Base

class RecognitionHistory(Base):
    __tablename__ = "recognition_history"

    id = Column(Integer, primary_key=True, index=True)
    gesture = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    language = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, unique=True, nullable=False)
    accuracy = Column(Float, nullable=False)
    precision = Column(Float, nullable=False)
    recall = Column(Float, nullable=False)
    confusion_matrix = Column(String, nullable=False)  # JSON-serialized confusion matrix list of lists
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    language = Column(String, default="English")
    volume = Column(Float, default=1.0)
    auto_speak = Column(Boolean, default=True)

class ConversationHistory(Base):
    __tablename__ = "conversation_history"

    id = Column(Integer, primary_key=True, index=True)
    transcript = Column(String, nullable=False)
    translation = Column(String, nullable=False)
    language = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
