@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js non e' installato. Scaricalo da https://nodejs.org ^(versione LTS^) e riprova. & pause & exit /b)
call npm install
call npm run build
echo.
echo Fatto. L'installer si trova nella cartella "dist": GC - GRE.MO Setup 1.0.0.exe
pause
