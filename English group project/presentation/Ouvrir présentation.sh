#!/bin/bash
cd "$(dirname "$0")"

# Trouver un port libre à partir de 8080
PORT=8080
while lsof -i :$PORT &>/dev/null 2>&1 || ss -tln 2>/dev/null | grep -q ":$PORT "; do
    PORT=$((PORT + 1))
done

echo "Démarrage sur http://localhost:$PORT"

# Ouvrir le navigateur (Linux)
if command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT" &
elif command -v open &>/dev/null; then
    open "http://localhost:$PORT"
fi

python3 server.py $PORT
