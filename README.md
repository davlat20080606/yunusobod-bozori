# 🍈 Yunusobod Dehqon Bozori (Online Fresh Market & Telegram Mini App)

> **Toshkentning eng saralangan va yangi mahsulotlari: sabzavotlar, mevalar, go'sht, issiq tandir non va quruq mevalar to'g'ridan-to'g'ri rastalardan xonadoningizga!**

Full-Stack marketplace platform for **Yunusobod Dehqon Bozori (Tashkent, Uzbekistan)** built with **React (Telegram Mini App)**, **Python FastAPI Backend**, **Telegram Bot (`aiogram 3`)**, and **3 languages (O'zbekcha 🇺🇿, Русский 🇷🇺, English 🇬🇧)**.

---

## 🌟 Key Innovations & Seller Price Control

1. **Multi-Store Bazaar Experience (Do'konlar & Rastalar):**
   * Customers browse and enter actual stalls at Yunusobod Bazaar (*Anvar aka Go'sht Rastasi (№14)*, *Dilshod Ota Sabzavotlar (№1)*, *Zuhra Opa Samarqand Non & Somsa (№7)*, *Akmal Quruq Mevalar (№9)*, etc.).
2. **Instant Seller Price Control (Sotuvchi Kabineti):**
   * Sellers update prices on the fly without needing computers or technical skills.
   * Toggle in-stock / out-of-stock items in 1-click.
   * Toggle stall open / closed status for the day.
3. **Smart Weight & Quantity Selector:**
   * Support for fractional weights (0.5 kg, 1 kg, 1.5 kg for vegetables/fruits/meat) and piece counters (1 dona, 2 dona for tandir bread and somsa).
4. **Live Order Tracking & Bazaar Picker Checklist:**
   * Stepper timeline: `Qabul qilindi` ➔ `Sotuvchi tasdiqladi` ➔ `Bozorda saralanmoqda` ➔ `Kuryer yo'lda` ➔ `Yetkazildi`.
5. **Interactive Telegram Bot Simulator:**
   * Built-in interactive Telegram chat simulator to test the bot experience right in the browser.

---

## 🚀 Quick Start (Local Setup)

### 1. Install & Run Backend (FastAPI + SQLite)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```
* Backend API: `http://localhost:8000`
* Swagger Interactive Docs: `http://localhost:8000/docs`

### 2. Install & Run Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
* WebApp: `http://localhost:5173`

---

## 📱 Telegram Bot Setup (`aiogram 3`)

1. Create a bot with [@BotFather](https://t.me/BotFather) on Telegram and copy your `BOT_TOKEN`.
2. In `backend/.env`, set:
   ```env
   TELEGRAM_BOT_TOKEN="your_bot_token_here"
   WEBAPP_URL="https://your-deployed-domain.com"
   ```
3. Set your WebApp URL in `@BotFather` using `/setmenubutton` or `/newapp` to enable the native Telegram Mini App experience!

---

## 🛠 Tech Stack
* **Frontend:** React 18, Vite, Lucide Icons, Canvas Confetti, Telegram WebApp SDK, Custom Emerald Glassmorphism Design System.
* **Backend:** Python 3.10+, FastAPI, Async SQLAlchemy, SQLite (`bozor.db`), Pydantic v2, Aiogram 3.
* **Localization:** 3 languages (UZ, RU, EN) with zero-lag instant switching and database multi-language fields.
