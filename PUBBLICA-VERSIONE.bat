@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM Metodo manuale (se non usi la pubblicazione automatica su GitHub).
where node >nul 2>nul || (echo Node.js non e' installato. & pause & exit /b)
set /p VER=Numero della nuova versione (es. 1.2.0, deve essere piu' alto dell'attuale): 
set /p GH_TOKEN=Token GitHub (permesso "repo"): 
call npm install
call npm version %VER% --no-git-tag-version
call npm run pubblica
echo.
echo Fatto. Se non ci sono errori la versione %VER% e' pubblicata: i programmi la troveranno da soli.
pause
