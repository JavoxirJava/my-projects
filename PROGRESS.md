# My Projects ish jarayoni

## 2026-10-07

- [x] Kelishilgan PROJECT_PLAN.md va serverga oid mavjud qoidalar o‘qildi.
- [x] GitHub origin va mahalliy Node.js muhiti tekshirildi.
- [x] Serverga SSH kirish va GitHub autentifikatsiyasi tasdiqlandi.
- [x] Bot orqali egasiga ish boshlanganligi haqida xabar yuborildi.
- [x] Login va doimiy ZIP paroli yaratildi; sirlar Gitdan tashqarida saqlanmoqda.
- [x] TypeScript, Next.js va PostgreSQL ilovasini yaratish.
- [x] Loyihalar, rejalar, guruhlar, hisoblar va mobil interfeys.
- [x] Telegram, parolli ZIP zaxira va qayta tiklash.
- [x] Monitoring, eslatmalar va bot orqali qidirish.
- [x] Avtomatik tekshiruvlar va brauzerda sinash.
- [x] Ajratilgan server muhiti, HTTPS va CI/CD.
- [x] Boshqa servislar holatini qayta tekshirish.
- [x] Telegram orqali tayyorlik va kirish ma’lumotlarini yuborish.

## Joylashtirish qarorlari

- Foydalanuvchi saytni 204.13.232.140 serverida my-projects.javohir-dev.uz domeniga joylashtirishga ruxsat berdi.
- Boshqa loyihalar konfiguratsiyasi va ma’lumotlari o‘zgartirilmaydi.
- Alohida OS foydalanuvchisi, katalog, PostgreSQL bazasi va rollari ishlatiladi.
- Ilova porti: 127.0.0.1:4350, mavjud portlar bilan to‘qnashmasligi tekshiriladi.
- Ishlab chiqarish buildi VPSda bajarilmaydi.
- Texnologiyalar: Next.js/React + TypeScript, PostgreSQL, alohida Node.js fon jarayoni.

## Dastur va tekshiruvlar

- Next.js interfeysi, guruhlar, qidiruv/filtrlar, sevimlilar, arxiv, ko‘p havolalar va rol hisoblari yozildi.
- Sessiya, kirish urinishlari limiti va origin tekshiruvi qo‘shildi. Parollar AES-GCM bilan shifrlanadi.
- Har o‘zgarish uchun tranzaksion zaxira navbati, AES parolli ZIP, qayta urinish va tiklash bajarildi.
- Telegram faqat egasiga javob beradi; bot orqali qidiruv, monitoring va muddat eslatmalari yozildi.
- Monitoring ichki IP manzillarni bloklaydi, vaqt chegarasi va uzilish/tiklanish deduplikatsiyasi bor.
- 8 xavfsizlik testi, alohida PostgreSQL sxemasidagi API integratsiya testi o‘tdi.
- Production build muvaffaqiyatli bajarildi. Desktop/mobil brauzer tekshiruvi davom etmoqda.
- Domen DNSi tarqaldi, HTTPS sertifikati olindi.
- GitHub Actions uchun loyiha bilan cheklangan SSH identifikatori va secrets o‘rnatildi.
- Serverdagi 42 ta oldingi servisning PID, start va restart holatlari o‘zgarmagani tekshirildi.

- Desktop va mobil brauzerda to‘liq loyiha oqimi o‘tdi: guruh, loyiha, 2 havola, 2 hisob, parol reveal/preserve, qidiruv, sevimli va arxiv.
- npm audit: aniqlangan zaifliklar yo‘q.
- Birinchi GitHub Actions relizi tayyorlanmoqda.

## Production reliz

- Birinchi reliz: `817415c1973099a42b4ef12f31a7bebe1cf73b9c`. GitHub Actions test, build, deploy va HTTPS tekshiruvini muvaffaqiyatli bajardi.
- CI: https://github.com/JavoxirJava/my-projects/actions/runs/37633909634
- Sayt: https://my-projects.javohir-dev.uz
- Web va worker sog‘lom; deployment revision va worker heartbeat mos.
- Vaqtinchalik browser test sxemasi o‘chirildi; production loyihalari bo‘sh.
- Predeploy va ishlayotgan baza dumpidan alohida vaqtinchalik bazaga tiklash sinovlari o‘tdi.
- Boshqa 42 ta servis o‘zgarishsiz ishlamoqda.
- ZIP upload chegarasi bilan Nginx cheklovi moslashtirildi; alohida sertifikat auto-renew hook tekshirildi.
- Faqat Markdown o‘zgarishlarida ortiqcha deploy bo‘lmasligi uchun CI path filter qo‘shildi.

## Yakuniy natija

- Rejadagi funksiyalar bajarildi va productionga chiqarildi.
- Yakuniy dastur relizi: `62cac6b21fc75d4c63fe29aee10ae6a4c580eef5`.
- Yakuniy CI/CD: https://github.com/JavoxirJava/my-projects/actions/runs/37634465681 — barcha bosqichlar muvaffaqiyatli.
- Production HTTPS login va logout tekshirildi; sessiya Secure, HttpOnly, SameSite=Strict.
- Haqiqiy parolli ZIP zaxira egasining Telegram chatiga yuborildi, bazadagi status `sent`.
- Production desktop/mobil sahifalar ko‘rildi; mobil gorizontal overflow yo‘q, brauzer xatolari yo‘q.
- Bot: https://t.me/my_projects_infinite_bot ; /start, /help, /status menyusi o‘rnatildi.
- Sayt manzili, login-parol va doimiy ZIP paroli Telegramga muvaffaqiyatli yetkazildi. Sirlar ushbu faylga yozilmadi.
- Oxirgi relizdan keyin ham oldingi 42 ta servis o‘zgarishsiz ishlamoqda.
- Alohida baza dumpidan tiklash qayta tekshirildi (8 jadval); vaqtinchalik test bazalari va sxemalari olib tashlandi.
- Mahalliy preview to‘xtatildi. Mahalliy resolver eski DNS natijasini ushlab turgani sabab production brauzer testi faqat test jarayonidagi host mapping orqali, haqiqiy TLS sertifikatini tekshirib bajarildi. GitHub runner domenni oddiy DNS bilan muvaffaqiyatli tekshirdi.

## Ekspluatatsiya eslatmasi

Monitoring worker va sayt bir serverda. Shu server butunlay o‘chsa, worker xabar yubora olmaydi; mustaqil tashqi kuzatuv alohida imkoniyat hisoblanadi. Hosting/DNS tarqalishidan boshqa ochiq bloklovchi masala yo‘q.

## Xavfsizlik auditi — 2026-10-08

- [x] Kod, autentifikatsiya/sessiyalar, ZIP, Telegram, monitoring, CI/CD va loyiha server sozlamalari tekshirildi.
- [x] Mahalliy salbiy sinovlar va productionda faqat o‘qish tekshiruvlari bajarildi; mavjud xavfsizlik testlari 8/8 o‘tdi.
- [x] Topilmalar, hujum uchun zarur shartlar, ustuvor tuzatishlar va qabul mezonlari `.private/SECURITY_REVIEW.md`ga yozildi.
- Batafsil hisobot Git kuzatmaydigan mahalliy faylda saqlanadi; public repoga chiqarilmadi.
- Ushbu bosqich audit va reja bilan cheklangan. Kod, server va GitHub sozlamalariga tuzatish kiritilmadi; rejadagi xavfsizlik ishlari hali bajarilishi kerak.

## Xavfsizlik tuzatishlari — 2026-10-08

- [x] Sessiya versiyasi va parol almashtirish bilan atomar tekshiruv qo‘shildi.
- [x] Login/JSON/multipart hajm, tezlik va parallel ish chegaralari qo‘shildi; parol hisoblash asinxron.
- [x] Qat’iy AES-256 ZIP tiklash, qayta parol tekshiruvi va tiklashdan oldingi sonlar tasdig‘i qo‘shildi.
- [x] HTTPS `__Host-` cookie, sessiya idle muddati va sirlarni avtomatik yashirish qo‘shildi.
- [x] Mahalliy ajratilgan bazada 13 ta test va eski sxemadan migratsiya tekshiruvi o‘tdi.
- [x] Mustaqil Security Review dastur o‘zgarishlarida bloklovchi muammo topmadi.
- [x] CI build/deploy ajratildi; production secrets faqat master uchun environmentga ko‘chirildi.
- [x] Cheklangan root deploy helperi, alohida worker UID/env va Nginx limitlari tayyorlandi.
- [x] Deploy arxiviga oid 8 ta Python testi, haqiqiy 97.7 MiB paketni ochish va desktop/mobil brauzer sinovi o‘tdi.
- [ ] Tekshirilgan kodni CI/CD orqali productionga chiqarish.
- [ ] Parollarni xavfsiz yangilash, production va qo‘shni servislarni tekshirish.
