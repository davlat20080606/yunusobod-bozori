from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schemas import CategoryModel, StoreModel, ProductModel
from app.database import Base, engine, async_session_factory

CATEGORIES = [
    {
        "slug": "combos",
        "name_uz": "👑 Katta Oila & Osh To'plamlari",
        "name_ru": "👑 Семейные Наборы & Плов-Сеты",
        "name_en": "👑 Mega Family & Plov Boxes",
        "icon": "👑",
        "stall_area": "VIP Saralangan To'plamlar"
    },
    {
        "slug": "vegetables",
        "name_uz": "Sabzavotlar & Ko'katlar",
        "name_ru": "Овощи и зелень",
        "name_en": "Vegetables & Greens",
        "icon": "🍅",
        "stall_area": "Rasta 1-3 (Sabzavot qatori)"
    },
    {
        "slug": "fruits",
        "name_uz": "Meva & Poliz ekinlari",
        "name_ru": "Фрукты и бахчевые",
        "name_en": "Fruits & Melons",
        "icon": "🍇",
        "stall_area": "Rasta 4-6 (Meva qatori)"
    },
    {
        "slug": "meat",
        "name_uz": "Go'sht, Parranda & Qazi",
        "name_ru": "Мясо, птица и казы",
        "name_en": "Fresh Meat & Delicacies",
        "icon": "🥩",
        "stall_area": "Rasta 12-15 (Go'sht paviloni)"
    },
    {
        "slug": "bakery",
        "name_uz": "Tandir non & Somsa",
        "name_ru": "Тандыр лепешки и самса",
        "name_en": "Tandoor Bread & Somsa",
        "icon": "🥖",
        "stall_area": "Rasta 7 (Non rastasi)"
    },
    {
        "slug": "dry_fruits",
        "name_uz": "Quruq mevalar & Yong'oq",
        "name_ru": "Сухофрукты и орехи",
        "name_en": "Dried Fruits & Nuts",
        "icon": "🥜",
        "stall_area": "Rasta 8-9 (Sharq shirinliklari)"
    },
    {
        "slug": "dairy",
        "name_uz": "Sut, Qatiq & Qaymoq",
        "name_ru": "Молочная продукция",
        "name_en": "Dairy & Cheeses",
        "icon": "🧀",
        "stall_area": "Rasta 10 (Sut rastasi)"
    }
]

STORES = [
    {
        "slug": "dilshod-ota-sabzavot",
        "name_uz": "Dilshod Ota — Yangi Sabzavotlar",
        "name_ru": "Дильшод Ота — Свежие овощи",
        "name_en": "Dilshod Ota — Fresh Vegetables",
        "stall_number": "Rasta 1, Joy №4",
        "owner_name": "Dilshod Karimov",
        "owner_phone": "+998 90 111-22-33",
        "seller_pin": "1111",
        "category_slug": "vegetables",
        "avatar_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Parkent va Qibraydan har tong keltiriladigan saralangan pomidor, bodring va ko'katlar.",
        "description_ru": "Отборные фермерские помидоры, хрустящие огурцы и свежая зелень каждое утро прямо с грядки.",
        "description_en": "Freshly picked farm tomatoes, crispy cucumbers and aromatic herbs every morning.",
        "rating": 4.95,
        "total_orders": 240
    },
    {
        "slug": "karen-aka-gosht",
        "name_uz": "Karen Aka — Saralangan Go'sht & Go'sht Mahsulotlari",
        "name_ru": "Карен Ака — Мясные изделия и свежее мясо",
        "name_en": "Karen — Prime Meat & Delicacies",
        "stall_number": "Rasta 14, Joy №2",
        "owner_name": "Karen",
        "owner_phone": "+998 93 222-33-44",
        "seller_pin": "2222",
        "category_slug": "meat",
        "avatar_url": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Saralangan yosh buzoq, qo'y go'shti, uy qazisi, dudlangan go'sht va shashlikbop marinadlar.",
        "description_ru": "Свежая молодая баранина, телятина, домашнее казы, копчености и маринованное мясо для шашлыка.",
        "description_en": "Fresh grass-fed lamb, prime beef cuts, homemade horsemeat qazi and marinated BBQ meats.",
        "rating": 4.99,
        "total_orders": 420
    },
    {
        "slug": "zuhra-opa-tandir",
        "name_uz": "Zuhra Opa — Samarqand Non & Somsa",
        "name_ru": "Зухра Опа — Самаркандские лепешки и сомса",
        "name_en": "Zuhra Opa — Samarkand Bread & Somsa",
        "stall_number": "Rasta 7, Joy №1",
        "owner_name": "Zuhra Yusupova",
        "owner_phone": "+998 97 333-44-55",
        "seller_pin": "3333",
        "category_slug": "bakery",
        "avatar_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Tandirdan uzilgan issiq Samarqand patiri, obi non va go'shtli tandir somsasi.",
        "description_ru": "Горячие патиры прямо из тандыра, хрустящий оби-нон и сочная тандырная сомса с мясом.",
        "description_en": "Piping hot Samarkand patir bread, crusty obi non, and savory tandoor meat pastries.",
        "rating": 4.92,
        "total_orders": 512
    },
    {
        "slug": "akmal-quruq-meva",
        "name_uz": "Akmal — Saralangan Quruq Mevalar",
        "name_ru": "Акмал — Отборные сухофрукты и орехи",
        "name_en": "Akmal — Premium Dried Fruits & Nuts",
        "stall_number": "Rasta 9, Joy №5",
        "owner_name": "Akmal Saidov",
        "owner_phone": "+998 94 444-55-66",
        "seller_pin": "4444",
        "category_slug": "dry_fruits",
        "avatar_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Samarqand soyaki mayizi, tog' yong'og'i, pista va shakarli o'rik qoqisi.",
        "description_ru": "Элитный изюм сояки, горный грецкий орех, сладкая курага и жареный миндаль.",
        "description_en": "Finest shade-dried raisins, mountain walnuts, golden apricots, and pistachios.",
        "rating": 4.89,
        "total_orders": 180
    },
    {
        "slug": "botir-aka-mevalar",
        "name_uz": "Botir Aka — Farg'ona Mevalari & Poliz",
        "name_ru": "Ботир Ака — Ферганские фрукты и бахча",
        "name_en": "Botir Aka — Fergana Fruits & Melons",
        "stall_number": "Rasta 5, Joy №8",
        "owner_name": "Botir Rahimov",
        "owner_phone": "+998 99 555-66-77",
        "seller_pin": "5555",
        "category_slug": "fruits",
        "avatar_url": "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Asaldek shirin Mirzacho'l qovuni, Farg'ona shaftolisi, Samarqand anori va uzumlari.",
        "description_ru": "Сладкие как мед мирзачульские дыни, сочные ферганские персики и спелый гранат.",
        "description_en": "Honey-sweet Mirzachul melons, juicy Fergana peaches, and ruby Samarkand pomegranates.",
        "rating": 4.96,
        "total_orders": 310
    },
    {
        "slug": "nodira-opa-sut",
        "name_uz": "Nodira Opa — Tabiiy Sut & Qaymoq",
        "name_ru": "Нодира Опа — Домашняя молочка и каймак",
        "name_en": "Nodira Opa — Organic Dairy & Cream",
        "stall_number": "Rasta 10, Joy №3",
        "owner_name": "Nodira Karimova",
        "owner_phone": "+998 91 666-77-88",
        "seller_pin": "6666",
        "category_slug": "dairy",
        "avatar_url": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=300&auto=format&fit=crop&q=80",
        "banner_url": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&auto=format&fit=crop&q=80",
        "description_uz": "Yog'li tog' qaymog'i, quyuq suzma, nordon qatiq va qo'y suti brinzasi.",
        "description_ru": "Густой горный каймак, настоящая свежая сузьма, деревенский катык и домашняя брынза.",
        "description_en": "Rich mountain clotted cream, authentic suzma strained yogurt, and fresh sheep feta cheese.",
        "rating": 4.94,
        "total_orders": 165
    }
]

PRODUCTS = [
    # Special Category: Mega Combos & Family Sets (High Ticket $40-$60 profit per order)
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "combos",
        "name_uz": "Oila Uchun Haftalik Katta To'plam (Go'sht, Qazi, Sabzavot & Non)",
        "name_ru": "Большой Семейный Набор на неделю (Мясо 5 кг, Казы, Овощи и Патиры)",
        "name_en": "Mega Family Weekly Meat & Produce Box",
        "description_uz": "3 kg Saralangan mol lahm + 2 kg Qo'y qovurg'a + 1 Uy qazisi + 5 kg Sabzi, Piyoz, Kartoshka + 4 Samarqand patiri. Butun oila uchun 1 haftalik tayyor to'plam!",
        "description_ru": "3 кг мякоти телятины + 2 кг сочной баранины + 1 домашний казы + 5 кг отборных овощей + 4 самаркандских патира. Полный недельный запас для всей семьи!",
        "description_en": "3kg prime beef + 2kg lamb + 1 homemade qazi + 5kg fresh vegetables + 4 Samarkand flatbreads.",
        "price": 680000.0,
        "old_price": 740000.0,
        "unit": "to'plam (сет)",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-meat-skewers-sizzling-over-a-grill-42996-large.mp4",
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 25.0
    },
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "combos",
        "name_uz": "Haqiqiy Choyxona Oshi Seti (10-15 kishilik Maxsus To'plam)",
        "name_ru": "Набор для Настоящего Чайханского Плова (на 10-15 человек)",
        "name_en": "Authentic Choyxona Plov Master Set (10-15 servings)",
        "description_uz": "2 kg Saralangan qo'zi go'shti + 1 Uy qazisi + 2 kg Lazer guruch + 2.5 kg Sariq/qizil sabzi + Ziravorlar, no'xat, mayiz, sarimsoq + 4 Issiq patir.",
        "description_ru": "2 кг отборной баранины + 1 казы + 2 кг риса Лазер + 2.5 кг моркови + горная зира, нухат, изюм, чеснок + 4 патира. Всё для королевского плова!",
        "description_en": "Complete premium ingredients for traditional 15-person plov feast.",
        "price": 450000.0,
        "old_price": 495000.0,
        "unit": "to'plam (сет)",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-meat-skewers-sizzling-over-a-grill-42996-large.mp4",
        "is_featured": True,
        "badge": "tea_house",
        "stock_quantity": 30.0
    },
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "combos",
        "name_uz": "Dam Olish & Shashlikbop Go'shtlar To'plami (4 kg Go'sht + Sabzavotlar)",
        "name_ru": "Набор для Дачи и Шашлыка (4 кг маринованного мяса + Овощи)",
        "name_en": "Weekend BBQ & Shashlik Feast Combo",
        "description_uz": "2 kg Qiyma kabob go'shti + 2 kg Qovurg'a qo'y go'shti (marinadlangan) + 2 kg Yusupov pomidori va rayhon + 4 Tandir noni.",
        "description_ru": "2 кг нежного маринованного мяса для шашлыка + 2 кг бараньих ребрышек + 2 кг юсуповских помидоров с райхоном + 4 лепешки.",
        "description_en": "Ready-to-grill marinated meat skewers cut, fresh tomatoes and hot bread.",
        "price": 520000.0,
        "old_price": 570000.0,
        "unit": "to'plam (сет)",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-meat-skewers-sizzling-over-a-grill-42996-large.mp4",
        "is_featured": True,
        "badge": "top_rated",
        "stock_quantity": 20.0
    },
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "combos",
        "name_uz": "Shohona Palov & Qazi VIP To'plami (5-7 kishilik)",
        "name_ru": "Шахский Плов & Казы VIP Сет (на 5-7 человек)",
        "name_en": "Royal Plov & Qazi VIP Set",
        "description_uz": "1.5 kg Saralangan qo'zi go'shti + 1 Butun uy qazisi + 1.5 kg Devzira guruch + Saralangan sariq sabzi, no'xat va tog' zirasi + 2 Tandir patir.",
        "description_ru": "1.5 кг отборной молодой баранины + 1 цельный домашний казы + 1.5 кг риса Девзира + отборная морковь, нухат и горная зира + 2 патира.",
        "description_en": "1.5kg prime lamb + 1 whole homemade qazi + 1.5kg Devzira rice + carrots, spices + 2 tandoor breads.",
        "price": 360000.0,
        "old_price": 410000.0,
        "unit": "to'plam (сет)",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 20.0
    },
    {
        "store_slug": "dilshod-ota-sabzavot",
        "category_slug": "combos",
        "name_uz": "Vitaminga Boy Bozor Savati (10 kg Meva & Sabzavotlar)",
        "name_ru": "Семейная Витаминная Корзина с Базара (10 кг Фрукты и Овощи)",
        "name_en": "Fresh Farm Vitamin Basket (10kg Assorted Produce)",
        "description_uz": "2 kg Yusupov pomidori + 2 kg Bodring + 2 kg Qora uzum + 2 kg Shaftoli + 2 bog'lam yangi rayhon va ko'katlar. 100% yangi uzilgan!",
        "description_ru": "2 кг юсуповских помидоров + 2 кг огурцов + 2 кг черного винограда + 2 кг персиков + свежая зелень и райхон. 100% свежесть!",
        "description_en": "2kg heirloom tomatoes + 2kg cucumbers + 2kg black grapes + 2kg sweet peaches + fresh mountain herbs.",
        "price": 240000.0,
        "old_price": 280000.0,
        "unit": "to'plam (сет)",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": True,
        "badge": "organic",
        "stock_quantity": 25.0
    },

    # Store: Dilshod Ota (Vegetables)
    {
        "store_slug": "dilshod-ota-sabzavot",
        "category_slug": "vegetables",
        "name_uz": "Yusupov Pomidori (Qizil & Shirin)",
        "name_ru": "Помидоры Юсуповские (Сахарные)",
        "name_en": "Yusupov Sweet Tomatoes",
        "description_uz": "Yupqa po'stli, go'shtdor va nihoyatda shirin xushbo'y pomidor.",
        "description_ru": "Настоящие юсуповские помидоры с тонкой кожицей, мясистые и ароматные.",
        "description_en": "Iconic thin-skinned, meaty, naturally sweet Uzbek heirloom tomatoes.",
        "price": 22000.0,
        "old_price": 25000.0,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-slicing-a-ripe-red-tomato-41712-large.mp4",
        "is_featured": True,
        "badge": "top_seller",
        "stock_quantity": 80.0
    },
    {
        "store_slug": "dilshod-ota-sabzavot",
        "category_slug": "vegetables",
        "name_uz": "Bodring 'Orzu' (Qarsildoq)",
        "name_ru": "Огурцы 'Орзу' (Хрустящие)",
        "name_en": "Crisp 'Orzu' Cucumbers",
        "description_uz": "Kichik, qarsildoq va xushbo'y yangi uzilgan bodringlar.",
        "description_ru": "Свежие, сочные и хрустящие огурчики прямо из теплицы.",
        "description_en": "Crisp, fragrant baby cucumbers freshly harvested.",
        "price": 14000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-chopping-vegetables-for-a-salad-41706-large.mp4",
        "is_featured": True,
        "badge": "fresh",
        "stock_quantity": 60.0
    },
    {
        "store_slug": "dilshod-ota-sabzavot",
        "category_slug": "vegetables",
        "name_uz": "Rayhon & Yashil Ko'katlar To'plami",
        "name_ru": "Свежий набор зелени и райхон (Базилик)",
        "name_en": "Fresh Herbs & Purple Basil Bundle",
        "description_uz": "Binafsharang rayhon, xushbo'y kashnich, ukrop va ko'k piyoz bog'lami.",
        "description_ru": "Ароматный фиолетовый райхон, кинза, укроп и свежий зеленый лук.",
        "description_en": "Fragrant purple basil, cilantro, dill, and scallions bundle.",
        "price": 4000.0,
        "old_price": None,
        "unit": "bog'lam",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-hands-washing-fresh-green-spinach-leaves-41702-large.mp4",
        "is_featured": False,
        "badge": "fresh",
        "stock_quantity": 100.0
    },
    {
        "store_slug": "dilshod-ota-sabzavot",
        "category_slug": "vegetables",
        "name_uz": "Qizil & Sariq Sabzi (Oshbop)",
        "name_ru": "Морковь красная и желтая для плова",
        "name_en": "Red & Yellow Carrots (For Plov)",
        "description_uz": "Haqiqiy Toshkent va Farg'ona oshi uchun shirin qizil va sariq sabzi.",
        "description_ru": "Сладкая сочная морковь специального сорта для идеального плова.",
        "description_en": "Special sweet red and yellow carrots selected for authentic Uzbek plov.",
        "price": 6000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-close-up-of-sliced-carrots-falling-on-a-wooden-board-41716-large.mp4",
        "is_featured": False,
        "badge": "organic",
        "stock_quantity": 150.0
    },

    # Store: Karen Aka (Meat & Meat Products)
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "meat",
        "name_uz": "Yosh Qo'y Go'shti (Qo'birlar & Son)",
        "name_ru": "Молодая баранина (Корейка и задняя часть)",
        "name_en": "Tender Young Lamb Cuts",
        "description_uz": "Yumshoq, yog'siz va xushxo'r yosh qo'zichoq go'shti.",
        "description_ru": "Парное, нежное мясо молодого барашка. Идеально для шашлыка, шурпы и запекания.",
        "description_en": "Fresh, tender grass-fed young lamb cuts perfect for kabobs and soups.",
        "price": 105000.0,
        "old_price": 115000.0,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-meat-skewers-sizzling-over-a-grill-42996-large.mp4",
        "is_featured": True,
        "badge": "top_rated",
        "stock_quantity": 40.0
    },
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "meat",
        "name_uz": "Mol Go'shti Lahm (Buzoq)",
        "name_ru": "Говядина бескостная мякоть (Телятина)",
        "name_en": "Boneless Beef / Veal Fillet",
        "description_uz": "Saralangan toza buzoq go'shti lahm, qovurma va pishiriqlar uchun.",
        "description_ru": "Отборное чистое филе свежей телятины без костей и пленок.",
        "description_en": "Prime boneless veal meat, trimmed and tender.",
        "price": 95000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-raw-meat-steak-being-seasoned-42994-large.mp4",
        "is_featured": True,
        "badge": "fresh",
        "stock_quantity": 50.0
    },
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "meat",
        "name_uz": "Qo'lda Tayyorlangan Qazi (Ot go'shti)",
        "name_ru": "Казы домашнее премиум (Конская колбаса)",
        "name_en": "Homemade Premium Horsemeat Qazi",
        "description_uz": "Ziravorlar bilan qadimiy usulda tayyorlangan lazzatli uy qazisi.",
        "description_ru": "Традиционное сочное казы с добавлением горной зиры и черного перца.",
        "description_en": "Traditional cured horse-meat delicacy seasoned with mountain cumin and pepper.",
        "price": 120000.0,
        "old_price": 135000.0,
        "unit": "dona",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-chef-slicing-cooked-meat-on-a-cutting-board-42998-large.mp4",
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 25.0
    },

    # Store: Zuhra Opa (Bakery)
    {
        "store_slug": "zuhra-opa-tandir",
        "category_slug": "bakery",
        "name_uz": "Samarqand Sariyog'li Patir Non",
        "name_ru": "Самаркандский сливочный патир",
        "name_en": "Samarkand Butter Patir Bread",
        "description_uz": "Tandirdan chiqqan, sedana va sariyog' bilan bezatilgan shohona patir.",
        "description_ru": "Пышная, хрустящая лепешка с добавлением натурального сливочного масла и седаны.",
        "description_en": "Crisp and golden tandoor flatbread layered with pure butter and nigella seeds.",
        "price": 12000.0,
        "old_price": None,
        "unit": "dona",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-freshly-baked-bread-steaming-in-a-bakery-43004-large.mp4",
        "is_featured": True,
        "badge": "fresh_hot",
        "stock_quantity": 80.0
    },
    {
        "store_slug": "zuhra-opa-tandir",
        "category_slug": "bakery",
        "name_uz": "Go'shtli Tandir Somsa (Varaqi)",
        "name_ru": "Самса с мясом из тандыра (Слоеная)",
        "name_en": "Tandoor Flaky Meat Somsa",
        "description_uz": "Tandirda pishirilgan mayin go'shtli, qat-qat xamirli sersuv somsa.",
        "description_ru": "Сочная тандырная самса с рубленым мясом и ароматным лучком.",
        "description_en": "Flaky tandoor baked pastry packed with tender spiced minced meat and onions.",
        "price": 10000.0,
        "old_price": None,
        "unit": "dona",
        "min_weight": 1.0,
        "step_weight": 1.0,
           "image_url": "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-knife-cutting-open-a-juicy-sweet-melon-41724-large.mp4",
        "is_featured": True,
        "badge": "sweet",
        "stock_quantity": 30.0
    },
    {
        "store_slug": "botir-aka-mevalar",
        "category_slug": "fruits",
        "name_uz": "Farg'ona Anjir Shaftolisi",
        "name_ru": "Инжирные персики из Ферганы",
        "name_en": "Fergana Donut / Flat Peaches",
        "description_uz": "Shirador, suvi tomib turgan asal anjir shaftoli.",
        "description_ru": "Нежнейшие плоские инжирные персики, тающие во рту.",
        "description_en": "Deliciously sweet flat donut peaches bursting with fresh juice.",
        "price": 28000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-biting-into-a-fresh-juicy-peach-41720-large.mp4",
        "is_featured": True,
        "badge": "fresh",
        "stock_quantity": 45.0
    },
    {
        "store_slug": "botir-aka-mevalar",
        "category_slug": "fruits",
        "name_uz": "Samarqand Qora Qora Katta Uzumi",
        "name_ru": "Самаркандский крупный черный виноград",
        "name_en": "Samarkand Giant Black Grapes",
        "description_uz": "Shirin va shifobaxsh yirik qora uzum shingillari.",
        "description_ru": "Сладкий крупный виноград с бархатистым вкусом.",
        "description_en": "Sweet and crisp large black table grapes from Samarkand vineyards.",
        "price": 25000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-close-up-of-washing-black-grapes-under-water-41722-large.mp4",
        "is_featured": False,
        "badge": "fresh",
        "stock_quantity": 50.0
    },
    {
        "store_slug": "botir-aka-mevalar",
        "category_slug": "fruits",
        "name_uz": "Quva Qizil Shirin Anori",
        "name_ru": "Сладкий гранат из Кувы (Рубиновый)",
        "name_en": "Quva Sweet Red Pomegranate",
        "description_uz": "Yirik, qip-qizil donali shirador Quva anori.",
        "description_ru": "Сочный рубиновый гранат с насыщенным сладким вкусом.",
        "description_en": "Juicy ruby red pomegranate bursting with sweet nectar.",
        "price": 32000.0,
        "old_price": 38000.0,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1541344999736-83eca872f240?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-cutting-open-a-ripe-red-pomegranate-41728-large.mp4",
        "is_featured": True,
        "badge": "fresh",
        "stock_quantity": 40.0
    },
    {
        "store_slug": "botir-aka-mevalar",
        "category_slug": "fruits",
        "name_uz": "Namangan Qizil 'Besh Yulduz' Olmasi",
        "name_ru": "Яблоки 'Пять звезд' (Хрустящие)",
        "name_en": "Crisp Mountain Red Apples",
        "description_uz": "Qarsildoq, shirin va xushbo'y tog' olmasi.",
        "description_ru": "Сладкие ароматные хрустящие яблоки из горных садов.",
        "description_en": "Sweet and crisp mountain red apples full of natural aroma.",
        "price": 18000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": False,
        "badge": "organic",
        "stock_quantity": 60.0
    },

    # Store: Zuxra Opa (Bakery Extra)
    {
        "store_slug": "zuxra-opa-non",
        "category_slug": "bakery",
        "name_uz": "Jizzali Qatlama Non",
        "name_ru": "Слоеный патыр с шкварками (Джиззали)",
        "name_en": "Layered Crispy Flatbread with Cracklings",
        "description_uz": "Tandirdan uzilgan qat-qat yog'li va xushta'm non.",
        "description_ru": "Слоеный горячий патыр с хрустящей корочкой и ароматной начинкой.",
        "description_en": "Traditional crispy layered tandoor bread with rich savory flavor.",
        "price": 15000.0,
        "old_price": None,
        "unit": "dona",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": False,
        "badge": "fresh_hot",
        "stock_quantity": 30.0
    },

    # Store: Karen (Meat Extra)
    {
        "store_slug": "karen-aka-gosht",
        "category_slug": "meat",
        "name_uz": "Qo'y Qovurg'asi (Shashlikbop)",
        "name_ru": "Бараньи ребрышки для шашлыка и плова",
        "name_en": "Fresh Lamb Ribs (Prime Cut)",
        "description_uz": "Shirin va sersuv qo'y qovurg'alari shashlik va qovurma uchun.",
        "description_ru": "Нежные бараньи ребрышки идеальной жирности для сочного шашлыка.",
        "description_en": "Tender grass-fed lamb ribs perfect for grilling and roasting.",
        "price": 110000.0,
        "old_price": 125000.0,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 35.0
    },

    # Store: Akmal (Dry Fruits)
    {
        "store_slug": "akmal-quruq-meva",
        "category_slug": "dry_fruits",
        "name_uz": "Samarqand Qora 'Soyaki' Mayizi",
        "name_ru": "Самаркандский изюм 'Сояки' (Теневая сушка)",
        "name_en": "Shade-Dried Black 'Soyaki' Raisins",
        "description_uz": "Soyada quritilgan, dorivor va mutlaqo toza shirin mayiz.",
        "description_ru": "Элитный натуральный изюм теневой сушки без химической обработки.",
        "description_en": "Natural shade-dried premium black raisins rich in antioxidants.",
        "price": 65000.0,
        "old_price": 75000.0,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-pouring-dried-fruits-and-nuts-into-a-bowl-41730-large.mp4",
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 50.0
    },
    {
        "store_slug": "akmal-quruq-meva",
        "category_slug": "dry_fruits",
        "name_uz": "Tog' Yong'og'i Mag'zi (Oq & Yog'li)",
        "name_ru": "Грецкий орех горный очищенный (Белый)",
        "name_en": "Mountain Walnuts Kernels (Extra Light)",
        "description_uz": "Bo'stonliq tog'laridan olingan oq va shirin toza yong'oq mag'zi.",
        "description_ru": "Светлые отборные половинки горных грецких орехов без горечи.",
        "description_en": "Pure whole walnut kernels from mountain orchards.",
        "price": 85000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-cracking-open-a-walnut-shell-41732-large.mp4",
        "is_featured": False,
        "badge": "organic",
        "stock_quantity": 40.0
    },
    {
        "store_slug": "akmal-quruq-meva",
        "category_slug": "dry_fruits",
        "name_uz": "Qovurilgan Sho'r Bodom (Po'stloqli)",
        "name_ru": "Жареный соленый миндаль в скорлупе",
        "name_en": "Roasted Salted In-Shell Almonds",
        "description_uz": "Qarsildoq, mazali qovurilgan tog' bodomi.",
        "description_ru": "Отборный хрустящий жареный миндаль с морской солью.",
        "description_en": "Crispy roasted mountain almonds seasoned with pure sea salt.",
        "price": 95000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": False,
        "badge": "premium",
        "stock_quantity": 30.0
    },
    {
        "store_slug": "akmal-quruq-meva",
        "category_slug": "dry_fruits",
        "name_uz": "Oftobda Quritilgan Asal O'rik (Turshak)",
        "name_ru": "Натуральная курага 'Сахарная' (Солнечная сушка)",
        "name_en": "Sun-Dried Honey Apricots",
        "description_uz": "Quyoshda tabiiy usulda quritilgan shirin va yumshoq o'rik.",
        "description_ru": "Мягкая натуральная янтарная курага без сахара и консервантов.",
        "description_en": "Soft, naturally sun-dried golden apricots bursting with sweetness.",
        "price": 70000.0,
        "old_price": 80000.0,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": True,
        "badge": "organic",
        "stock_quantity": 40.0
    },

    # Store: Nodira Opa (Dairy)
    {
        "store_slug": "nodira-opa-sut",
        "category_slug": "dairy",
        "name_uz": "Qalin Tog' Qaymog'i (Qaynatilgan)",
        "name_ru": "Густой домашний каймак (Сливочный)",
        "name_en": "Rich Mountain Clotted Cream (Kaymak)",
        "description_uz": "Tandir non bilan yeyiladigan xushbo'y va shirin tog' qaymog'i.",
        "description_ru": "Настоящий деревенский каймак невероятной густоты и сливочного вкуса.",
        "description_en": "Traditional rich, thick clotted cream perfect with warm tandoor bread.",
        "price": 45000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-spreading-fresh-butter-or-clotted-cream-on-bread-41734-large.mp4",
        "is_featured": True,
        "badge": "organic",
        "stock_quantity": 25.0
    },
    {
        "store_slug": "nodira-opa-sut",
        "category_slug": "dairy",
        "name_uz": "Toza Suzma / Chaqqa (Sho'r & Mayin)",
        "name_ru": "Натуральная сузьма / чакка (Свежая)",
        "name_en": "Organic Suzma / Strained Fresh Yogurt",
        "description_uz": "Ko'katlar va taomlar bilan dasturxonga tortiladigan mayin suzma.",
        "description_ru": "Свежая нежная сузьма для салатов и заправки национальных блюд.",
        "description_en": "Velvety fresh strained yogurt, lightly salted and rich.",
        "price": 18000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.5,
        "step_weight": 0.5,
        "image_url": "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&auto=format&fit=crop&q=80",
        "video_url": "https://assets.mixkit.co/videos/preview/mixkit-pouring-fresh-thick-yogurt-into-a-bowl-41736-large.mp4",
        "is_featured": False,
        "badge": "fresh",
        "stock_quantity": 30.0
    },
    {
        "store_slug": "nodira-opa-sut",
        "category_slug": "dairy",
        "name_uz": "Qishloq Tabiiy Qatig'i (Kosa Qatiq)",
        "name_ru": "Домашний натуральный катык (Густой)",
        "name_en": "Natural Farm Qatiq (Probiotic Yogurt)",
        "description_uz": "Toza sigir sutidan ivitilgan qalin va mazali qatiq.",
        "description_ru": "Густой живой катык из отборного цельного фермерского молока.",
        "description_en": "Traditional thick probiotic fermented farm yogurt.",
        "price": 12000.0,
        "old_price": None,
        "unit": "dona",
        "min_weight": 1.0,
        "step_weight": 1.0,
        "image_url": "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": False,
        "badge": "organic",
        "stock_quantity": 30.0
    },
    {
        "store_slug": "nodira-opa-sut",
        "category_slug": "dairy",
        "name_uz": "Qo'lda Tayyorlangan Sariq Yog' (Masko)",
        "name_ru": "Натуральное топленое масло 'Маско' (Сливочное)",
        "name_en": "Pure Artisanal Ghee / Clarified Butter",
        "description_uz": "Xushbo'y, toza va tabiiy qishloq sariyog'i.",
        "description_ru": "Ароматное золотистое топленое домашнее сливочное масло высшего сорта.",
        "description_en": "Pure golden clarified butter rendered slowly for rich nutty aroma.",
        "price": 90000.0,
        "old_price": None,
        "unit": "kg",
        "min_weight": 0.25,
        "step_weight": 0.25,
        "image_url": "https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&auto=format&fit=crop&q=80",
        "video_url": None,
        "is_featured": True,
        "badge": "premium",
        "stock_quantity": 20.0
    }
]

async def init_db_and_seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        # 1. Sync Categories
        cat_res = await session.execute(select(CategoryModel))
        existing_cats = {c.slug: c for c in cat_res.scalars().all()}
        for cat_data in CATEGORIES:
            if cat_data["slug"] not in existing_cats:
                cat = CategoryModel(**cat_data)
                session.add(cat)
        await session.commit()

        # 2. Sync Stores
        store_res = await session.execute(select(StoreModel))
        existing_stores = {s.slug: s for s in store_res.scalars().all()}
        store_map = {s.slug: s.id for s in existing_stores.values()}

        for store_data in STORES:
            if store_data["slug"] not in existing_stores:
                store = StoreModel(**store_data)
                session.add(store)
                await session.flush()
                store_map[store.slug] = store.id
            else:
                store_map[store_data["slug"]] = existing_stores[store_data["slug"]].id
        await session.commit()

        # Clean up legacy duplicate emoji records
        from sqlalchemy import delete
        await session.execute(
            delete(ProductModel).where(
                (ProductModel.name_uz.like("👑%")) | 
                (ProductModel.name_uz.like("🍲%")) | 
                (ProductModel.name_uz.like("🍢%")) | 
                (ProductModel.name_uz.like("🥗%"))
            )
        )
        await session.commit()

        # 3. Sync Products
        prod_res = await session.execute(select(ProductModel))
        existing_prods = {p.name_uz: p for p in prod_res.scalars().all()}

        for prod_data in PRODUCTS:
            p_data = dict(prod_data)
            store_slug = p_data.pop("store_slug")
            store_id = store_map.get(store_slug, 1)
            p_data["store_id"] = store_id

            if p_data["name_uz"] not in existing_prods:
                prod = ProductModel(**p_data)
                session.add(prod)
            else:
                ep = existing_prods[p_data["name_uz"]]
                ep.name_ru = p_data["name_ru"]
                ep.name_en = p_data["name_en"]
                ep.price = p_data["price"]
                ep.old_price = p_data.get("old_price")
                ep.badge = p_data.get("badge")
                if ep.video_url and "mixkit.co" in ep.video_url:
                    ep.video_url = None
                elif p_data.get("video_url") and "mixkit.co" not in p_data["video_url"]:
                    ep.video_url = p_data["video_url"]
                if p_data.get("image_url"):
                    ep.image_url = p_data["image_url"]

        await session.commit()

