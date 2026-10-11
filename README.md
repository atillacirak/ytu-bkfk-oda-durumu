# 🌌 YTÜ BKFK - Kulüp Odası Canlı Durum Portalı

> **Yıldız Teknik Üniversitesi Bilim Kurgu ve Fantastik Kurgu Kulübü (YTÜ BKFK)** kulüp odasının açık/kapalı durumunu ve anlık doluluk oranını gösteren, Yönetim Kurulu'nun (YK) tek tuşla durumu güncelleyebildiği, siber-büyü (Cyberpunk & Fantasy) temalı canlı one-page web uygulaması.

---

## ✨ Öne Çıkan Özellikler

1. **🚀 Temaya Uygun Görsel Deneyim (Sci-Fi & Fantasy Hybrid):**
   - **Boyut Kapısı / Stargate Görseli:** Oda açıkken zümrüt yeşili/siber camgöbeği enerji halkası döner; kapalıyken mühürlü koruyucu kalkan devreye girer.
   - **Kozmik Arka Plan:** HTML5 Canvas tabanlı, oda durumuna göre rengi dinamik değişen hafif yıldız alanı ve nebula parçacıkları.
   - **Siber & Rünik Tipografi:** Google Fonts *Orbitron* (siber/fütüristik), *Cinzel* (fantastik/rünik) ve *Inter* uyumu.
   - **Web Audio API Ses Efektleri:** Hiçbir harici MP3 dosyasına ihtiyaç duymayan, tamamen tarayıcı içinde sentezlenen portal açılma, kalkan kilitleme ve uyarı tonları (sessize alma düğmeli).

2. **⚡ Yönetim Kurulu (YK) İçin "Tek Tuşla" Hızlı Kontrol:**
   - **Tek Dokunuş Hızlı Durumlar:**
     - 🟢 *Kapıyı Açtım (Boş / Sakin)*
     - 🟡 *Oda Canlandı (Yer Var)*
     - 🔴 *Oda Doldu! (Yer Kalmadı)*
     - 🛑 *Odayı Kapattım (Çıktık)*
   - **Hızlı Aktivite Çipleri:** 🎲 Kutu Oyunu, ⚔️ FRP / D&D, ☕ Çay & Sohbet, 💻 Ders / Kodlama, 🃏 MTG, 🎬 Film.
   - **Güvenli & Pratik PIN:** Varsayılan PIN `1911`. *"Bu cihazda beni hatırla"* seçeneği sayesinde YK üyeleri her seferinde şifre yazmak zorunda kalmaz.
   - **Özel Duyuru/Not:** Örn. *"Çay demlendi, kapı aralık doğrudan gelebilirsiniz!"*

3. **📡 Gerçek Zamanlı Canlı İletim (Server-Sent Events - SSE):**
   - YK odayı açtığı veya "Dolu" olarak işaretlediği anda, sayfaya bakan tüm öğrencilerin ekranı **sayfayı yenilemeye gerek kalmadan anında güncellenir**.

4. **📱 Öğrenci & Üye Kolaylıkları:**
   - **🔔 Açılınca Haber Ver:** Tarayıcı Web Notification izni ile oda açıldığında bildirim gönderir.
   - **📤 Durumu Paylaş:** WhatsApp, Discord veya hikayelerde tek tıkla paylaşmak için hazır durum metni ve bağlantı kopyalama.
   - **🗺️ Nasıl Gidilir?:** Davutpaşa Kampüsü Kulüpler Binası / Mediko için adım adım kampüs içi yol tarifi akordiyonu.
   - **PWA Uyumlu:** Telefonda *"Ana Ekrana Ekle"* yapılarak mobil uygulama gibi tam ekran çalıştırılabilir.

---

## 🛠️ Kurulum & Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18 veya üzeri)
- npm

### 1. Depoyu İndirin ve Bağımlılıkları Yükleyin
```bash
git clone <repo-url>
cd "BKFK Oda Açık Mı"
npm install
```

### 2. Ortam Değişkenleri (.env)
`.env.example` dosyasını `.env` olarak kopyalayabilir veya düzenleyebilirsiniz:
```env
PORT=3000
ADMIN_PIN=1911
CLUB_NAME=YTÜ BKFK
CLUB_FULL_NAME=Yıldız Teknik Üniversitesi Bilim Kurgu ve Fantastik Kurgu Kulübü
ROOM_LOCATION=Davutpaşa Kampüsü, Kulüpler Binası
```
> **Önemli:** Canlıya alırken `ADMIN_PIN` değerini sadece YK'nın bildiği güvenli bir PIN ile değiştirin!

### 3. Sunucuyu Başlatın
```bash
npm start
```
Tarayıcınızda açın: **`http://localhost:3000`**

Geliştirme modunda (dosya değişikliklerinde otomatik yeniden başlatma):
```bash
npm run dev
```

---

## 🔑 YK Yönetim Paneline Erişim

1. Sağ üst köşedeki **"🛡️ YK Kontrol"** butonuna tıklayın.
2. PIN Kodunu girin (Varsayılan: `1911`).
3. *"Bu cihazda beni hatırla"* kutucuğunu işaretlerseniz sonraki girişlerinizde doğrudan hızlı kontrol paneli açılır.
4. Tek tuşla oda durumunu veya doluluk seviyesini güncelleyin!

---

## 🌐 Ücretsiz Canlıya Alma (Deployment)

### A. Vercel (Önerilen - Ücretsiz & Tek Tık)
Projede `vercel.json` ve `api/index.js` hazır tanımlıdır.
1. Projeyi GitHub'a yükleyin.
2. [Vercel](https://vercel.com)'de **New Project** diyerek repo'nuzu seçin.
3. Environment Variables kısmına:
   - `ADMIN_PIN`: (belirlediğiniz şifre)
4. **Deploy** butonuna basın. Birkaç saniyede siteniz `https://...vercel.app` olarak yayına girer!

### B. Render / Railway / Fly.io / VPS
1. `npm install` ve `npm start` komutlarıyla doğrudan Node.js servisi olarak çalıştırabilirsiniz.
2. Kalıcı durum `data/status.json` dosyasında saklanır.

---

## 🔌 API Referansı

| Metot | Uç Nokta | Açıklama | Kimlik Doğrulama |
|---|---|---|---|
| `GET` | `/api/status` | Anlık oda durumunu ve kulüp bilgilerini döndürür. | Herkese Açık |
| `GET` | `/api/events` | Server-Sent Events (SSE) gerçek zamanlı canlı yayın akışı. | Herkese Açık |
| `POST` | `/api/verify-pin` | Girilen YK PIN kodunu doğrular (`{ pin }`). | Herkese Açık |
| `POST` | `/api/status` | Oda durumunu günceller ve tüm kullanıcılara canlı yayar. | `x-admin-pin` Başlığı veya `pin` gövdesi |

---

## 🎨 Tasarım ve Lisans

- **Tasarım:** YTÜ Bilim Kurgu ve Fantastik Kurgu Kulübü ruhuna özel siber-büyü (Cyberpunk + High Fantasy) estetiği.
- **Lisans:** MIT
