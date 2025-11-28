#!/bin/bash

# Screenshot Scheduler - Start Script
# This script starts the screenshot scheduler service

cd "$(dirname "$0")"

echo "Starting Screenshot Scheduler..."
echo "Press Ctrl+C to stop the service"
echo ""

npm start
