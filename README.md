# ❖ YTÜ BKFK | Kulüp Odası Canlı Durum Portalı

**Yıldız Teknik Üniversitesi Bilim Kurgu ve Fantastik Kurgu Kulübü (YTÜ BKFK)** kulüp odasının açık/kapalı durumunu ve anlık doluluk bilgisini gösteren, sade ve heraldik fantastik temalı canlı durum sayfası.

🔗 **Canlı Site:** [ytu-bkfk-oda-durumu.onrender.com](https://ytu-bkfk-oda-durumu.onrender.com)

---

## ✨ Özellikler

- **❖ Canlı Oda Durumu (SSE):** Oda açıldığında, kapandığında veya doluluk değiştiğinde sayfa yenilenmesine gerek kalmadan tüm ziyaretçilerde anında güncellenir.
- **🏰 Sade & Fantastik Tasarım:** Vektörel BKFK rünik logosu, *Cinzel* & *Inter* tipografisi, sıcak obsidyen arka plan ve heraldik renk paleti.
- **📲 Mobil Uygulama (PWA) Desteği:** Hem Android hem iOS cihazlarda *"Uygulamayı Telefona Yükle"* / *"Ana Ekrana Ekle"* ile tam ekran mobil uygulama olarak çalışır.
- **📍 Hızlı Konum Bağlantısı:** Tek dokunuşla Google Haritalar üzerinden *YTÜ Kulüpler Vadisi* konumunu açar.
- **◫ Çift Görünüm Modu:** Tam sayfa görünümü ile pencere (kart) görünümü arasında geçiş yapabilme.
- **🛡️ Güvenli YK Yönetim Paneli:**
  - Sadece YK üyelerine özel yönetim adresinde açılır; ana sayfada yönetim arayüzü görünmez.
  - Kriptografik oturum çerezi (cookie) sayesinde YK üyeleri bir kez giriş yaptıktan sonra 1 yıl boyunca şifre sormadan doğrudan işlem yapabilir.
  - Brute-force koruması (Rate Limiting) ve CORS güvenlik katmanları içerir.

---

## 🛠️ Kurulum & Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Ortam Değişkenleri (`.env`)
`.env.example` dosyasını `.env` olarak kopyalayıp kendi ayarlarınızı girin:
```env
PORT=3000
ADMIN_PIN=GIZLI_PIN_KODUNUZ
CLUB_NAME=YTÜ BKFK
CLUB_FULL_NAME=Yıldız Teknik Üniversitesi Bilim Kurgu ve Fantastik Kurgu Kulübü
ROOM_LOCATION=Davutpaşa Kampüsü, Kulüpler Vadisi
```

### 3. Sunucuyu Başlatın
```bash
npm start
```
Tarayıcıda açın: **`http://localhost:3000`**

---

## 📁 Proje Yapısı

```text
├── data/
│   └── status.json            # Kalıcı oda durumu verisi
├── public/
│   ├── css/style.css          # Heraldik fantastik tema ve mobil uyumlu stiller
│   ├── icons/                 # Vektörel SVG logo ve PWA uygulama ikonları
│   ├── js/app.js              # SSE canlı bağlantı, PWA ve YK panel mantığı
│   ├── index.html             # Ana uygulama sayfası
│   ├── manifest.webmanifest   # PWA kurulum manifestosu
│   └── sw.js                  # PWA Service Worker
├── server.js                  # Express + SSE + Rate Limit + Cookie Auth sunucusu
└── package.json
```
