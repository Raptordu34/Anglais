@echo off
cd /d "%~dp0"

set PORT=8080

:: Trouver un port libre
:find_port
netstat -an | find ":%PORT% " >nul 2>&1
if %errorlevel%==0 (
    set /a PORT=%PORT%+1
    goto find_port
)

echo Demarrage sur http://localhost:%PORT%
start "" "http://localhost:%PORT%"

:: Essayer python, python3, puis py (avec support API notes via server.py)
python --version >nul 2>&1 && python server.py %PORT% && goto end
python3 --version >nul 2>&1 && python3 server.py %PORT% && goto end
py --version >nul 2>&1 && py server.py %PORT% && goto end

echo.
echo ERREUR : Python n'est pas installe.
echo Telecharger Python sur https://www.python.org
pause
:end
