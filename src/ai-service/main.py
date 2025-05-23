from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import whisper
import tempfile
import os
from typing import List
import asyncio
from pydantic import BaseModel
import ollama

app = FastAPI(title="AI Service", description="Video transcription and question generation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model
whisper_model = whisper.load_model("base")

class QuestionRequest(BaseModel):
    text: str
    segment_index: int
    start_time: float
    end_time: float
    language: str = "en"
    difficulty: str = "medium"
    question_count: int = 3

class Question(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str
    difficulty: str
    type: str = "multiple_choice"

@app.post("/transcribe")
async def transcribe_audio(audio_file: UploadFile = File(...), language: str = "en"):
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
            content = await audio_file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        # Transcribe with Whisper
        result = whisper_model.transcribe(temp_file_path, language=language)
        
        # Clean up temp file
        os.unlink(temp_file_path)
        
        return {
            "text": result["text"],
            "segments": [
                {
                    "start": segment["start"],
                    "end": segment["end"],
                    "text": segment["text"]
                }
                for segment in result["segments"]
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.post("/generate-questions")
async def generate_questions(request: QuestionRequest):
    try:
        prompt = f"""
        Based on the following transcript segment, generate {request.question_count} multiple-choice questions.
        
        Transcript: {request.text}
        
        Requirements:
        - Questions should be {request.difficulty} difficulty level
        - Each question should have 4 options (A, B, C, D)
        - Only one option should be correct
        - Provide a brief explanation for the correct answer
        - Focus on key concepts and important information
        
        Format your response as JSON with this structure:
        {{
            "questions": [
                {{
                    "question": "Question text here?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "Option A",
                    "explanation": "Explanation here",
                    "difficulty": "{request.difficulty}",
                    "type": "multiple_choice"
                }}
            ]
        }}
        """
        
        # Use Ollama for question generation
        response = ollama.chat(
            model='llama2',  # or another model
            messages=[
                {
                    'role': 'user',
                    'content': prompt
                }
            ]
        )
        
        # Parse the response (you might need to clean this up based on the actual response format)
        import json
        questions_data = json.loads(response['message']['content'])
        
        return questions_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)