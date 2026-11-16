// Platform rules. Keep TERMS_VERSION in step with backend/app/services/terms.py: a new version asks everybody again.
export const TERMS_VERSION = '2026-11-16';

export const WARNING = {
  uz: {
    title: '⚠️ DIQQAT!',
    intro: "Ushbu Bozorbot platformasi bozorda faoliyat ko'rsatayotgan sotuvchi va xaridorlarga oldi-sotdi jarayonini yengillashtirish va qulaylik yaratish maqsadida yaratilgan.",
    points: [
      "Bot faqat sotuvchi, xaridor, aravakash va taksi/kuryerni bir-biri bilan bog'laydi.",
      "To'lov usulini (naqd, karta yoki nasiya) sotuvchi va xaridor o'zaro kelishib, o'zlari tanlaydi. Bot hisob-kitobga aralashmaydi.",
      "Mahsulot sifati, to'lov va ko'rsatilgan xizmatlar uchun javobgarlikni foydalanuvchilar O'zbekiston Respublikasi qonunchiligiga muvofiq o'z zimmasiga oladi.",
    ],
    agree: '✅ Roziman',
    read: "📄 To'liq qoidalarni o'qish",
    note: "«Roziman» tugmasini bosib, siz foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz.",
  },
  ru: {
    title: '⚠️ ВНИМАНИЕ!',
    intro: 'Платформа Bozorbot создана, чтобы облегчить и сделать удобной куплю-продажу для продавцов и покупателей базара.',
    points: [
      'Бот только связывает продавца, покупателя, аравачи и таксиста/курьера.',
      'Способ оплаты (наличные, карта или в долг/насия) продавец и покупатель выбирают сами, по договорённости. Бот в расчёты не вмешивается.',
      'За качество товара, оплату и оказанные услуги пользователи отвечают сами, в соответствии с законодательством Республики Узбекистан.',
    ],
    agree: '✅ Согласен',
    read: '📄 Читать полные правила',
    note: 'Нажимая «Согласен», вы принимаете условия использования и политику конфиденциальности.',
  },
  en: {
    title: '⚠️ NOTICE!',
    intro: 'The Bozorbot platform was made to make buying and selling at the bazaar easier for sellers and customers.',
    points: [
      'The bot only connects the seller, the customer, the porter (aravachi) and the taxi/courier.',
      'The seller and the customer choose how to pay (cash, card or credit/nasiya) between themselves. The bot takes no part in payments.',
      'Users themselves are responsible for the quality of goods, payments and their services, under the laws of the Republic of Uzbekistan.',
    ],
    agree: '✅ I agree',
    read: '📄 Read the full rules',
    note: 'By tapping «I agree» you accept the terms of use and the privacy policy.',
  },
};

// Full text: [heading, [paragraphs]]
export const TERMS = {
  uz: {
    title: 'Foydalanish shartlari va maxfiylik siyosati',
    updated: 'Kuchga kirgan sana: 2026-yil 16-noyabr',
    sections: [
      ['1. Platforma nima', [
        "Bozorbot (@yunusobod_dehqon_bozori_bot va bozorbot.uz) — Yunusobod dehqon bozoridagi sotuvchi, xaridor, aravakash va taksi/kuryerlarni bir-biri bilan bog'laydigan elektron vositachi maydoncha.",
        "Bot sotuvchi ham, xaridor ham, tashuvchi ham emas va oldi-sotdi bitimining tomoni hisoblanmaydi. Bitim sotuvchi va xaridor o'rtasida tuziladi.",
      ]],
      ['2. To\'lov va hisob-kitob', [
        "To'lov usulini (naqd pul, kartaga o'tkazma, nasiya yoki boshqa usul) sotuvchi va xaridor o'zaro kelishib, o'zlari tanlaydi.",
        "Bot pul qabul qilmaydi, saqlamaydi, o'tkazmaydi va to'lovni kafolatlamaydi. Botda ko'rsatilgan summa ma'lumot uchun.",
        "Aravakash va taksi/kuryer xizmati haqi xaridor va xizmat ko'rsatuvchi o'rtasida hal qilinadi.",
      ]],
      ['3. Mahsulot sifati', [
        "Mahsulotning sifati, yangiligi, vazni, narxi, tavsifi va rasmlarining to'g'riligi uchun sotuvchi javob beradi.",
        "Sotuvchi faqat qonuniy, sifatli va xavfsiz mahsulot sotish majburiyatini oladi.",
      ]],
      ['4. Xizmatlar', [
        "Aravakash mahsulotni yig'ish va topshirish, taksi/kuryer esa yetkazib berish uchun o'zi javob beradi.",
        "Bot buyurtma bosqichlarini (kim oldi, qachon topshirdi, qachon yetkazdi) qayd etadi. Bu ma'lumot tomonlarga kelishmovchilikni hal qilishda yordam berishi mumkin.",
      ]],
      ['5. Kelishmovchiliklar', [
        "Sotuvchi, xaridor, aravakash va taksi/kuryer o'rtasidagi har qanday kelishmovchilik ular o'rtasida o'zaro muzokara yo'li bilan, kelishilmasa — O'zbekiston Respublikasi qonunchiligiga muvofiq hal qilinadi.",
        "Bot ma'muriyati kelishmovchilikning tomoni emas va u bo'yicha javobgar emas.",
      ]],
      ['6. Foydalanuvchining majburiyatlari', [
        "To'g'ri ism va telefon raqamini ko'rsatish; soxta buyurtma bermaslik; boshqalarni aldamaslik va haqoratlamaslik.",
        "Qoidalarni buzgan foydalanuvchini bozor ma'muriyati (bozorkom) ogohlantirishi, cheklashi yoki bloklashi mumkin.",
      ]],
      ['7. Javobgarlikning cheklanishi', [
        "Bot «boricha» taqdim etiladi. Ma'muriyat botning uzluksiz va xatosiz ishlashiga harakat qiladi, lekin texnik uzilishlar, internet yoki Telegram ishlamay qolishi uchun javob bermaydi.",
        "Ma'muriyat foydalanuvchilar o'rtasidagi bitimlar, to'lovlar, mahsulot va xizmatlar sifati natijasida yuzaga kelgan zarar uchun javobgar emas.",
      ]],
      ['8. Shaxsiy ma\'lumotlar (maxfiylik siyosati)', [
        "Biz quyidagilarni saqlaymiz: Telegram ID, ism, telefon raqami, til, yetkazib berish manzili va joylashuvi, buyurtmalar tarixi; ishchilar uchun — rol va mashina; yetkazish vaqtida — taksining joylashuvi; sotuvchilar yuklagan rasm va videolar.",
        "Nima uchun: buyurtmani bajarish, tomonlarni bog'lash, firibgarlikka qarshi kurash va bozor ma'muriyati nazorati uchun.",
        "Kim ko'radi: buyurtmadagi sotuvchi, aravakash va taksi/kuryer faqat buyurtmani bajarish uchun kerakli ma'lumotni (ism, telefon, manzil) ko'radi; bozor ma'muriyati — hammasini.",
        "Biz ma'lumotlarni sotmaymiz va reklama uchun uchinchi shaxslarga bermaymiz. Qonunda nazarda tutilgan hollar bundan mustasno.",
        "Ma'lumotlarni o'zgartirish uchun /profile buyrug'idan foydalaning. O'chirishni so'rash uchun bozor ma'muriyatiga murojaat qiling.",
        "Ma'lumotlar O'zbekiston Respublikasining «Shaxsga doir ma'lumotlar to'g'risida»gi Qonuniga muvofiq ishlanadi.",
      ]],
      ['9. Qoidalarning o\'zgarishi', [
        "Ma'muriyat qoidalarni o'zgartirishi mumkin. Yangi tahrir botda e'lon qilinadi va undan keyin foydalanish uchun qayta rozilik so'raladi.",
      ]],
      ['10. Aloqa', [
        "Savol va shikoyatlar: bozor ma'muriyati (bozorkom) yoki @yunusobod_dehqon_bozori_bot orqali.",
      ]],
    ],
  },
  ru: {
    title: 'Условия использования и политика конфиденциальности',
    updated: 'Действуют с 16 ноября 2026 года',
    sections: [
      ['1. Что такое платформа', [
        'Bozorbot (@yunusobod_dehqon_bozori_bot и bozorbot.uz) — электронная площадка-посредник, которая связывает продавцов, покупателей, аравачи и таксистов/курьеров Юнусабадского дехканского базара.',
        'Бот не является продавцом, покупателем или перевозчиком и не является стороной сделки купли-продажи. Сделка заключается между продавцом и покупателем.',
      ]],
      ['2. Оплата и расчёты', [
        'Способ оплаты (наличные, перевод на карту, в долг/насия или другой) продавец и покупатель выбирают сами, по договорённости.',
        'Бот не принимает, не хранит, не переводит деньги и не гарантирует оплату. Суммы в боте указаны для информации.',
        'Оплата услуг аравачи и таксиста/курьера решается между покупателем и исполнителем.',
      ]],
      ['3. Качество товара', [
        'За качество, свежесть, вес, цену, описание и фотографии товара отвечает продавец.',
        'Продавец обязуется продавать только законные, качественные и безопасные товары.',
      ]],
      ['4. Услуги', [
        'Аравачи отвечает за сбор и передачу товара, таксист/курьер — за доставку.',
        'Бот записывает этапы заказа (кто взял, когда передал, когда доставил). Эти данные могут помочь сторонам разобраться в споре.',
      ]],
      ['5. Споры', [
        'Любые споры между продавцом, покупателем, аравачи и таксистом/курьером решаются ими самими путём переговоров, а если договориться не удалось — в соответствии с законодательством Республики Узбекистан.',
        'Администрация бота не является стороной спора и не несёт по нему ответственности.',
      ]],
      ['6. Обязанности пользователя', [
        'Указывать настоящее имя и номер телефона; не делать ложных заказов; не обманывать и не оскорблять других.',
        'Администрация базара (бозорком) может предупредить, ограничить или заблокировать нарушителя.',
      ]],
      ['7. Ограничение ответственности', [
        'Бот предоставляется «как есть». Администрация старается, чтобы бот работал без перебоев и ошибок, но не отвечает за технические сбои, отключение интернета или Telegram.',
        'Администрация не несёт ответственности за ущерб, возникший из сделок, расчётов, качества товаров и услуг между пользователями.',
      ]],
      ['8. Персональные данные (политика конфиденциальности)', [
        'Мы храним: Telegram ID, имя, номер телефона, язык, адрес и место доставки, историю заказов; для работников — роль и машину; во время доставки — местоположение такси; фото и видео, загруженные продавцами.',
        'Зачем: чтобы выполнять заказы, связывать стороны, бороться с мошенничеством и для контроля администрацией базара.',
        'Кто видит: продавец, аравачи и таксист/курьер заказа видят только то, что нужно для выполнения заказа (имя, телефон, адрес); администрация базара — всё.',
        'Мы не продаём данные и не передаём их третьим лицам для рекламы, кроме случаев, предусмотренных законом.',
        'Изменить данные можно командой /profile. Чтобы попросить удалить данные, обратитесь в администрацию базара.',
        'Данные обрабатываются в соответствии с Законом Республики Узбекистан «О персональных данных».',
      ]],
      ['9. Изменение правил', [
        'Администрация может изменять правила. Новая редакция объявляется в боте, и для дальнейшего использования снова запрашивается согласие.',
      ]],
      ['10. Контакты', [
        'Вопросы и жалобы: администрация базара (бозорком) или @yunusobod_dehqon_bozori_bot.',
      ]],
    ],
  },
  en: {
    title: 'Terms of use and privacy policy',
    updated: 'In force from 16 November 2026',
    sections: [
      ['1. What the platform is', [
        'Bozorbot (@yunusobod_dehqon_bozori_bot and bozorbot.uz) is an online intermediary that connects sellers, customers, porters (aravachi) and taxi drivers/couriers of the Yunusobod farmers\' bazaar.',
        'The bot is not a seller, buyer or carrier and is not a party to any sale. A sale is made between the seller and the customer.',
      ]],
      ['2. Payment', [
        'The seller and the customer choose how to pay (cash, card transfer, credit/nasiya or another way) between themselves.',
        'The bot does not take, hold or transfer money and does not guarantee payment. Amounts shown in the bot are for information.',
        'Payment for the porter and the taxi/courier is settled between the customer and that person.',
      ]],
      ['3. Quality of goods', [
        'The seller is responsible for the quality, freshness, weight, price, description and photos of the goods.',
        'The seller undertakes to sell only legal, good-quality and safe goods.',
      ]],
      ['4. Services', [
        'The porter is responsible for collecting and handing over the goods, the taxi/courier for delivery.',
        'The bot records the steps of an order (who took it, when it was handed over, when delivered). This may help the parties settle a dispute.',
      ]],
      ['5. Disputes', [
        'Any dispute between the seller, customer, porter and taxi/courier is settled by them through negotiation, or otherwise under the laws of the Republic of Uzbekistan.',
        'The bot\'s administration is not a party to the dispute and is not liable for it.',
      ]],
      ['6. User obligations', [
        'Give your real name and phone number; do not place fake orders; do not deceive or insult others.',
        'The bazaar administration (bozorkom) may warn, restrict or block a user who breaks the rules.',
      ]],
      ['7. Limitation of liability', [
        'The bot is provided «as is». The administration tries to keep it running without interruptions or errors but is not liable for technical failures or outages of the internet or Telegram.',
        'The administration is not liable for losses arising from sales, payments, or the quality of goods and services between users.',
      ]],
      ['8. Personal data (privacy policy)', [
        'We keep: Telegram ID, name, phone number, language, delivery address and location, order history; for workers, their role and car; during delivery, the taxi\'s location; photos and videos uploaded by sellers.',
        'Why: to fulfil orders, connect the parties, prevent fraud, and for oversight by the bazaar administration.',
        'Who sees it: the seller, porter and taxi/courier of an order see only what is needed to fulfil it (name, phone, address); the bazaar administration sees everything.',
        'We do not sell data or pass it to third parties for advertising, except where the law requires.',
        'Change your data with /profile. To ask for deletion, contact the bazaar administration.',
        'Data is processed under the Law of the Republic of Uzbekistan «On Personal Data».',
      ]],
      ['9. Changes', [
        'The administration may change these rules. A new version is announced in the bot and your consent is asked again.',
      ]],
      ['10. Contact', [
        'Questions and complaints: the bazaar administration (bozorkom) or @yunusobod_dehqon_bozori_bot.',
      ]],
    ],
  },
};
