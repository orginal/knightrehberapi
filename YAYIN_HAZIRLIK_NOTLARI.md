# 🚀 Store Yayın Hazırlık Notları

## ✅ Tamamlanan İşlemler

1. ✅ **Privacy Policy** hazırlandı (`PRIVACY_POLICY.md`)
   - Türkçe ve İngilizce versiyonlar mevcut
   - GDPR uyumlu
   - Tüm gerekli bölümler içeriliyor

2. ✅ **App Açıklamaları** hazırlandı (`APP_ACIKLAMALARI.md`)
   - Google Play Store için TR + EN açıklamalar
   - Apple App Store için TR + EN açıklamalar
   - Kısa açıklamalar, uzun açıklamalar, keywords hazır

3. ✅ **Settings'e Privacy Policy Linki** eklendi
   - Settings > Ayarlar sekmesinde "🔒 Gizlilik Politikası" butonu eklendi

---

## ⚠️ YAPILMASI GEREKENLER

### 1. Privacy Policy URL'sini Güncelleme

**App.js dosyasında (satır ~886) GitHub URL'sini kendi repository'nizle değiştirin:**

```javascript
// ŞU ANKİ HALİ:
Linking.openURL('https://github.com/yourusername/knightrehber/blob/main/PRIVACY_POLICY.md')

// GÜNCELLENMİŞ HALİ (kendi GitHub repo'nuzla):
Linking.openURL('https://github.com/GERÇEK_KULLANICI_ADI/KnightrehberYeni2/blob/main/PRIVACY_POLICY.md')
```

**VEYA** Privacy Policy'yi bir web sitesine yükleyip URL'yi oraya yönlendirin.

---

### 2. Privacy Policy'yi Yayınlama

Privacy Policy'yi erişilebilir bir yerde yayınlamalısınız:

**Seçenek 1: GitHub (Önerilen)**
- `PRIVACY_POLICY.md` dosyasını GitHub repo'nuzda yayınlayın
- Raw GitHub linki kullanın: `https://raw.githubusercontent.com/username/repo/main/PRIVACY_POLICY.md`

**Seçenek 2: Web Sitesi**
- Kendi web sitenize yükleyin
- URL: `https://yourdomain.com/privacy-policy`

**Seçenek 3: GitHub Pages**
- GitHub Pages ile static site oluşturun
- URL: `https://username.github.io/knightrehber/privacy-policy`

---

### 3. Store Açıklamalarını Kopyalama

`APP_ACIKLAMALARI.md` dosyasındaki açıklamaları:

- **Google Play Console** → Store listing bölümüne
- **Apple App Store Connect** → App Information bölümüne

kopyalayıp yapıştırın.

---

### 4. Privacy Policy URL'sini Store'lara Ekleme

**Google Play Console:**
1. Store listing → Privacy Policy → Privacy Policy URL ekle

**Apple App Store Connect:**
1. App Information → Privacy Policy URL ekle

---

## 📋 Store Yayın Checklist

### Google Play Store
- [ ] Google Play Developer hesabı aç ($25)
- [ ] Production build al: `eas build --platform android --profile production`
- [ ] Privacy Policy URL'sini güncelle (App.js'de ve Google Play Console'da)
- [ ] Store listing doldur (açıklamalar, screenshots, icon)
- [ ] Content rating formu doldur
- [ ] Data safety formu doldur
- [ ] Production track'e build yükle
- [ ] Review için gönder

### Apple App Store
- [ ] Apple Developer hesabı aç ($99/yıl)
- [ ] Production build al: `eas build --platform ios --profile production`
- [ ] Privacy Policy URL'sini güncelle (App.js'de ve App Store Connect'te)
- [ ] App Store listing doldur (açıklamalar, screenshots, icon)
- [ ] App review için gönder
- [ ] TestFlight'ta test et (en az 1 hafta)

---

## 🔗 Önemli Linkler

- Privacy Policy dosyası: `PRIVACY_POLICY.md`
- App açıklamaları: `APP_ACIKLAMALARI.md`
- Store kontrol listesi: `STORE_YAYIN_KONTROL_LISTESI.md`

---

## 💡 İpuçları

1. **Privacy Policy URL'si mutlaka erişilebilir olmalı** - Store'lar linki kontrol eder
2. **Açıklamaları hem TR hem EN yazın** - Daha geniş kitleye ulaşır
3. **Screenshots hazırlarken** farklı cihaz boyutlarını kullanın
4. **Content rating** formunu dikkatli doldurun - Yanlış bilgi reddedilme sebebi olabilir

---

## 🎯 Sonraki Adımlar

1. GitHub URL'sini güncelle (App.js satır ~886)
2. Privacy Policy'yi GitHub'a push et
3. Store açıklamalarını kopyala
4. Production build al
5. Store'lara yükle!

Başarılar! 🚀

