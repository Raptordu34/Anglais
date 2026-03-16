#!/bin/bash
cd "$(dirname "$0")"

# Trouver un port libre à partir de 8080
PORT=8080
while lsof -i :$PORT &>/dev/null; do
    PORT=$((PORT + 1))
done

echo "Démarrage du serveur sur http://localhost:$PORT"
open "http://localhost:$PORT"

# Lancer le serveur Python avec support API notes
python3 server.py $PORT
