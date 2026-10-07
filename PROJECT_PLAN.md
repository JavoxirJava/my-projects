# Shaxsiy loyihalar platformasi

Kelishilgan talablar sanasi: 2026-10-07.

Ushbu fayl keyingi ishlab chiqish uchun asosiy reja hisoblanadi. Funksional talablar, dasturlash tili va quyida ko‘rsatilgan texnologiyalar foydalanuvchi bilan kelishilgan. Dastur ushbu reja asosida amalga oshirildi va productionga joylashtirildi; tekshiruvlar va reliz holati PROGRESS.md faylida.

## Maqsad va foydalanish

Barcha loyihalar, hali boshlanmagan g‘oyalar, havolalar va kirish ma’lumotlarini bitta shaxsiy platformada saqlash. Kerakli loyihani tez topib, uning sayti, Telegram boti yoki boshqa manziliga o‘tish.

- Platformadan faqat egasi foydalanadi va o‘z login-paroli bilan kiradi.
- Interfeys telefon va kompyuter brauzerlariga mos bo‘ladi.
- Jamoani taklif qilish, boshqa foydalanuvchilar va ularga ruxsat berish funksiyalari bo‘lmaydi.
- “Jamoa bilan” belgisi loyihaning bajarilish turini bildiradi, platformadan birgalikda foydalanishni emas.

## Loyihalar va rejalar

Har bir loyiha quyidagi ma’lumotlarni saqlaydi:

| Maydon | Mazmuni |
| --- | --- |
| Nomi | Loyiha yoki g‘oya nomi |
| Tavsif | Vazifasi va qisqa mazmuni |
| Holati | G‘oya/reja, ishlab chiqilmoqda, ishlayapti, to‘xtatilgan, arxiv |
| Platformasi | Sayt, Telegram bot, mobil ilova, API yoki boshqa |
| Bajarilishi | O‘zim yoki jamoa bilan |
| Guruhi | Foydalanuvchi yaratadigan guruhlar |
| Teglar | Qidirish va tasniflash uchun belgilar |
| Havolalar | Loyihaga tegishli bir nechta manzil |
| Hisoblar | Turli rollar uchun bir nechta login-parol |
| Eslatmalar | Erkin izohlar |
| Vazifalar | Bajariladigan ishlar va bajarilganlik holati |
| Muddatlar | Domen va hosting tugash sanalari |

G‘oya yoki reja uchun havola va hisoblar majburiy emas. Ish boshlanganda o‘sha yozuvning holati o‘zgartiriladi. Loyihalarni qo‘shish, tahrirlash va arxivlash mumkin.

## Guruhlash va havolalar

- Loyihalar foydalanuvchi yaratadigan guruhlarga ajratiladi.
- Bitta loyihaning barcha havolalari uning umumiy kartochkasi ichida jamlanadi.
- Har bir havolada nom, manzil, tur va ixtiyoriy izoh bo‘ladi.
- Asosiy sayt, admin panel, Telegram bot, GitHub va hujjatlar kabi havolalar qo‘shiladi.
- Havolani ochish va nusxalash tugmalari bo‘ladi.

## Hisoblar va parollar

- Bitta loyihaga bir nechta hisob qo‘shiladi.
- Har bir hisobda nom, rol, login, parol, tegishli havola va ixtiyoriy izoh saqlanadi.
- Bitta rol uchun ham bir nechta hisob kiritish mumkin.
- Masalan: administrator, menejer, operator va oddiy foydalanuvchi hisoblari.
- Loyiha parollari server bazasida shifrlangan holda saqlanadi.
- Parollar interfeysda odatda yashirin turadi; ko‘rsatish va nusxalash mumkin.
- Platformaning o‘ziga kirish paroli qayta ochiladigan loyiha parollaridan alohida ko‘riladi va xesh ko‘rinishida saqlanadi.
- Haqiqiy parollar, bot tokeni, ZIP paroli va shifrlash kalitlari Gitga yoki ushbu rejaga yozilmaydi.

## Qidiruv va navigatsiya

- Nom bo‘yicha tez qidirish.
- Guruh, teg, platforma, holat va bajarilish turi bo‘yicha filtrlash.
- Sevimli loyihalar.
- Kartochka va ro‘yxat ko‘rinishlari.
- Havolalar va hisob ma’lumotlariga tez kirish.
- So‘nggi o‘zgarishlarni ko‘rish.

## Ixtiyoriy monitoring

- Monitoring har bir loyiha uchun alohida yoqiladi yoki o‘chiriladi.
- Foydalanuvchi tekshiriladigan manzilni ko‘rsatadi.
- Yoqilgan manzillar har soatda tekshiriladi, brauzer ochiq turishi talab qilinmaydi.
- Muvaffaqiyatli HTTP javob kodi sozlanadi; dastlabki qiymat 200 bo‘ladi.
- Javob kutiladigan vaqt chegarasi bo‘ladi.
- Javob kelmasa yoki xato qaytsa, qisqa oraliqda qayta tekshiriladi.
- Muammo tasdiqlansa, Telegramga loyiha nomi, manzili, vaqt va xato yuboriladi.
- Ishlash tiklanganda ham Telegram xabari yuboriladi.
- Davom etayotgan bitta uzilish uchun har soatda takroriy xabar yuborilmaydi.
- Oxirgi tekshiruv vaqti, natijasi va muammo holati saytda ko‘rinadi.
- Xabarda manzilga ulanish muammosi bildiriladi; har qanday xato server o‘chgan deb talqin qilinmaydi.

Monitoring jarayonining o‘zi ishlayotgan server butunlay o‘chsa, u xabar yubora olmaydi. Mustaqil tashqi kuzatuv kerak bo‘lsa, joylashtirish arxitekturasini tanlashda alohida kelishiladi.

## Telegram integratsiyasi

Bitta shaxsiy bot quyidagi vazifalarni bajaradi:

- Monitoring muammolari va tiklanish xabarlarini yuborish.
- Avtomatik zaxira ZIP fayllarini egasining shaxsiy chatiga yuborish.
- Loyiha nomi bilan qidirilganda uning havolalarini qaytarish.
- Domen va hosting muddati haqida eslatmalar yuborish.

Botdan foydalanish egasining Telegram identifikatori bilan cheklanadi. Bot tokeni va qabul qiluvchi chat sozlanadi. Parollarni botdagi qidiruv javoblarida chiqarish talab qilinmagan.

## Zaxira va qayta tiklash

Foydalanuvchi tanlagan format: oddiy TXT fayl, doimiy parol bilan himoyalangan ZIP ichida.

Har bir foydalanuvchi ma’lumot qo‘shishi yoki yangilashidan keyin:

1. O‘zgarish bazada saqlanadi.
2. Barcha foydalanuvchi ma’lumotlarining to‘liq nusxasi TXTga chiqariladi; loyiha login-parollari uning ichida ochiq matn bo‘ladi.
3. TXT fayl foydalanuvchi belgilagan bitta doimiy parol bilan himoyalangan ZIPga joylanadi.
4. Sana va vaqt bilan nomlangan ZIP Telegramdagi shaxsiy chatga yuboriladi.
5. Yuborish holati va oxirgi muvaffaqiyatli zaxira vaqti qayd etiladi.

- TXTning o‘zi alohida shifrlanmaydi; himoya ZIP arxivi darajasida bo‘ladi.
- Har bir ZIP uchun o‘sha doimiy parol ishlatiladi, yangi tasodifiy parol yaratilmaydi.
- Egasi ZIPni o‘zi parol bilan ochib, TXTni o‘qiy oladi.
- ZIP paroli arxivning ichiga yoki Telegram xabariga qo‘shilmaydi.
- Telegram vaqtincha ishlamasa, bazadagi o‘zgarish saqlanadi va yuborish qayta uriniladi.
- Fon ishlarining navbati qayta ishga tushirishda yo‘qolmasligi kerak.
- Vaqtinchalik ochiq TXT doimiy saqlanmaydi va ommaviy manzil orqali ochilmaydi.
- TXT formati inson o‘qiy oladigan, ayni paytda tiklash uchun aniq tuzilishga va format versiyasiga ega bo‘ladi.
- Zaxiradan loyihalar, guruhlar, havolalar, hisoblar, vazifalar va foydalanuvchi sozlamalarini qayta tiklash mumkin bo‘ladi.
- Tiklangan loyiha parollari bazaga yana shifrlangan holda yoziladi.
- Avtomatik monitoring natijalari va zaxira holatining yangilanishi yangi zaxiralarni cheksiz ishga tushirmaydi.

## Domen va hosting eslatmalari

- Tegishli loyiha uchun domen va hosting tugash sanalarini kiritish.
- Yaqinlashayotgan muddatlarni saytda ko‘rsatish.
- Telegram orqali oldindan eslatish.
- Eslatish oralig‘i va aniq sozlamalar amalga oshirishda belgilanadi.

## Asosiy sahifalar

1. Kirish sahifasi.
2. Bosh sahifa: sevimlilar, so‘nggi o‘zgarishlar, monitoring muammolari va yaqin muddatlar.
3. Loyihalar: guruhlar, qidiruv, filtrlar, kartochka va ro‘yxat.
4. Loyiha tafsilotlari: havolalar, hisoblar, vazifalar, izohlar, muddatlar va monitoring.
5. Loyiha qo‘shish va tahrirlash.
6. Sozlamalar: shaxsiy kirish, Telegram, doimiy ZIP paroli, zaxira holati va qayta tiklash.

## Tasdiqlangan texnologiyalar

Holati: foydalanuvchi tomonidan tasdiqlangan. Loyiha to‘liq TypeScript asosida yoziladi.

| Qism | Tanlangan texnologiya |
| --- | --- |
| Asosiy dasturlash tili | TypeScript |
| Interfeys va veb server | Next.js va React |
| Ma’lumotlar bazasi | PostgreSQL |
| Bot va fon vazifalari | Node.js ustida alohida TypeScript jarayoni |
| Fon ishlarining saqlanishi | PostgreSQLda saqlanadigan vazifalar navbati |

Bu tuzilishda interfeys, server va bot bir tilda yoziladi. Monitoring, zaxira yuborish va muddat eslatmalari veb so‘rovlaridan mustaqil fon jarayonida bajariladi; brauzer yopiq bo‘lsa ham ishlaydi. Qo‘shimcha kutubxonalar va aniq versiyalar ishlab chiqish boshlanganda belgilanadi.

Rasmiy manbalar: [Next.js hujjatlari](https://nextjs.org/docs), [Node.js TypeScript qo‘llanmasi](https://nodejs.org/learn/typescript/introduction).

## Amalga oshirish bosqichlari

1. Tasdiqlangan texnologiyalar asosida loyiha tuzilmasi, ma’lumotlar modeli va sahifalar tuzilmasini tayyorlash.
2. Shaxsiy kirish, loyihalar, g‘oyalar, guruhlar, teglar, havolalar va hisoblar.
3. Qidiruv, filtrlar, sevimlilar, vazifalar, arxiv va telefon uchun qulay interfeys.
4. Telegram integratsiyasi, har o‘zgarishdan keyingi parolli ZIP zaxira va qayta tiklash.
5. Soatlik monitoring, uzilish va tiklanish xabarlari.
6. Domen va hosting eslatmalari, bot orqali loyiha qidirish.
7. Muhim jarayonlarni tekshirish va foydalanuvchi ruxsat bergan serverga CI/CD orqali joylashtirish.

Barcha bosqichlar umumiy loyiha doirasiga kiradi; keyingi bosqichga ajratish funksiyani bekor qilish emas.

## Yakuniy tekshiruv mezonlari

- Havolasiz g‘oya yaratilib, keyinchalik ishlaydigan loyihaga aylantiriladi.
- Bitta loyiha ichida bir nechta havola, turli rollar va bir rolga tegishli bir nechta hisob saqlanadi.
- Begona foydalanuvchi sayt yoki bot orqali ma’lumotlarni ololmaydi.
- Loyiha parollari bazada ochiq matnda turmaydi; egasi interfeysda ochishi va nusxalashi mumkin.
- Ma’lumot qo‘shish va yangilashdan so‘ng Telegramga doimiy parolli ZIP keladi.
- To‘g‘ri parol bilan ZIP ochiladi, noto‘g‘ri parol bilan ichidagi TXT ochilmaydi.
- Zaxiradan tiklanganda hisob parollari va loyihalar orasidagi bog‘lanishlar saqlanadi.
- Telegram uzilishidan keyin kutilayotgan zaxiralar yuboriladi.
- Monitoring o‘chirilgan loyiha tekshirilmaydi; yoqilganda uzilish va tiklanish to‘g‘ri bildiriladi.
- Qidiruv, filtrlar va asosiy amallar telefon hamda kompyuterda ishlaydi.

## Tasdiqlangan joylashtirish

- Server: 204.13.232.140; domen: my-projects.javohir-dev.uz.
- GitHub Actions orqali tekshiruv, build va deploy; zarur bo‘lsa vaqtinchalik to‘g‘ridan-to‘g‘ri artifact deploy.
- Mavjud loyihalarga tegmasdan alohida xizmat, port, OS foydalanuvchilari va PostgreSQL bazasi.
- Platformaga boshlang‘ich login/parol va doimiy ZIP paroli yaratilib, egasiga shaxsiy Telegram bot orqali yetkaziladi.
- Bot tokeni va haqiqiy parollar hujjatlarda hamda Gitda saqlanmaydi.
- Ish jarayoni PROGRESS.md da qayd etiladi.
