@echo off
:: LiveBet IQ 3.0 Auto Deploy Script
cd /d "C:\Users\HP\Dropbox (Old)\PC\Desktop\livebetiq3"

echo ================================
echo 🚀 DEPLOYING LIVEBET IQ 3.0 🚀
echo ================================

:: Step 0: Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Git is not installed. Please install Git and try again.
    pause
    exit /b
)

:: Step 1: Check for changes
git status --porcelain >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ This is not a Git repository. Initialize it first.
    pause
    exit /b
)

git diff --quiet && git diff --cached --quiet
if %errorlevel% equ 0 (
    echo ⚠️ No changes to commit. Exiting...
    pause
    exit /b
)

:: Step 2: Add all changes
git add .

:: Step 3: Commit with timestamp
set TIMESTAMP=%DATE% %TIME%
git commit -m "Auto Deploy: %TIMESTAMP%"

:: Step 4: Push to GitHub
git push origin main

echo ================================
echo ✅ PUSH TO GITHUB COMPLETED!
echo ================================

:: Step 5: Open LiveBet IQ 3.0 in browser
start https://livebetiq3.vercel.app

pause
exit