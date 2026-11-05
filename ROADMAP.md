# Bozorbot — Texnik Roadmap

Yunusobod dehqon bozori boti uchun ishlar tartibi: @yunusobod_dehqon_bozori_bot, bozorbot.uz.
Versiya 3 · 2026-yil 31-oktabr. Boshqa reja bilan solishtirilgandan keyingi tuzatishlar kiritildi (pastda «Qabul qilingan qarorlar»).

---

## Qanday ishlaymiz

1. Qadamlar shu tartibda, **bittadan** bajariladi.
2. Har bir qadam oxirida Claude **qisqa hisobot** beradi:
   - nima qilindi: bazadagi o'zgarishlar, API, ekranlar;
   - testlar natijasi: yangi va eski testlar soni;
   - foydalanuvchi uchun nima o'zgardi (skrinshotlar bilan);
   - ochiq savollar va sizdan nima kerak.
3. Siz **tasdiqlaganingizdan** keyingina keyingi qadam boshlanadi. Har bir qadam alohida commit, kerak bo'lsa orqaga qaytarish oson.
4. Vaqtlar taxminiy: bu ish kunlari.

### Har bir qadam uchun «tayyor» mezoni (Definition of Done)

Har bir qadam quyidagilar bajarilganda tayyor hisoblanadi:
- bazadagi o'zgarish **migratsiya** orqali qilingan (T-qadamdan keyin Alembic), eski ma'lumot buzilmagan;
- yangi API'larga avtomatik testlar yozilgan, **barcha eski testlar ham o'tadi**;
- ekranlardagi barcha matnlar **3 tilda** (uz/ru/en), Telegram xabarlari ham;
- status o'zgarishlari **SSE** orqali darhol ko'rinadi;
- Bozorkom (admin) bu jarayonni ko'ra oladi va kerak bo'lsa aralasha oladi;
- yangi sozlamalar (limitlar, daqiqalar) kodda qotirilmaydi, **Sozlamalar** orqali o'zgartiriladi.

---

## Hozirgi arxitektura (qisqacha)

| Qism | Texnologiya |
|---|---|
| Backend | FastAPI + async SQLAlchemy, Python 3.12, bitta Docker konteyner |
| Frontend | React (Vite), Telegram Mini App; backend ichida beriladi |
| Baza | Neon Postgres (Frankfurt); lokal testlarda SQLite |
| Rasmlar | Cloudflare R2 (S3 API, boto3) |
| Bot | aiogram 3, webhook |
| Server | Render free (Frankfurt), GitHub `main`'dan avto-deploy |
| Real-time | SSE (`/api/events`), xotiradagi hub; kanallar `order:*`, `porter`, `taxi`, `store:*`, `admin` |
| Fon ishlari | `maintenance.run_forever()`, har 60 soniyada: eskirgan buyurtmalar, sovuq zanjir |
| Autentifikatsiya | Telegram `initData` HMAC; xodimlar va sotuvchilar uchun imzolangan tokenlar; PIN bo'yicha urinish cheklovi |
| Migratsiyalar | Alembic, ilova ishga tushganda avtomatik (T-qadamda qilindi) |

**Asosiy cheklovlar:**
- Render free 15 daqiqa so'rov bo'lmasa uxlaydi, shu payt fon ishlari to'xtaydi.
- SSE hub va urinish cheklovi xotirada saqlanadi, shuning uchun faqat **1 ta server jarayoni** bilan to'g'ri ishlaydi.
- ~~Testlar loyihada emas~~ — T-qadamda loyihaga ko'chirildi, CI'da ishlaydi.

### Qabul qilingan qarorlar (31-oktabr)

1. **Arxitektura o'zgarmaydi:** Python + FastAPI + SQLAlchemy + Alembic qoladi. Bozor hajmida (kuniga yuzlab buyurtma) til tor joy emas; ishlab turgan va testlangan tizimni qayta yozish 3–5 hafta oladi va foydalanuvchiga foyda bermaydi.
2. **To'lov qoidasi:**

   | Qanday oladi | To'lov |
   |---|---|
   | «O'zim olaman» — xaridor rastalardan o'zi oladi | Naqd, har bir sotuvchiga to'g'ridan-to'g'ri |
   | Aravachi tochkaga olib chiqadi / taksi uyga | **Faqat onlayn** (Click/Payme): +5% hold, vazn bo'yicha yechish |

   Natija: aravachi va taksichi pul ushlamaydi → naqd pulni tarqatish zanjiri yo'q. Eski «Naqd pul hisobi» qadami o'rniga **5-qadam — Onlayn to'lov** (avval 11-qadam edi) va u pilotdan oldin bo'ladi.
3. **Server:** hozirgi Render + Neon + R2 (serversiz) qoladi. VPS'ga faqat 7-qadamdagi yuklama testi o'tmasa yoki kuniga ~100+ buyurtma bo'lganda ko'chamiz.
4. **Redis:** SSE uchun Redis Pub/Sub faqat server 1 tadan ko'p jarayonda ishlashi kerak bo'lganda (7-qadam). Pilotga hozirgi xotiradagi hub yetadi.
5. **Savatda bron qilinmaydi:** qoldiq buyurtma berilganda band qilinadi, savatga qo'shilganda emas. Aks holda oxirgi mahsulotni savat bilan band qilib, sotib olmay turish mumkin bo'lardi.

---

## 0-bosqich — Sizdan kerak (kodsiz, parallel)

- [ ] Bozorkom → Sozlamalar: aravachi **12 500**, taksi **18 000** so'm.
- [ ] Topshirish joylarining haqiqiy nomlari (`config_store.HANDOFF_POINTS`).
- [ ] Telefondan bitta haqiqiy buyurtma: Telegram xabarlarini tekshirish.
- [ ] Qo'llab-quvvatlash telefoni.
- [ ] **Click va Payme merchant shartnomasi — pilotdan keyin** (proyekt hozir demo bosqichida). Kerak bo'ladi: yuridik shaxs/YaTT, bank hisob raqami, fiskal chek, MXIK kodlar. Provayderdan so'rash: **hold** qo'llaydimi va pulni hisobga necha kunda o'tkazadi?
- [ ] Bozor direktoriga demo: nima tayyor, nima jarayonda, nima qo'shiladi — bitta qatorda pilotga rozilik olish.
- [ ] VPS — faqat kerak bo'lganda (7-qadam): IP manzil, OS (Ubuntu 24.04), SSH kalit, joylashuvi.
- [ ] Yurist bilan:
  - shaxsiy ma'lumotlarni O'zbekistonda saqlash talabi;
  - ommaviy oferta va maxfiylik siyosati.
- [ ] **Biznes savollar** (quyida «Ochiq savollar»; 1–2 savolga javob berildi).

---

## 1-bosqich — Pilotdan oldin

### T-qadam. Texnik poydevor · ~1 kun

Keyingi qadamlarda bazaga ko'p ustun va jadval qo'shiladi, shuning uchun avval poydevor.

**Migratsiyalar:**
- **Alembic** ulanadi, hozirgi sxemadan boshlang'ich migratsiya (baseline) yaratiladi.
- Ishga tushishdagi `ALTER TABLE` bloklari olib tashlanadi. Deploy vaqtida `alembic upgrade head` ishlaydi.

**Buyurtma voqealari jurnali** (`order_events`):
- Ustunlar: `id`, `order_id`, `kind` (status/weight/missing/code/no_show/…), `from_status`, `to_status`, `actor_role` (customer/seller/porter/taxi/admin/system), `actor_id`, `data` (JSON), `created_at`.
- Barcha status o'zgarishlari shu yerga yoziladi.
- Bu jurnal 3–6 va 9-qadamlar uchun asos: vaqtlarni o'lchash, nizolarni hal qilish, tahlil.

**Testlar:**
- Hozirgi 9 ta test to'plami loyihaga ko'chiriladi (`backend/tests/`, pytest + httpx; brauzer testlari `e2e/`).
- **GitHub Actions:** har bir push'da API testlari ishlaydi. Testlar o'tmasa, deploy qilinmaydi.

**Tayyor mezoni:** toza va hozirgi bazada migratsiya muammosiz o'tadi, CI yashil, hech bir ekran o'zgarmagan.

---

### 1-qadam. Soxta buyurtmalardan himoya · ~1 kun

**Baza** (`customers` jadvaliga ustunlar):
- `phone_verified_at`
- `completed_orders` (int)
- `strikes` (int)
- `debt` (so'm)
- `blocked_at`, `blocked_reason`

**Telefonni tasdiqlash:**
- Mini App `Telegram.WebApp.requestContact()` chaqiradi.
- Telegram kontaktni botga xabar sifatida yuboradi.
- Bot `message.contact.user_id == message.from_user.id` ekanini tekshiradi, keyin `customers.phone` va `phone_verified_at` ni yozadi.
- Qo'lda yozilgan raqamni soxtalashtirib bo'lmaydi.
- Mini App tasdiqni SSE yoki qisqa so'rov orqali kutadi.

**Buyurtma yaratishda limitlar** (`POST /api/orders`):
- Telegram'dan tashqari (brauzerdan) buyurtma: alohida qaror kerak (ochiq savollarda).
- `completed_orders == 0` bo'lsa: bir vaqtda 1 ta ochiq buyurtma, `total ≤ new_customer_max_total` (standart 500 000).
- Hammaga: ochiq buyurtmalar ≤ `max_open_orders` (standart 3).
- `blocked_at` bo'lsa: 403 va tushunarli xabar.

**So'rovlar cheklovi:**
- `tg_id` va IP bo'yicha sirpanuvchi oyna (sliding window): buyurtma va quote uchun daqiqasiga N ta.
- Bitta jarayonda xotirada saqlanadi (VPS'dan keyin ham yetarli).

**Bozorkom:**
- Xaridorlar ro'yxati: qidiruv, buyurtmalar soni, strike'lar, qarz.
- «Bloklash / blokdan chiqarish» tugmasi.
- API: `GET /api/admin/customers`, `PATCH /api/admin/customers/{id}`.

**Chekka holatlar:**
- Xaridor raqamini o'zgartirsa, qayta tasdiqlash kerak.
- Bitta raqam ikki Telegram akkauntda bo'lishi mumkin; bunga ruxsat bor, lekin strike'lar raqam bo'yicha ham hisoblanadi.
- Telegram eski versiyasida `requestContact` yo'q bo'lsa, bot ichida «📱 Raqamni yuborish» tugmasi ishlatiladi.

**Testlar:**
- limitlar;
- bloklangan xaridor;
- soxta kontakt (boshqa odamning `user_id`'si bilan);
- so'rovlar cheklovi.

---

### 2-qadam. Qoldiqni avtomatik hisoblash · ~1,5 kun

**Baza:**
- `products.stock_reserved` (float).
- `products.track_stock` (bool): qoldiq kuzatiladimi. Bozordagi har bir mahsulotni sanab bo'lmaydi, sotuvchi o'zi tanlaydi.
- `order_items.stock_reserved_qty`
- `stock_moves` jadvali (audit uchun): `product_id`, `order_id`, `delta`, `kind` (reserve/release/consume/manual/morning), `created_at`.

**Mantiq** (`services/stock.py`):
- **reserve.** Buyurtma yaratilganda bitta tranzaksiya ichida **atomar shartli UPDATE** ishlatiladi:
  `UPDATE products SET stock_reserved = stock_reserved + :q WHERE id = :id AND stock_quantity - stock_reserved >= :q`.
  Agar 0 qator o'zgarsa, 409 «Qolmadi» qaytariladi.
  Shu tufayli ikki xaridor oxirgi 1 kg ni bir vaqtda ololmaydi.
- **consume.** Sotuvchi «Topshirdim» bosganda `stock_quantity -= actual_quantity ?? quantity` va `stock_reserved -= reserved`.
- **release.** Bekor qilish, «Tugadi», xaridor kelmasa: band qilingan miqdor qaytadi.
- `stock_quantity - stock_reserved <= 0` bo'lsa, ro'yxatda «Tugadi» ko'rinadi (`is_available` qo'lda o'chirilgandan alohida).
- «Tugadi» tugmasi `stock_quantity = 0` qiladi.

**Ertalabki ro'yxat:**
- Fon ishi har kuni 07:00 da (Toshkent vaqti) har bir rasta egasi va yordamchilariga bot xabari yuboradi: «Bugun nima bor?» tugmasi bilan.
- Ochiladigan ekran: mahsulotlar ro'yxati, har birida **bor/yo'q** almashtirgich va miqdor maydoni.
- «Saqlash» bosilganda bitta so'rov ketadi: `POST /api/seller/stock/morning`.
- Kam qolganda ogohlantirish: ostona sotuvchi tomonidan belgilanadi.

**Chekka holatlar:**
- Vazn ±5% bo'lgani uchun consume haqiqiy vazn bilan qilinadi.
- Sovg'a qatori (0 so'm) ham qoldiqdan yechiladi.
- Admin buyurtmani qo'lda bekor qilsa ham release ishlaydi.
- Savatda bron yo'q (qarorlar, 5-band): savatdagi mahsulot shu orada tugasa, xaridor buni rasmiylashtirishda «faqat N kg qoldi» deb ko'radi.

**Testlar:**
- bir vaqtdagi 10 ta parallel buyurtma: 1 kg qoldiq bo'lsa, faqat bittasi o'tadi;
- reserve → consume → release balansi;
- ertalabki ro'yxat.

---

### 3-qadam. «Xaridor kelmadi» oqimi · ~1,5 kun · ✅ qilindi

**Kutish qachon boshlanadi** (`orders.waiting_since`):
- tochka: aravachi «Joyga olib keldim» bosganda;
- uyga: taksichi (yoki o'zi olib borgan aravachi) **«📍 Yetib keldim»** bosganda — bosmasa, «Kelmadi» umuman ochilmaydi;
- «O'zim olaman»: hamma rastalar «Tayyor» bosganda.

**Taymerlar** (Sozlamalardan o'zgaradi):

| Vaqt | Nima bo'ladi |
|---|---|
| +10 daqiqa | Bot xaridorga «Sizni kutishyapti» deb eslatadi; ishchi ekranida «📞 Xaridorga qo'ng'iroq» |
| +15 daqiqa | «😔 Xaridor kelmadi» tugmasi ochiladi (server ham vaqtni tekshiradi) |
| «O'zim olaman»: +60 / +120 daqiqa | Eslatma / server o'zi «kelmadi» deb yopadi (rastaga hech narsa berilmagan bo'lsa) |
| kelmadi + 60 daqiqa | Mahsulot hali rastaga qaytmagan bo'lsa — ishchiga va Bozorkomga signal (bir marta) |

**Qaytarish:** statuslar `no_show` → `returned`. Ishchi ekranida rastalar bo'yicha qaytarish ro'yxati, go'sht va sut «🌡 birinchi». Sotuvchi «✅ Qaytib oldim» bosadi — mahsulot qoldiqqa qaytadi (`stock_moves.kind = return`). Rastadan chiqmagan mahsulot darhol sotuvga qaytadi.

**Xato bo'lsa:** xaridor trekerda «🙋 Men shu yerdaman» bosadi — ishchi va Bozorkom xabar oladi. Mahsulot hali qaytmagan bo'lsa, ishchi yoki Bozorkom «Xaridor keldi» bilan bekor qiladi.

**Pul:** yo'qotilgan haq (`orders.no_show_fee` = aravachi, taksi bo'lsa + taksi) yozib qo'yiladi; 5-qadamda hold'dan yechiladi. Qarzni keyingi buyurtmaga o'tkazish **qilinmadi**: pilot «O'zim olaman» bilan o'tadi, u yerda xizmat haqi yo'q.

**Strike:** 90 kun ichida `no_show_strikes` (2) marta kelmasa — yangi buyurtma yopiladi (onlayn to'lov paydo bo'lgach: faqat oldindan to'lov bilan). Bozorkom «Xaridorlar» bo'limida sonini ko'radi va «🤝 Kechirish» qila oladi.

**Testlar:** API — 3 ta (tochka, uyga, «O'zim olaman» + strike); brauzer — 13 ta tekshiruv.

---

### 4-qadam. Taksichi nazorati · ~1,5 kun · ✅ qilindi

**Darvoza taymeri** (taksichi «5/10/15/20 daqiqada yetaman» deydi):
- Taksichi ekranida: «Darvozada bo'ling: N daqiqa qoldi», vaqt o'tsa qizil «Kechikyapsiz! N daqiqadan keyin buyurtma boshqa taksichiga beriladi».
- Va'da + 5 daqiqa (`taxi_gate_grace_min`) o'tib, «Qabul qildim» bosilmasa — server buyurtmani o'zi oladi:
  - barcha taksichilarga qayta yuboriladi, aravachiga «Taksichi kelmadi» xabari;
  - kechikkan taksichiga xabar va incident (`late_to_gate`);
  - u keyin «Qabul qildim» bosmoqchi bo'lsa — 409 «buyurtma boshqa taksichiga berilgan».
- **«↩️ Bora olmayman»** — taksichi o'zi qaytaradi (incident `released`, alohida sanaladi).
- Bitta buyurtmada taksichi 2 marta (`taxi_reassign_alert`) almashsa — Bozorkomga signal.
- Topshirish kodi o'zgarmaydi.

**Yo'l taymeri:** «Qabul qildim» dan 60 daqiqa (`taxi_trip_max_min`) o'tib yetkazilmasa (va eshik oldida kutmayotgan bo'lsa) — Bozorkomga (taksichi telefoni bilan) va xaridorga bir marta ogohlantirish, incident `late_delivery`.

**Jonli joylashuv:**
- Taksichi buyurtmani olganda bot «📎 → Joylashuv → Jonli joylashuvni ulashish» deb so'raydi; ekranda ham shu ko'rsatma, ulashilsa «📍 Joylashuv ulashilmoqda».
- Webhook endi `edited_message` ham oladi; har 10 soniyada ko'pi bilan bir nuqta yoziladi (`orders.taxi_lat/lng/loc_at`), SSE orqali trekerga boradi.
- Xaridor xaritasida 🚕 belgisi va «🗺 Taksi qayerda» havolasi — faqat yo'lda bo'lganda va nuqta 10 daqiqadan eski bo'lmasa. Sotuvchiga ko'rinmaydi.
- O'zi olib borgan aravachi ham ulasha oladi.

**Bozorkom:** «Xodimlar» da har ishchi yonida 30 kunlik incidentlar («darvozaga kelmadi 1 · qaytardi 1 · kechikib yetkazdi 1»); 3 ta yangi sozlama.

**Rejadan farqi:** mashina raqami/modeli/rangi alohida maydonlarga bo'linmadi — anketada «Mashina va raqami» allaqachon majburiy, Bozorkom tasdiqlaydi. Navigator tugmalari avvaldan bor edi.

**Testlar:** server 2 ta yangi (darvoza taymeri, qaytarish, incidentlar, yo'l taymeri, joylashuv), brauzer 18 tekshiruv.

---

### 5-qadam. Onlayn to'lov (Click / Payme) va rastalar hisobi · ~3 kun

(Avval 11-qadam edi. Merchant shartnomasi va sandbox kalitlar kerak — pilotdan keyin. Kod sandbox bilan oldinroq tayyorlanishi mumkin.)

**Qoida:** yetkazish (aravachi tochkaga / taksi) faqat onlayn to'lov bilan; «O'zim olaman» — naqd, sotuvchiga to'g'ridan-to'g'ri.

**Baza:**
- `payments`: `order_id`, `provider` (click/payme), `held_amount`, `captured_amount`, `status` (created/held/captured/released/failed), `provider_id`, vaqtlar.
- `store_payouts`: har bir rasta uchun kunlik summa (mahsulot − bonus/chegirma ulushi) va to'langanlik belgisi.

**Oqim:**
1. **Hold:** checkout'da taxminiy summaning **105%** i kartada band qilinadi. Hold muvaffaqiyatli bo'lmaguncha buyurtma rastalarga ko'rinmaydi.
2. **Tortish:** sotuvchi haqiqiy vaznni kiritadi (±5% chegara allaqachon bor).
3. **Capture:** buyurtma topshirilganda haqiqiy summa yechiladi, qolgani darhol qaytariladi. «Tugadi» qatorlari summadan chiqadi.
4. **Fiskal chek** (Soliq OFD, MXIK kodlar bilan): provider orqali yoki alohida integratsiya — buxgalter bilan aniqlashtiriladi.
- Bekor qilish: hold to'liq qaytariladi. Xaridor kelmasa: faqat xizmat haqi yechiladi (3-qadam).
- Provider hold'ni qo'llamasa: to'liq summa oldindan yechiladi, farq avtomatik qaytariladi (refund).

**Texnik:** idempotent webhook'lar, imzo tekshiruvi, takroriy webhook xavfsiz; hold muddati tugashidan oldin capture qilinmagan to'lovlar Bozorkomga signal.

**Kimga qachon to'lanadi** (qaror):
- Faqat **yetkazilgan** buyurtmalar uchun. Yetkazishdan oldin bekor qilinsa, hold qaytadi va hech kimga to'lanmaydi.
- Sotuvchi va aravachi/taksichiga **kuniga bir marta, kechqurun** (vaqti Sozlamalarda, masalan 21:00) — shu kuni yetkazilganlar summasi. Eng kechi ertasi ertalab: **1 kundan oshmaydi**.
- Provider pulni hisobga kechroq o'tkazsa (odatda 1 ish kuni), hisobda kichik aylanma zaxira kerak.

**Rastalar hisobi:** Bozorkom ekranida «💰 Rastalarga to'lov» — har bir rastaga kunlik summa, Excel; sotuvchi o'z kabinetida bugungi onlayn tushumini ko'radi.

**Chekka holatlar:** vazn o'zgarishi, «Tugadi», birlashtirilgan buyurtmalar, bonus qaysi rasta hisobidan, qisman qaytarish, webhook kechikishi.

**Testlar:** sandbox'da hold → capture → refund; summalar 1 so'mgacha mos tushadi; takroriy webhook ikki marta yechmaydi.

---

### 6-qadam. Tahlil, ogohlantirishlar, zaxira nusxa · ~1,5 kun · ✅ qilindi

**«📊 Tahlil» (Bozorkom kabineti):** bugun / 7 kun / 30 kun.
- buyurtmalar, yetkazildi, savdo, o'rtacha chek; bekor va «kelmadi» foizi (ko'p bo'lsa qizil);
- qanday olishadi (o'zi / tochka / uyga);
- **bosqich vaqtlari** (o'rtacha va 90-persentil): aravachi olguncha → yig'ish → xaridorga yetguncha → jami — `order_events` dan;
- hafta kuni × soat xaritasi (Toshkent vaqti);
- eng ko'p «Tugadi», vaznga rozi bo'lmaganlar, rastalar savdo bo'yicha, aravachi va taksichilar;
- **«📄 Excel faylni botga yuborish»** — Mini App ichida fayl yaxshi yuklanmaydi, shuning uchun bot CSV ni Bozorkom chatiga yuboradi. Faylda xaridor ismi/telefoni yo'q.

**Kunlik hisobot:** 21:00 da (sozlanadi) Bozorkomga: buyurtmalar, savdo, o'rtacha vaqt, «Tugadi»; tugma «📊 Tahlil» ni ochadi.

**Xato signali:** server ERROR yozsa, Bozorkom Telegram'iga «🚨 Serverda xato»; bir xil xato 10 daqiqada ko'pi bilan 1 marta. Fon tekshiruvidagi xatolar ham shunga kiradi.

**Zaxira nusxa** (rejadan farqi: `pg_dump` o'rniga):
- serverda `pg_dump` yo'q, shuning uchun server o'zi barcha jadvallarni bitta faylga yozadi (SQLite va Postgres'da bir xil ishlaydi);
- R2 havola orqali o'qiladi (rasmlar u yerdan), shuning uchun nusxa **`BACKUP_KEY` bilan shifrlanadi**; kalit yo'q bo'lsa nusxa olinmaydi va `/api/health` «off» deydi;
- har kecha 03:00 da `backups/YYYY-MM-DD.json.gz.enc`; 14 kun + 8 hafta dushanbalari saqlanadi;
- «💾 Hozir nusxa olish» tugmasi; tiklash: `backend/scripts/restore_backup.py` (DEPLOY.md).
- **Tiklash sinovi** testda: nusxa yangi bazaga tiklanadi, har jadval qatorlari va buyurtmalar bir xil; CI'da Postgres'da ham.

**Sizdan:** Render'ga `BACKUP_KEY` qo'shish va uni parol menejerida ham saqlash.

**Testlar:** server 7 ta yangi + Postgres'da tiklash, brauzer 12 tekshiruv.

---

### Pilotdan oldingi xavfsizlik · ✅ qilindi

Sherik ilovasi bilan solishtirishdan keyin qilindi:
- **«Faqat O'zim olaman»** kaliti (Sozlamalar, yangi serverda yoqilgan): yetkazish va tochkani server ham rad etadi.
- **«Buyurtmani oldim»** tochka va uyga uchun faqat ishchi kodni kiritgandan keyin chiqadi; yo'lda bosib buyurtmani yopib bo'lmaydi.
- **Tasdiqlash oynasi:** «Yetib keldim» va «Buyurtmani oldim».
- **Telefon:** qo'lda yozilgan raqam faqat +998 + 9 raqam yoki 9 raqam (server ham tekshiradi). Telegram orqali ulashilgan raqam tegilmaydi.

**Yetkazishni yoqishdan oldin:**
- Kod faqat «Yetib keldim» dan keyin qabul qilinadi, 5 ta urinish.
- Kuryer joylashuvi va 100 metr **serverda** tekshiriladi (sherik bilan kelishildi): kuryerdan lokatsiyani yoqish so'raladi. GPS yo'q yoki xato bo'lsa, buyurtma qulflanib qolmaydi, Bozorkomga signal boradi.
- Tochkalarga koordinata.

**Pilotdan keyin:** qabul qiluvchini o'zgartirish (qulf taksi buyurtmani olgan paytdan), manzil qidiruvi xizmatini tekshirish.

**Simulyator** production'ga chiqmaydi (kelishildi). Bizda `TelegramBotSimulator.jsx` hech qayerda ishlatilmaydi.

---

### 7-qadam. Yuklama testi, band rejim, kerak bo'lsa VPS · ~1–2 kun

**Avval yuklama testi** hozirgi Render + Neon'da o'tkaziladi (pastda). Natija yaxshi bo'lsa, server o'zgarmaydi; faqat Render'ning uxlamaydigan pullik tarifiga o'tish tavsiya etiladi.

**VPS'ga faqat quyidagi hollarda ko'chamiz:** yuklama testi o'tmadi, kuniga ~100+ buyurtma, yoki yurist ma'lumotni O'zbekistonda saqlashni talab qildi.

**Redis Pub/Sub** (bir nechta jarayon kerak bo'lganda): SSE hub va so'rovlar cheklovi Redis'ga ko'chadi (`bazar:order:<id>`, `porter`, `store:<id>` kanallari). Har qanday jarayon yoki fon ishi xabar chiqaradi, Redis uni kerakli xaridor/aravachi oqimiga yetkazadi.

#### VPS bo'lsa

**Server tuzilishi** (docker compose):
- **Caddy:** avtomatik HTTPS, `bozorbot.uz` va `www`.
- **app:** hozirgi Docker image, 1 ta jarayon (SSE hub uchun).
- **postgres 16:** VPS O'zbekistonda bo'lsa. Aks holda Neon qoladi.
- **backup** cron konteyneri.
- Tizim: `restart: always`, UFW faqat 22/80/443 portlarini ochadi, SSH faqat kalit bilan, fail2ban.
- Deploy: GitHub Actions → SSH → `docker compose pull && up -d` va migratsiya.

#### Ko'chish rejasi (~15 daqiqalik to'xtash, kechasi):
1. Yangi serverni to'liq sozlash va test domenida tekshirish.
2. Render'da yangi buyurtmalar to'xtatiladi (texnik ishlar rejimi).
3. Neon'dan `pg_dump` olinib, VPS bazasiga tiklanadi va qatorlar soni solishtiriladi.
4. DNS VPS'ga o'tkaziladi, Telegram webhook yangilanadi.
5. Smoke-test: health, buyurtma, SSE, R2.
6. **Orqaga qaytish rejasi:** muammo bo'lsa, DNS va webhook Render'ga qaytariladi; Render 7 kun o'chirilmaydi.

**Yuklama testi** (Locust):
- Ssenariy: 200 xaridor (katalog → quote → buyurtma → trekerda SSE), 30 aravachi (ro'yxat → olish → belgilash), 20 sotuvchi; 1 soat.
- Maqsad: so'rovlarning 95% i 500 ms dan tez, xato 0, SSE uzilmaydi.
- Topilgan sekin so'rovlarga indeks va so'rov optimizatsiyasi.

**Band rejim:**
- Aravachida «🟢 Ishdaman / ⚪ Tanaffus» almashtirgichi (`staff.on_shift`, `last_seen_at`).
- `yuklama = ochiq kuryer/tochka buyurtmalar / max(1, smenadagi aravachilar)`.
- Yuklama `busy_ratio` (standart 3) dan oshsa:
  - checkout'da «Hozir band: ~N daqiqa» ko'rsatiladi;
  - eng yaqin bo'sh slot taklif qilinadi.
- Bozorkomda «⏸ Kuryer buyurtmalarini to'xtatish» tugmasi (`accept_delivery = false`). «O'zim olaman» ishlashda davom etadi.

---

## 2-bosqich — Pilot · 2 hafta

- 1 qator: 5–10 rasta, 2–3 aravachi, 1–2 taksichi, 20–50 tanish xaridor.
- Pilot **«O'zim olaman» (naqd)** bilan boshlanadi; yetkazish Click/Payme shartnomasi va 5-qadam tayyor bo'lganda yoqiladi.
- 2 hafta — taxminiy: muammosiz o'tsa ertaroq tugashi mumkin, lekin shoshilmaymiz.
- **Ko'rsatkichlar** (6-qadamdagi tahlildan):

| Ko'rsatkich | Maqsad |
|---|---|
| Buyurtmadan topshirishgacha (tochka) | ≤ 40 daqiqa |
| «Tugadi» bo'lgan qatorlar | ≤ 5% |
| Bekor qilish | ≤ 5% |
| Xaridor kelmadi | ≤ 3% |
| Onlayn to'lov: capture qilinmagan yoki mos kelmagan to'lovlar kun oxirida | 0 |
| Server xatolari | 0 kritik |

- Har hafta qisqa xulosa, topilgan muammolar navbatdan tashqari tuzatiladi.

---

## 3-bosqich — O'sish (pilotdan keyin)

### 8-qadam. «Buyurtmani takrorlash» · ~0,5 kun

- `POST /api/orders/{num}/reorder-preview` har bir qator uchun quyidagilarni qaytaradi:
  - hozirgi narx va eski narx;
  - mavjudligi (qoldiq, rasta ochiqmi);
  - o'xshash mahsulot (shu rastada, shu kategoriyada).
- Trekerdagi eski buyurtmada «🔁 Takrorlash» tugmasi. Mavjud qatorlar savatga tushadi, qolganlari «Bu safar yo'q» bo'limida, narxi o'zgarganlar belgilangan bo'ladi.
- Buyurtma avtomatik berilmaydi: xaridor savatda ko'rib tasdiqlaydi.
- **Keyinroq:** `customers.weekly_reminder` (kun + soat). Bot o'sha payt «O'tgan haftagi savatni takrorlaymizmi?» deb yozadi.

### 9-qadam. Aravachi va sotuvchi reytingi · ~1,5 kun

**Baza:** `staff_stats` va `store_stats`. Har kecha `order_events` bo'yicha **oxirgi 30 kun** uchun hisoblanadi.

**Ko'rsatkichlar:**
- **Aravachi:**
  - olishdan tochkagacha bo'lgan vaqt (mediana);
  - «voz kechdim» va incident'lar;
  - xaridor bergan yulduzchalar.
- **Sotuvchi:**
  - buyurtmadan «Tayyor»gacha bo'lgan vaqt;
  - vazn aniqligi (`|actual − qty| / qty` o'rtachasi);
  - «Tugadi» foizi;
  - yulduzchalar.

**Formula:**
- **Bayes o'rtachasi:** `(C·m + Σ) / (C + n)`, bu yerda `m` — bozor o'rtachasi, `C` — 10. Yangi odam 1 ta yomon buyurtma bilan jazolanmaydi.
- Umumiy ball 0–100, ko'rsatkichlar vaznlari bilan. Vaznlar Sozlamalarda o'zgartiriladi.

**Ishlatilishi:**
- Yuqori balli aravachilar yangi buyurtmani darhol ko'radi, qolganlar 30 soniyadan keyin (`available` ro'yxati va SSE signali kechiktiriladi).
- 85+ ballli rastalarga «⭐ Ishonchli rasta» belgisi va ro'yxatda yuqoriroq o'rin.
- Boshida reyting faqat Bozorkom va odamning o'ziga ko'rinadi.

### 10-qadam. Texnik mustahkamlash · ~1,5 kun

- **Staging:** (Render yoki VPS'da) alohida `staging.bozorbot.uz`, alohida baza va test boti. Avval staging'ga, keyin qo'lda tasdiqlab prod'ga.
- Brauzer (e2e) testlari CI'da kechasi ishlaydi.
- Monitoring:
  - uptime tekshiruvi (masalan, UptimeRobot) har 1 daqiqada;
  - disk va xotira ogohlantirishlari.
- Xavfsizlik:
  - bog'liqliklarni yangilash (Dependabot);
  - sirlar faqat serverdagi `.env`'da;
  - adminlar uchun 2-bosqichli kirish (Telegram orqali).

### 11-qadam. ~~Onlayn to'lov~~ → 5-qadamga ko'chirildi

---

## Ochiq savollar (javobingiz kerak)

1. ~~Naqd pulni kim yig'adi?~~ **Javob:** naqd faqat «O'zim olaman» da, sotuvchiga to'g'ridan-to'g'ri. Yetkazish faqat onlayn.
2. ~~Xizmat haqini kim kimga beradi?~~ **Javob:** onlayn to'lovdan; aravachi va taksichi pul ushlamaydi. Har kuni kechqurun, faqat yetkazilgan buyurtmalar uchun (5-qadam).
3. Xaridor kelmasa, **qaytgan go'sht** uchun sotuvchiga kompensatsiya kerakmi yoki faqat qaytarish yetarlimi?
4. **Telegram'dan tashqari** (oddiy brauzerdan) buyurtma berish ruxsat etiladimi? Ruxsat bo'lsa, telefonni SMS bilan tasdiqlash kerak (pullik xizmat).
5. Yangi xaridor uchun boshlang'ich limit **500 000 so'm** to'g'rimi?
6. Ertalabki ro'yxat soati: **07:00** to'g'rimi?
7. ~~VPS qaysi davlatda?~~ Hozir kerak emas (qarorlar, 3-band).

---

## Qisqa jadval

| # | Qadam | Vaqt | Asosiy texnik ish |
|---|---|---|---|
| T | Texnik poydevor | 1 kun | Alembic, `order_events`, testlar loyihaga, CI |
| 1 | Soxta buyurtmalardan himoya | 1 kun | `requestContact`, limitlar, so'rovlar cheklovi, qora ro'yxat |
| 2 | Qoldiq | 1,5 kun | Atomar band qilish, `stock_moves`, ertalabki ro'yxat |
| 3 | Xaridor kelmadi ✅ | 1,5 kun | Taymerlar, `no_show`/`returned`, qaytarish, strike |
| 4 | Taksichi nazorati | 1,5 kun | ETA taymeri, avto-qayta berish, jonli joylashuv, navigator |
| 5 | Click / Payme + rastalar hisobi | 3 kun | Hold +5%, capture, webhook'lar, fiskal chek, `store_payouts` |
| 6 | Tahlil + alertlar + zaxira | 1,5 kun | SQL agregatsiyalar, kunlik hisobot, `pg_dump` → R2 |
| 7 | Yuklama + band rejim (+ kerak bo'lsa VPS/Redis) | 1–2 kun | Locust; zarur bo'lsa Caddy, Redis Pub/Sub |
| — | **Pilot** | 2 hafta | Ko'rsatkichlar |
| 8 | Takrorlash | 0,5 kun | reorder-preview |
| 9 | Reyting | 1,5 kun | `staff_stats`, Bayes, buyurtmani ko'rish navbati |
| 10 | Mustahkamlash | 1,5 kun | Staging, monitoring, xavfsizlik |

Pilotgacha jami: **~12 ish kuni** (+ Click/Payme shartnomasini kutish; u bo'lmasa pilot «O'zim olaman» bilan boshlanadi).
