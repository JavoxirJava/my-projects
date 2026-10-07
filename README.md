# My Projects

Shaxsiy loyihalar, g‘oyalar, havolalar va rol hisoblari uchun platforma. Telefon va kompyuterga mos Uzbek interfeys, shifrlangan parollar, Telegramga parolli ZIP zaxira, soatlik monitoring va domen/hosting eslatmalari.

Production: https://my-projects.javohir-dev.uz

## Muhit

Node.js 24+, PostgreSQL. `npm ci`, `.env.example`dan `.env.local` yarating va haqiqiy qiymatlarni kiriting. Sirlar Gitga kiritilmaydi. Shifrlash kaliti: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

1. Alohida PostgreSQL baza va migrator/runtime rollarini yarating.
2. Migrator huquqi bilan `npm run migrate` bajaring; `MIGRATION_DATABASE_URL` o‘rnatilsa, migratsiya shu ulanishdan foydalanadi. Runtime roli DML bilan cheklansin.
3. `npm run dev` — lokal veb server, 127.0.0.1:4350.
4. `npm run worker` — alohida fon jarayoni. Telegram botdan `/start` bosing.

`ADMIN_LOGIN`, `ADMIN_PASSWORD`, `BACKUP_PASSWORD` faqat birinchi yaratishda ishlatiladi. Keyingi o‘zgarishlar saytdagi Sozlamalar orqali amalga oshiriladi. `ENCRYPTION_KEY` o‘zgartirilsa, eski bazadagi sirlarni ochib bo‘lmaydi; uni xavfsiz saqlang.

## Foydalanish

- Guruh qo‘shing, loyiha yoki havolasiz g‘oya yarating.
- Bitta loyihaga bir nechta havola, bir xil yoki turli rollardagi hisoblar va vazifalar qo‘shing.
- Yulduz orqali sevimlilarga kiriting; qidiruv va filtrlar orqali toping.
- Parolni ko‘rsatish alohida autentifikatsiyalangan so‘rov; ro‘yxatda parollar uzatilmaydi.
- Monitoring yoqilsa, ommaviy HTTP/HTTPS 80/443 manzil har soatda tekshiriladi. Xatoda qayta tekshirish, uzilish va tiklanish xabarlari bor. Yo‘naltirishlar avtomatik kuzatilmaydi; yakuniy manzilni kiriting.
- Domen/hosting sanalaridan 30, 14, 7, 3, 1 kun oldin va o‘sha kuni eslatma keladi.
- Botga loyiha nomini yuborish havolalarni qaytaradi. `/status` fon xizmati holatini ko‘rsatadi. Faqat egasining shaxsiy chatidan foydalanish mumkin.

## Zaxira

Har bir foydalanuvchi ma’lumot qo‘shishi yoki yangilashida to‘liq nusxa tranzaksiya ichida navbatga yoziladi. Navbatdagi snapshot shifrlanadi. Worker inson o‘qiy oladigan JSON tuzilishidagi `my-projects.txt`ni AES-256 parolli ZIPga joylaydi va Telegramga yuboradi. TXTning o‘zi shifrlanmaydi. Bir xil doimiy ZIP paroli ishlatiladi; uni sozlamalarda o‘zgartirish mumkin.

Yuborish ishlamasa, qayta uriniladi. Yuborilgach vaqtinchalik snapshot server navbatidan tozalanadi, holat tarixi 90 kun saqlanadi. Parolli ZIPni AES ZIPni qo‘llaydigan arxiv dasturida ochish mumkin. TXTda loyihalar va login-parollar ochiq matnda o‘qiladi.

Sozlamalardagi tiklash funksiyasi ZIP va uning parolini qabul qiladi. Joriy ma’lumotlar oldin zaxiralanadi, keyin loyihalar/guruhlar almashtiriladi. Platformaga kirish va joriy ZIP paroli o‘zgarmaydi. Tiklangan loyiha parollari yangi server kaliti bilan bazada shifrlanadi.

## Tekshiruvlar

- `npm run typecheck`
- `npm test` — xavfsizlik testlari; `TEST_DATABASE_URL` berilganda alohida vaqtinchalik sxemada API integratsiya testi ham ishlaydi.
- `npm run build`
- `npx playwright test` — ishlayotgan lokal server va `.env.local` bilan desktop/mobil oqimlar. Buni faqat alohida test bazasida bajaring; test loyihalar yaratadi. Productionda bajarmang.

## Joylashtirish

GitHub Actions har `main`/`master` pushda testlar va buildni bajaradi, keyin ajratilgan server xizmatini yangilaydi. Batafsil: [deploy/README.md](deploy/README.md). Boshqa loyihalar jarayonlari, bazalari va portlari o‘zgartirilmaydi.

Monitoring serverining o‘zi o‘chsa, u xabar yubora olmaydi. Bunday holatni kuzatish uchun tashqi mustaqil monitor kerak.

Talablar: [PROJECT_PLAN.md](PROJECT_PLAN.md). Bajarilgan ishlar: [PROGRESS.md](PROGRESS.md).
