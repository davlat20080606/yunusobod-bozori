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

### 3-qadam. «Xaridor kelmadi» oqimi · ~1,5 kun

**Baza:**
- `orders.at_point_at`, `orders.arrived_at_address_at`
- `orders.no_show_at`, `orders.cancel_reason`
- `orders.debt_from_previous` (so'm) — faqat 5-qadamgacha zaxira variant uchun
- Yangi statuslar: `no_show` va `returned` (mahsulot rastaga qaytdi).

**Taymerlar** (`maintenance` ichida, har 60 soniyada):

| Vaqt (tochkaga yetgandan/manzilga kelgandan) | Nima bo'ladi |
|---|---|
| +10 daqiqa | Bot xaridorga eslatadi; aravachi/taksichida «📞 Qo'ng'iroq» tugmasi |
| +15 daqiqa | «Xaridor kelmadi» tugmasi ochiladi (oldin bosib bo'lmaydi; server ham tekshiradi) |
| no_show + 60 daqiqa | Sovuq mahsulotlar qaytarilmagan bo'lsa, Bozorkomga ogohlantirish |

Daqiqalar Sozlamalardan o'zgartiriladi.

**Qaytarish:**
- Aravachi ekranida rastalar bo'yicha qaytarish ro'yxati chiqadi.
- Sotuvchi «Qaytib oldim» bosadi. Shundan keyin stock release ishlaydi va status `returned` bo'ladi.
- Go'sht va sovuq mahsulot ro'yxatda **birinchi** turadi (kategoriya bo'yicha belgilanadi).

**Pul** (to'lov qoidasiga ko'ra):
- **Yetkazish (aravachi/taksi):** buyurtma onlayn to'langan (hold). Xaridor kelmasa, aravachi/taksi haqi hold'dan yechiladi, mahsulot puli qaytariladi (5-qadam tayyor bo'lgach ulanadi). Qarzni keyingi buyurtmaga o'tkazish kerak emas.
- **«O'zim olaman»:** pul hali olinmagan, shuning uchun faqat strike. Rasta yig'ib qo'ygan buyurtmani xaridor olmasa, mahsulot rastada qoladi va qoldiqqa qaytadi.
- 5-qadamgacha (onlayn to'lov yo'q paytda) zaxira varianti: haqi `customers.debt` ga yoziladi va keyingi buyurtmada «Oldingi xizmat haqi: X so'm» bo'lib chiqadi.

**Strike:**
- `strikes += 1`.
- `strikes >= 2` bo'lsa: «O'zim olaman» yopiladi, faqat oldindan onlayn to'lov bilan buyurtma berish mumkin.
- 90 kun toza yurgan xaridorda strike'lar avtomatik 1 taga kamayadi.

**Chekka holatlar:**
- Xaridor 16-daqiqada keldi: «Kelmadi» hali bosilmagan bo'lsa, oddiy topshirish; bosilgan bo'lsa, admin bekor qila oladi.
- Birlashtirilgan buyurtmalar (A/B/C sumkalar): faqat kelmaganining sumkasi qaytadi.
- Aravachi «Kelmadi»ni noto'g'ri bosdi: xaridor Telegramdan «Men shu yerdaman» tugmasini bosadi, Bozorkomga signal boradi.

**Testlar:** vaqtni simulyatsiya qilib taymerlar, strike, qarz keyingi buyurtmada, qoldiq qaytishi.

---

### 4-qadam. Taksichi nazorati · ~1,5 kun

**Baza:**
- `staff.car_plate`, `staff.car_model`, `staff.car_color`
- `orders.taxi_taken_at`, `orders.taxi_reassign_count`
- `orders.taxi_lat`, `orders.taxi_lng`, `orders.taxi_loc_at`
- `staff_incidents` jadvali: `staff_id`, `order_id`, `kind` (late_to_gate/late_delivery/released/no_show_reported), `created_at`.

**Taymerlar:**
- **Darvozaga kelmadi:** `taxi_eta_at + 5 daqiqa` o'tdi va aravachi hali topshirmagan:
  - buyurtma avtomatik bo'shatiladi (`taxi_phone = null`);
  - incident yoziladi;
  - taksi kanaliga SSE va ovozli signal;
  - taksichiga va xaridorga xabar.
  - 2 marta qayta berilsa, Bozorkomga signal.
- **Yetkazmadi:** `handed_over_at + kutilgan vaqt + 20 daqiqa`:
  - Bozorkomga va xaridorga ogohlantirish;
  - adminda taksichi telefoni va mashina raqami.

**Jonli joylashuv:**
- Taksichi buyurtmani olganda bot «📍 Jonli joylashuvni ulashing» deb so'raydi.
- Telegram `live_location` `edited_message` orqali har bir necha soniyada keladi; bot `tg_id` bo'yicha buyurtmani topib koordinatani yozadi.
- SSE `order:*` orqali uzatiladi. Xaridor trekerida «Taksi qayerda» xarita havolasi.

**Navigator:** taksichi ekranida manzil uchun «Yandex Navigator» va «Google Maps» tugmalari (deep-link, koordinata bilan).

**Ro'yxatdan o'tish:**
- Taksichi anketasida mashina raqami, modeli va rangi majburiy.
- Bozorkom tasdiqlaydi (hozirgi `staff.status` mexanizmi).

**Chekka holatlar:**
- Taksichi joylashuvni yubormadi: majburiy emas, faqat taymerlar ishlaydi.
- Buyurtma qayta berilganda topshirish kodi o'zgarmaydi.
- Eski taksichi kech kelib «oldim» bosmoqchi bo'lsa: 409.

**Testlar:** ETA taymeri va qayta berish, incident'lar, joylashuv yangilanishi (fake bot bilan).

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

### 6-qadam. Tahlil, ogohlantirishlar, zaxira nusxa · ~1,5 kun

**Tahlil** (`/api/admin/analytics?from=&to=`). `orders`, `order_items` va `order_events` bo'yicha SQL agregatsiyalar:
- hafta kuni × soat bo'yicha buyurtmalar (issiqlik xaritasi);
- aylanma, o'rtacha chek, fulfillment bo'yicha ulush;
- bekor qilish va «kelmadi» foizi, sabablari bilan;
- **bosqich vaqtlari** (o'rtacha va 90-persentil): yaratildi → aravachi oldi → yig'ildi → tochka/taksi → topshirildi;
- eng ko'p «Tugadi» bo'lgan mahsulotlar va rastalar;
- vazn bo'yicha rad etilgan urinishlar (±5% dan tashqari);
- eng faol rastalar va aravachilar.

**Bozorkom ekrani:** «📊 Tahlil» bo'limi; davr tanlash (bugun/7 kun/30 kun) va CSV eksport.

**Kunlik hisobot:** fon ishi 21:00 da adminlarga Telegram xabar yuboradi: buyurtmalar, aylanma, o'rtacha vaqt, top «Tugadi», yopilmagan pul yozuvlari.

**Xatolik ogohlantirishlari:**
- `logging` handler ERROR darajasidagi xatolarni admin chatga yuboradi.
- Bir xil xato 10 daqiqada 1 marta keladi (throttle).
- Sentry ixtiyoriy.

**Zaxira nusxa:**
- Har kuni 03:00 da `pg_dump` qilinadi, gzip bilan siqiladi va R2 `backups/` papkasiga yoziladi.
- 14 kunlik + 8 haftalik nusxalar saqlanadi.
- **Tiklash sinovi:** nusxa alohida bazaga tiklanib, qatorlar soni solishtiriladi.

**Testlar:** analitika natijalari qo'lda hisoblangan raqamlar bilan solishtiriladi; zaxira nusxadan tiklash sinab ko'riladi.

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
| 3 | Xaridor kelmadi | 1,5 kun | Taymerlar, `no_show`/`returned`, strike, haqni hold'dan yechish |
| 4 | Taksichi nazorati | 1,5 kun | ETA taymeri, avto-qayta berish, jonli joylashuv, navigator |
| 5 | Click / Payme + rastalar hisobi | 3 kun | Hold +5%, capture, webhook'lar, fiskal chek, `store_payouts` |
| 6 | Tahlil + alertlar + zaxira | 1,5 kun | SQL agregatsiyalar, kunlik hisobot, `pg_dump` → R2 |
| 7 | Yuklama + band rejim (+ kerak bo'lsa VPS/Redis) | 1–2 kun | Locust; zarur bo'lsa Caddy, Redis Pub/Sub |
| — | **Pilot** | 2 hafta | Ko'rsatkichlar |
| 8 | Takrorlash | 0,5 kun | reorder-preview |
| 9 | Reyting | 1,5 kun | `staff_stats`, Bayes, buyurtmani ko'rish navbati |
| 10 | Mustahkamlash | 1,5 kun | Staging, monitoring, xavfsizlik |

Pilotgacha jami: **~12 ish kuni** (+ Click/Payme shartnomasini kutish; u bo'lmasa pilot «O'zim olaman» bilan boshlanadi).
