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
- [ ] Telegram orqali tayyorlik va kirish ma’lumotlarini yuborish.

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
