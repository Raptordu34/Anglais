@echo off
title Presentation - Serveur local
cd /d "%~dp0"

echo.
echo  ============================================
echo   Lancement de la presentation
echo  ============================================
echo.

:: ── 1. Python ────────────────────────────────
python --version >nul 2>&1
if %errorlevel%==0 (
    echo  [Python] Serveur sur http://localhost:8080
    echo  Fermez cette fenetre pour arreter.
    echo.
    start "" "http://localhost:8080"
    python -m http.server 8080 --bind 127.0.0.1
    goto fin
)

:: ── 2. Node.js ───────────────────────────────
node --version >nul 2>&1
if %errorlevel%==0 (
    echo  [Node.js] Serveur sur http://localhost:8080
    echo  Fermez cette fenetre pour arreter.
    echo.
    start "" "http://localhost:8080"
    node -e "const h=require('http'),fs=require('fs'),p=require('path'),m={'html':'text/html','css':'text/css','js':'application/javascript','png':'image/png','jpg':'image/jpeg','mp4':'video/mp4','avif':'image/avif','svg':'image/svg+xml','woff':'font/woff','woff2':'font/woff2'};h.createServer((req,res)=>{let f=p.join(__dirname,req.url==='/'?'index.html':req.url.slice(1));fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end('Not found');}else{let ext=p.extname(f).slice(1);res.writeHead(200,{'Content-Type':m[ext]||'application/octet-stream'});res.end(d);}});}).listen(8080,'127.0.0.1');"
    goto fin
)

:: ── 3. PowerShell (toujours disponible sur Windows 10/11) ───
echo  [PowerShell] Serveur sur http://localhost:8080
echo  Fermez cette fenetre pour arreter.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

:fin
pause
