#!/usr/bin/env python3
import http.server, sys, os
from pathlib import Path

NOTES_FILE = 'commentaire.md'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/notes':
            self._serve_notes()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/notes':
            self._save_notes()
        else:
            self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def _serve_notes(self):
        p = Path(NOTES_FILE)
        data = (p.read_text(encoding='utf-8') if p.exists() else '').encode('utf-8')
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', len(data))
        self.end_headers()
        self.wfile.write(data)

    def _save_notes(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        Path(NOTES_FILE).write_text(body, encoding='utf-8')
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        if '/api/' in (args[0] if args else ''):
            super().log_message(fmt, *args)

if __name__ == '__main__':
    os.chdir(Path(__file__).parent)
    with http.server.HTTPServer(('', PORT), Handler) as s:
        print(f'Serveur sur http://localhost:{PORT}')
        print(f'Notes : {Path(NOTES_FILE).resolve()}')
        s.serve_forever()
