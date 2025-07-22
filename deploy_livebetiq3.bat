@echo off
:: LiveBet IQ 3.0 auto deploy script with browser open

cd /d "C:\Users\HP\Dropbox (Old)\PC\Desktop\livebetiq3"

echo ================================
echo 🚀 DEPLOYING LIVEBET IQ 3.0 🚀
echo ================================

:: Step 1: Add all changes
git add .

:: Step 2: Commit with timestamp
set TIMESTAMP=%DATE% %TIME%
git commit -m "Auto Deploy: %TIMESTAMP%"

:: Step 3: Push to GitHub
git push origin main

echo ================================
echo ✅ PUSH TO GITHUB COMPLETED!
echo ================================

:: Step 4: Open LiveBet IQ site
start https://livebetiq3.vercel.app

pause
exit