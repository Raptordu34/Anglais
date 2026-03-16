@echo off
setlocal

echo ========================================
echo   Sync - English group project
echo ========================================
echo.
echo Choisir une option :
echo.
echo   --- Bidirectionnel ---
echo   1. Bisync : les 2 repertoires se mettent a jour mutuellement
echo.
echo   --- Source de verite (ecrase l autre cote) ---
echo   2. Mon PC   est la verite  ^>  Drive devient identique a mon PC
echo   3. Le Drive est la verite  ^>  Mon PC  devient identique au Drive
echo.
set /p choix=Ton choix (1/2/3) : 

if "%choix%"=="1" goto bisync
if "%choix%"=="2" goto pc_vers_drive
if "%choix%"=="3" goto drive_vers_pc
echo Choix invalide.
goto fin

:bisync
echo.
echo Bisync bidirectionnel...
rclone bisync "C:\Users\bapti\Documents\A3\Anglais\English group project" "gdrive:A3/English group project" --drive-skip-gdocs --progress
goto fin

:pc_vers_drive
echo.
echo PC -^> Drive  (le Drive sera identique a ton PC)
echo ATTENTION : les fichiers presents uniquement sur le Drive seront supprimes.
echo.
set /p confirm=Confirmer ? (o/n) : 
if /i not "%confirm%"=="o" goto annule
rclone sync "C:\Users\bapti\Documents\A3\Anglais\English group project" "gdrive:A3/English group project" --drive-skip-gdocs --progress
goto fin

:drive_vers_pc
echo.
echo Drive -^> PC  (ton PC sera identique au Drive)
echo ATTENTION : les fichiers presents uniquement sur ton PC seront supprimes.
echo.
set /p confirm=Confirmer ? (o/n) : 
if /i not "%confirm%"=="o" goto annule
rclone sync "gdrive:A3/English group project" "C:\Users\bapti\Documents\A3\Anglais\English group project" --drive-skip-gdocs --progress
goto fin

:annule
echo Annule.

:fin
echo.
echo Termine !
pause
