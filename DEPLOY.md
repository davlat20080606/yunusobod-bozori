# 🚀 Инструкция по запуску 24/7 в Облаке (Cloud Hosting)

После этих простых шагов ваш Telegram-бот и сайт будут **работать 24/7/365, даже если ваш компьютер выключен**!

---

## 🌟 Вариант 1. Бесплатный запуск на Render.com (Самый простой, 3 минуты)

1. Зарегистрируйтесь на сайте **[render.com](https://render.com)** (через GitHub или Google аккаунт).
2. Нажмите синюю кнопку **«+ New»** ➔ выберите **«Web Service»**.
3. Подключите ваш репозиторий с проектом `yunusobod-bozori` (или выберите загрузку через Git).
4. Render автоматически распознает наш готовый `Dockerfile`!
5. В разделе **«Environment Variables»** добавьте:
   * `TELEGRAM_BOT_TOKEN`: `8676166803:AAGZDqo-IbXsttnLsrEPPq4s2EuWFcn8TVM`
   * `WEBAPP_URL`: ссылка, которую выдаст Render (например: `https://yunusobod-bozori.onrender.com`)
6. Нажмите **«Deploy Web Service»**.

**Готово!** Через 2 минуты проект соберется, и бот будет работать вечно! 🎉

---

## ⚡️ Вариант 2. Запуск на Railway.app (1 клик)

1. Зайдите на **[railway.app](https://railway.app)**.
2. Нажмите **«New Project»** ➔ **«Deploy from GitHub repo»**.
3. Укажите переменные окружения `TELEGRAM_BOT_TOKEN` и `WEBAPP_URL`.
4. Нажмите **«Deploy»**.

---

## 🖥 Вариант 3. Запуск на собственном VPS (Ubuntu / Debian)

Если у вас есть виртуальный сервер ($3/мес на Timeweb, Hetzner или DigitalOcean):
```bash
# 1. Склонировать проект на сервер
git clone <ваш_репозиторий>
cd yunusobod-bozori

# 2. Запустить через Docker Compose в фоновом режиме 24/7
docker compose up -d --build
```
Проект автоматически поднимется на порту 8000 и перезапустится при любых сбоях!
