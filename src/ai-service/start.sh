#!/bin/bash

# Start Ollama in background
ollama serve &

# Wait for Ollama to be ready
sleep 10

# Pull required models
ollama pull llama2
ollama pull mistral

# Start the FastAPI application
python main.py