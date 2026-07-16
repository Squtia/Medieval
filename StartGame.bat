@echo off
chcp 65001 >nul
echo =========================================
echo       中古世紀傭兵團 - 遊戲啟動器
echo =========================================
echo.
echo 正在為您啟動本地伺服器並開啟瀏覽器...
echo 請不要關閉這個黑色視窗，否則遊戲會中斷連線。
echo.
start http://localhost:5173/
npm run dev
