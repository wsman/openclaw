#!/bin/bash

# Test OpenClaw Hook API
# Usage: ./scripts/test_openclaw_hook.sh [type] [source] [content]

TYPE=${1:-"thought"}
SOURCE=${2:-"agent:test"}
CONTENT=${3:-"Hello from OpenClaw test script!"}

echo "Testing OpenClaw Hook with type: $TYPE"

curl -X POST http://localhost:4514/api/hook/openclaw \
     -H "Content-Type: application/json" \
     -d "{
       \"type\": \"$TYPE\",
       \"source\": \"$SOURCE\",
       \"content\": \"$CONTENT\",
       \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"
     }"

echo -e "\nDone."
