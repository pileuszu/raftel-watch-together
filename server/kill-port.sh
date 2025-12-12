#!/bin/bash
# Script to kill process using port 3001
# Usage: ./kill-port.sh [port]

PORT=${1:-3001}

echo "Finding processes using port $PORT..."

# Windows (Git Bash)
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    PIDS=$(netstat -ano | grep ":$PORT" | grep LISTENING | awk '{print $5}' | sort -u)
    
    if [ -z "$PIDS" ]; then
        echo "No processes found using port $PORT"
        exit 0
    fi
    
    for PID in $PIDS; do
        echo "Killing process PID: $PID"
        taskkill //PID $PID //F
    done
# Linux/Mac
else
    PIDS=$(lsof -ti:$PORT)
    
    if [ -z "$PIDS" ]; then
        echo "No processes found using port $PORT"
        exit 0
    fi
    
    for PID in $PIDS; do
        echo "Killing process PID: $PID"
        kill -9 $PID
    done
fi

echo "Done!"

