#!/bin/bash

# =======================================================
# 🍈 Yunusobod Dehqon Bozori — Запуск Бота и Сайта 1 Кликом
# =======================================================

clear
echo "========================================================"
echo "🍈 Запуск Юнусабадского Дехканского Базара..."
echo "========================================================"

PROJECT_DIR="/Users/davlatbeksamadov/.gemini/antigravity-ide/scratch/yunusobod-bozori"
CLOUDFLARED="/Users/davlatbeksamadov/.local/bin/cloudflared"
PYTHON="/Library/Frameworks/Python.framework/Versions/3.14/bin/python3"
BOT_TOKEN=$(grep TELEGRAM_BOT_TOKEN "$PROJECT_DIR/backend/.env" | cut -d'"' -f2)

# 1. Завершаем старые процессы, если они были
pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
sleep 2
pkill -9 -f "uvicorn app.main:app" 2>/dev/null
pkill -9 -f "cloudflared tunnel" 2>/dev/null

# 3. Запускаем безопасный Cloudflare туннель
echo "🌐 2/3 Подключаем защищенный интернет-канал..."
rm -f /tmp/bozor_tunnel.log
"$CLOUDFLARED" tunnel --url http://127.0.0.1:8000 > /tmp/bozor_tunnel.log 2>&1 &
TUNNEL_PID=$!

# 4. Ждем получения публичной ссылки
echo "⏳ 3/3 Получаем онлайн-адрес для Telegram..."
TUNNEL_URL=""
for i in {1..30}; do
    TUNNEL_URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' /tmp/bozor_tunnel.log | head -n 1)
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
    echo "❌ Ошибка: не удалось получить ссылку туннеля."
    kill $TUNNEL_PID 2>/dev/null
    exit 1
fi

# 5. Обновляем кнопку в Telegram
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{\"menu_button\": {\"type\": \"web_app\", \"text\": \"🛒 Bozor\", \"web_app\": {\"url\": \"${TUNNEL_URL}\"}}}" > /dev/null

sed -i '' "s|WEBAPP_URL=.*|WEBAPP_URL=\"${TUNNEL_URL}\"|g" "$PROJECT_DIR/backend/.env" 2>/dev/null

# 6. Запускаем сервер FastAPI (бэкенд + фронтенд + Telegram бот) уже с новой ссылкой
cd "$PROJECT_DIR/backend"
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/bozor_backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

clear
echo "========================================================"
echo "🎉 БОТ И БАЗАР УСПЕШНО РАБОТАЮТ ОНЛАЙН!"
echo "========================================================"
echo ""
echo "📱 Ваш Telegram бот:  @yunusobod_dehqon_bozori_bot"
echo "🌐 Ссылка на базар:     $TUNNEL_URL"
echo ""
echo "👉 Возьмите телефон, откройте Telegram и нажмите «🛒 Bozor»!"
echo "========================================================"
echo "Чтобы остановить — нажмите Ctrl + C."

trap "kill $BACKEND_PID $TUNNEL_PID 2>/dev/null; echo ''; echo '🛑 Бот остановлен.'; exit 0" INT TERM EXIT

wait $BACKEND_PID
