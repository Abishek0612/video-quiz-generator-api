from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
import json
import logging
from typing import List, Optional
from pydantic import BaseModel, Field
import ollama
import asyncio
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Video Quiz AI Service",
    description="AI service for video transcription and question generation",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for models
whisper_model = None
MODELS_LOADED = False

class QuestionRequest(BaseModel):
    text: str = Field(..., description="Transcript text to generate questions from")
    segment_index: int = Field(..., ge=0, description="Segment index")
    start_time: float = Field(..., ge=0, description="Start time in seconds")
    end_time: float = Field(..., gt=0, description="End time in seconds")
    language: str = Field(default="en", description="Language code")
    difficulty: str = Field(default="medium", regex="^(easy|medium|hard)$")
    question_count: int = Field(default=3, ge=1, le=10, description="Number of questions")

class Question(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    difficulty: str
    type: str = "multiple_choice"

class QuestionsResponse(BaseModel):
    questions: List[Question]
    segment_info: dict

class TranscriptionResponse(BaseModel):
    text: str
    segments: List[dict]
    language: str
    duration: float

async def load_models():
    """Load AI models on startup"""
    global whisper_model, MODELS_LOADED
    try:
        logger.info("Loading Whisper model...")
        whisper_model = whisper.load_model("base")
        
        # Test Ollama connection
        logger.info("Testing Ollama connection...")
        try:
            ollama.list()
            logger.info("Ollama connection successful")
        except Exception as e:
            logger.warning(f"Ollama not available: {e}")
        
        MODELS_LOADED = True
        logger.info("All models loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    await load_models()

@app.get("/health")
async def health_check():
    """Enhanced health check"""
    health_status = {
        "status": "healthy",
        "models_loaded": MODELS_LOADED,
        "whisper_available": whisper_model is not None,
        "ollama_available": False
    }
    
    try:
        ollama.list()
        health_status["ollama_available"] = True
    except:
        pass
    
    if not MODELS_LOADED:
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    return health_status

@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(..., description="Audio/video file to transcribe"),
    language: str = "en"
):
    """Transcribe audio/video file using Whisper"""
    if not MODELS_LOADED:
        raise HTTPException(status_code=503, detail="Models not loaded")
    
    # Validate file
    if not audio_file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size (max 1GB)
    max_size = 1024 * 1024 * 1024  # 1GB
    if audio_file.size and audio_file.size > max_size:
        raise HTTPException(status_code=413, detail="File too large (max 1GB)")
    
    temp_file_path = None
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        logger.info(f"Transcribing file: {audio_file.filename}")
        
        # Transcribe with Whisper
        result = whisper_model.transcribe(
            temp_file_path, 
            language=language,
            word_timestamps=True,
            verbose=False
        )
        
        response = TranscriptionResponse(
            text=result["text"],
            segments=[
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "text": segment["text"].strip()
                }
                for segment in result["segments"]
            ],
            language=result.get("language", language),
            duration=result.get("duration", 0)
        )
        
        logger.info(f"Transcription completed for {audio_file.filename}")
        return response
        
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        # Clean up temp file
        if temp_file_path and os.path.exists(temp_file_path):
            os.unlink(temp_file_path)

@app.post("/generate-questions", response_model=QuestionsResponse)
async def generate_questions(request: QuestionRequest):
    """Generate MCQ questions from transcript segment"""
    try:
        # Validate text length
        if len(request.text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Text too short for question generation")
        
        # Enhanced prompt with better structure
        prompt = f"""
Based on the following educational transcript segment, generate {request.question_count} high-quality multiple-choice questions.

TRANSCRIPT SEGMENT:
{request.text}

REQUIREMENTS:
- Difficulty level: {request.difficulty}
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Focus on key concepts, facts, and important information
- Questions should test understanding, not just memorization
- Provide clear, concise explanations for correct answers
- Avoid trick questions or ambiguous wording

FORMAT: Return ONLY valid JSON in this exact structure:
{{
    "questions": [
        {{
            "question": "Clear, well-formatted question?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option A",
            "explanation": "Brief explanation why this is correct",
            "difficulty": "{request.difficulty}",
            "type": "multiple_choice"
        }}
    ]
}}
"""
        
        logger.info(f"Generating {request.question_count} questions for segment {request.segment_index}")
        
        # Use Ollama for question generation
        try:
            response = ollama.chat(
                model='llama2',  # or 'mistral', 'gemma' based on what's available
                messages=[
                    {
                        'role': 'system',
                        'content': 'You are an expert educational content creator. Generate high-quality multiple-choice questions based on provided text. Always respond with valid JSON only.'
                    },
                    {
                        'role': 'user',
                        'content': prompt
                    }
                ],
                options={
                    'temperature': 0.7,
                    'top_p': 0.9,
                    'max_tokens': 1500
                }
            )
            
            # Parse the response
            content = response['message']['content']
            
            # Clean up the response (remove markdown formatting if any)
            if content.startswith('```json'):
                content = content.replace('```json', '').replace('```', '').strip()
            elif content.startswith('```'):
                content = content.replace('```', '').strip()
            
            questions_data = json.loads(content)
            
            # Validate the response structure
            if 'questions' not in questions_data:
                raise ValueError("Invalid response format from LLM")
            
            # Ensure we have the requested number of questions
            questions = questions_data['questions'][:request.question_count]
            
            response_data = QuestionsResponse(
                questions=[Question(**q) for q in questions],
                segment_info={
                    "segment_index": request.segment_index,
                    "start_time": request.start_time,
                    "end_time": request.end_time,
                    "duration": request.end_time - request.start_time,
                    "language": request.language
                }
            )
            
            logger.info(f"Generated {len(questions)} questions successfully")
            return response_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            raise HTTPException(status_code=500, detail="Invalid response format from AI model")
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            raise HTTPException(status_code=503, detail="AI model temporarily unavailable")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Question generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

@app.get("/models")
async def list_available_models():
    """List available Ollama models"""
    try:
        models = ollama.list()
        return {"available_models": models}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Failed to list models: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )