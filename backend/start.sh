#!/bin/bash
set -e

# Cloud Run sets PORT automatically, default to 8080 if not set
PORT=${PORT:-8080}

# Start uvicorn with the correct host and port
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
