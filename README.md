# 🏭 BS-SHOES — Ishlab Chiqarish Sex Boshqaruv Tizimi (Telegram Bot)

Ushbu bot poyabzal ishlab chiqarish sexlari va korxonalari uchun to'liq avtomatlashtirilgan boshqaruv tizimidir. Sex rahbari, ishchilar (oddiy ishchilar va maktab o'quvchilari) hamda do'kon/ulgurji mijozlar (clientlar) faoliyatini bir joyda muvofiqlashtiradi.

---

## 🤖 Bot Ma'lumotlari:
- **Bot username:** [@for_my_dad1_bot](https://t.me/for_my_dad1_bot)
- **Token:** `8803645082:AAHrga4_UtoVJDz3fQY_j6PmGjKS8MW791U`
- **Render Live URL:** [https://bs-shoes-bot.onrender.com](https://bs-shoes-bot.onrender.com)
- **Render Dashboard:** [https://dashboard.render.com/web/srv-dba4imbrjlhs738soddg](https://dashboard.render.com/web/srv-dba4imbrjlhs738soddg)
- **GitHub Repository:** [https://github.com/AbdulhodiyOmonboyev/bs-shoes-bot](https://github.com/AbdulhodiyOmonboyev/bs-shoes-bot)
- **Texnologiyalar:** Node.js (v24), Telegraf (v4), Built-in SQLite (`node:sqlite`), ExcelJS, Unsleep Keep-Alive (90s)

---

## 🔐 Sex Rahbari (Admin) Paneli:
Boshqaruv paneliga kirish maxfiy tarzda amalga oshiriladi:
1. Telegramda botga `/admin` yoki `/login` buyrug'ini yuboring.
2. Bot login so'raydi. Standart login: `admin`
3. Bot parol so'raydi. Standart parol: `admin777`
4. Muvaffaqiyatli kirgach, sizga **Super Admin** maqomi beriladi va asosiy menyu ochiladi.
*(Parol va loginni "Qo'shimcha sozlamalar" bo'limidan xohlagan payt o'zgartirishingiz mumkin).*
5. Chiqish uchun `/logout` buyrug'i mavjud.

---

## 📱 Bo'limlar va Imkoniyatlar:

### 1. 👥 Ishchilar boshqaruvi
- Barcha ishchilar ro'yxatini ko'rish, yangi ishchi qo'shish, tahrirlash va o'chirish.
- **Rollar:**
  - 👷‍♂️ **Oddiy ishchi** — Belgilangan ish vaqti: ertalab `09:00`
  - 🎒 **Maktab o'quvchisi** — Belgilangan ish vaqti: abetdan keyin `13:00`
- Har bir ishchining joriy balansi, ishlagan soatlari va davomati.
- Ishchining telefon raqamini kiritish orqali avtomatik identifikatsiya.

### 2. ⚙️ Narxlar va Bo'limlar
- Ishlab chiqarish sexidagi har bir ish turi va bo'limlar narxlarini sozlash:
  - *Tortuv* (masalan: 2 000 so'm / juft)
  - *Zagatovka* (masalan: 3 500 so'm / juft)
  - *Padoj* (masalan: 2 500 so'm / juft)
  - *Stirka* (masalan: 1 800 so'm / juft)
  - *Qadoqlash* va boshqa ishlar.
- Yangi ish qo'shish, o'chirish va narxlarni tahrirlash.

### 3. ⏱ Davomat va Nazorat
- Kunlik davomat: bugun nechta ishchi keldi, kimlar kelmadi, hozir kim ishlayapti, kim ishni yakunladi.
- Ishga kelish va ketish vaqtlari, ishlangan soat va daqiqalar.
- **Avtomatik jarima va bonuslar:**
  - Ishga vaqtida kelganlarga avtomatik **Bonus** (masalan: +5 000 so'm).
  - Kech qolganlarga avtomatik **Kechikish jarimasi** (masalan: -10 000 so'm).
- Sex rahbari ishchi ishga kelganda va ishni tugatganda rasm/xabardagi formatda darhol ogohlantirish oladi.
- **📥 Excel hisobot:** Kunlik va oylik davomatni Excel faylda yuklab olish.

### 4. 📥 Tasdiqlash qutisi
- Ishchilar qilgan ishlarini (masalan, Zagatovka - 100 juft) topshirganda to'g'ridan-to'g'ri shu qutiga kelib tushadi.
- **Rahbar imkoniyatlari:**
  - `✅ Qabul qilish`: To'liq qabul qiladi, pul ishchi hisobiga qo'shiladi va ishchiga xabar boradi.
  - `✏️ Soni kamaytirib qabul qilish`: Masalan, ishchi 100 juft topshirgan, lekin tekshirganda 85 tasi to'g'ri chiqqan bo'lsa, rahbar 85 deb kiritadi. Bot yangi summani hisoblab ishchi hisobiga o'tkazadi va ishchini ogohlantiradi.
  - `❌ Rad etish`: Sababi bilan birga ishchiga qaytariladi.

### 5. 📊 Hisobotlar
- Kunlik, haftalik, oylik va umumiy hisobotlar.
- Har bir ishchi qancha pul ishladi, qaysi bo'limda nechta ish bo'ldi.
- Barcha ma'lumotlarni chiroyli `.xlsx` (Excel) fayl ko'rinishida yuklab olish.

### 6. ✉️ E'lon va Topshiriqlar
- **Umumiy e'lon:** Barcha ishchilarga bitta xabar orqali e'lon berish (masalan: *"Ertaga bayram munosabati bilan ish bo'lmaydi"*).
- **Shaxsiy xabar:** Tanlangan ishchiga shaxsiy topshiriq yuborish.

### 7. 💸 Avans berish
- Ishchilarga berilgan avans (qarz) hisobini yuritish.
- Berilgan avans avtomatik ravishda ishchining hisobidan minus qilinadi va ishchiga bildirishnoma boradi.
- Ishchilar bot orqali avans so'rash imkoniyatiga ega.

### 8. ⚠️ Jarima berish
- Qoidabuzarlik qilgan ishchiga sababini ko'rsatgan holda jarima yozish.
- Summa avtomatik tarzda oylikdan chegiriladi va ishchiga ogohlantirish yuboriladi.

### 9. 👨‍💼 Clientlar (Mijozlar & Sotuv CRM)
- Tayyor mahsulot sotuvi hisobi:
  - Mijoz nomi, telefon raqami, do'koni/firmasi.
  - Sotilgan mahsulot nomi, pochka soni, pochka narxi, jami summa, to'langan pul va **qoldiq qarz**.
- Bot orqali mijoz bilan to'g'ridan-to'g'ri chatlashish va xabar yuborish.
- Barcha sotuv va qarzlar bo'yicha to'liq Excel hisoboti.

### 10. 💰 Pul va haftalik (Ish haqi & Settlement)
- Oylik / Haftalik to'lov vaqtida barcha ishchilarning yakuniy to'lanadigan pullari:
  `Qilingan ish summasi + Bonuslar - Kechikish jarimalari - Boshqa jarimalar - Olingan avanslar = SOF OYLIK`
- Excel hisobotini yuklab olish.
- **"✅ Barcha ishchilarning oyligi berildi"** tugmasi:
  - Ushbu davr bo'yicha yakuniy hisobotni chiqarib beradi.
  - Barcha ishchilarning shaxsiy balansini `0` ga tenglashtiradi.
  - Yangi davr boshlangani haqida ishchilarga tabrik xabari yuboradi.

### 11. 🔧 Qo'shimcha sozlamalar
- Yangi adminlar qo'shish va admin login/parolini o'zgartirish.
- Sex joylashuvi (GPS lokatsiyasi) va ruxsat etilgan radiusni (masalan: 250m) o'rnatish.
- Ish boshlanish vaqtlari (Oddiy ishchilar: `09:00`, O'quvchilar: `13:00`).
- Bonus va jarima summalarini sozlash.

---

## 👷‍♂️ Ishchi Menyu Bo'limlari:
- `🟢 Ishga keldim` (GPS lokatsiya bilan yoki lokatsiyasiz)
- `🔴 Ishni tugatdim` (Ishlangan soat va daqiqani chiqaradi)
- `📥 Ish topshirish` (Bo'limni tanlab, qilingan sonini kiritadi)
- `💰 Mening hisobim` (Balans, ish haqi, avans va jarimalar tafsiloti)
- `⏱ Davomatim` (So'nggi kunlar davomati)
- `💸 Avans so'rash` (Rahbarga so'rov yuborish)

---

## 👨‍💼 Client (Mijoz) Menyu Bo'limlari:
- `📦 Mening buyurtmalarim` (Olingan pochkalar, to'langan summa va qarz)
- `✉️ Sex rahbariga yozish` (Mijoz to'g'ridan-to'g'ri rahbar bilan botda gaplashadi)
- `📞 Aloqa` (Korxona aloqa ma'lumotlari)

---

## 🚀 Render.com da 1-Klik orqali Deploy qilish

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AbdulhodiyOmonboyev/bs-shoes-bot)

### Renderda sozlash qadamlari:
1. GitHub-da [https://github.com/new](https://github.com/new) sahifasiga kiring va `bs-shoes-bot` nomli repository yarating.
2. Terminalda quyidagi buyruqni bering:
   ```bash
   git push -u origin main
   ```
3. [Render.com](https://render.com) saytiga kiring.
4. **"New +"** -> **"Web Service"** tugmasini bosing va `bs-shoes-bot` reposini tanlang.
5. Quyidagi parametrlarni tekshiring:
   - **Name:** `bs-shoes-bot`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
6. **Environment Variables** (Muhit o'zgaruvchilari) bo'limida qo'shing:
   - `BOT_TOKEN`: `8803645082:AAHrga4_UtoVJDz3fQY_j6PmGjKS8MW791U`
   - `NODE_ENV`: `production`
7. **"Deploy Web Service"** tugmasini bosing! Bot 24/7 rejimda uzluksiz ishlaydi.

---

## 💻 Kompyuterda lokal ishga tushirish:
1. Windows-da [`run.bat`](run.bat) faylini ikki marta bosing.
2. Yoki terminalda:
   ```bash
   npm start
   ```
