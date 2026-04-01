#!/bin/bash
# Start both backend and frontend
trap "kill 0" EXIT

# Start backend first, wait for it to be ready
cd /Users/laurenberry/dev/mock-dashboard/backend && .venv/bin/uvicorn main:app --reload &
echo "Waiting for backend to start..."
until curl -s http://localhost:8000/ > /dev/null 2>&1; do sleep 0.5; done
echo "Backend ready."

cd /Users/laurenberry/dev/mock-dashboard/frontend && npm run dev &

wait
