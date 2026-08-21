#!/bin/bash

# Yunusobod Dehqon Bozori Start Script

echo "🍈 Starting Yunusobod Dehqon Bozori Platform..."

# 1. Start Backend in background
echo "⚡ Starting Python FastAPI Backend on port 8000..."
cd backend
python3 -m pip install -r requirements.txt
python3 run.py &
BACKEND_PID=$!
cd ..

# 2. Start Frontend
echo "💻 Starting React Vite Frontend on port 5173..."
cd frontend
npm install
npm run dev

# Cleanup when killed
kill $BACKEND_PID
