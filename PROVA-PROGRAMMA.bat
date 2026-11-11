@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js non e' installato. Scaricalo da https://nodejs.org ^(versione LTS^) e riprova. & pause & exit /b)
if not exist node_modules (echo Installazione componenti, un attimo... & call npm install)
call npm start
