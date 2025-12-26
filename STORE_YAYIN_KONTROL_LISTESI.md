# 📱 Store Yayın Kontrol Listesi

## ✅ Mevcut Durum (Kontrol Edildi)

### Google Play Store
- ✅ **EAS Build Config**: Production profile `app-bundle` kullanıyor (doğru)
- ✅ **Package Name**: `com.knightrehber.app` (benzersiz ve doğru format)
- ✅ **Version Code**: 2 (autoIncrement: true ile otomatik artacak)
- ✅ **API Endpoint**: Production URL kullanılıyor (`knightrehberapi.vercel.app`)
- ✅ **Permissions**: Gerekli izinler mevcut ve açıklanabilir
- ✅ **Push Notifications**: Expo Push Notifications yapılandırılmış

### Apple App Store
- ✅ **Bundle Identifier**: `com.knightrehber.app` (benzersiz)
- ✅ **ITSAppUsesNonExemptEncryption**: false (doğru)
- ✅ **Background Modes**: Uygun şekilde yapılandırılmış
- ⚠️ **iOS için production build**: Henüz test edilmedi

---

## ❌ Eksikler ve Yapılması Gerekenler

### 1. 🔒 Privacy Policy (ZORUNLU)
**Her iki store için zorunludur!**

**Yapılması gerekenler:**
- Privacy Policy sayfası oluşturun (web sitesi veya GitHub Pages)
- Şunları içermelidir:
  - Hangi veriler toplanıyor (push token, cihaz bilgileri)
  - Veriler nerede saklanıyor (MongoDB)
  - Üçüncü taraf servisler (Expo Push Notifications, Vercel)
  - Kullanıcı hakları
  - İletişim bilgileri

**Örnek Privacy Policy URL:**
```
https://knightrehber.com/privacy-policy
veya
https://github.com/kullanici/knightrehber/wiki/Privacy-Policy
```

### 2. 📋 Terms of Service (ÖNERİLİR)
- Kullanım şartları sayfası oluşturun
- Store'larda gerekli olabilir

### 3. 📸 Store Assets (ZORUNLU)

**Google Play için:**
- App icon (512x512 PNG)
- Feature graphic (1024x500 PNG)
- Screenshots (en az 2 adet, farklı cihaz boyutları)
- Short description (80 karakter)
- Full description (4000 karakter)

**Apple App Store için:**
- App icon (1024x1024 PNG)
- Screenshots (iPhone ve iPad için farklı boyutlar)
- App preview videos (opsiyonel ama önerilir)
- Description
- Keywords
- Promotional text

### 4. 🔑 Apple Developer Hesabı
- Apple Developer Program üyeliği gerekli ($99/yıl)
- App Store Connect hesabı oluşturun

### 5. 💳 Google Play Developer Hesabı
- Google Play Console hesabı ($25 tek seferlik ücret)
- Developer hesabı oluşturun

### 6. 📝 App Açıklamaları

**Türkçe ve İngilizce hazırlayın:**
- Kısa açıklama
- Uzun açıklama
- Anahtar kelimeler
- Kategori seçimi (Games/Entertainment)

### 7. 🔐 Signing Keys

**EAS Build otomatik yönetir, ancak:**
- Production build'ler için credentials oluşturulmalı
- `eas credentials` komutu ile yönetebilirsiniz

### 8. 🧪 Test (ÖNEMLİ)

**Google Play:**
- Internal testing track'te test edin
- Closed/Open testing track'lerde beta test yapın

**Apple:**
- TestFlight ile beta test yapın
- En az 1 hafta test edin

### 9. ⚠️ Potansiyel Sorunlar

#### a) Android Permissions Açıklaması
Bazı izinler için açıklama gerekiyor:
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`: Alarm özellikleri için gerekli
- `USE_EXACT_ALARM`: Tam zamanlı alarmlar için
- `FOREGROUND_SERVICE`: Arka plan servisleri için

**Çözüm**: Google Play Console'da "Data safety" bölümünde açıklamalar ekleyin.

#### b) Privacy Policy Link
- App içinde privacy policy linki olmalı (Settings'te gösterilebilir)
- Store'larda zorunlu olarak istenecek

#### c) Content Rating
- Her iki store için content rating formu doldurulmalı
- ESRB (Google) ve App Store rating (Apple)

---

## 📋 Store Yayın Adımları

### Google Play Store

1. **Build Al:**
   ```bash
   eas build --platform android --profile production
   ```

2. **Google Play Console:**
   - Yeni uygulama oluştur
   - Production track'e build yükle
   - Store listing doldur
   - Privacy policy URL ekle
   - Screenshots ve açıklamalar ekle
   - Content rating doldur
   - Data safety formu doldur
   - Review için gönder

3. **İnceleme Süresi:** Genellikle 1-3 gün

### Apple App Store

1. **Build Al:**
   ```bash
   eas build --platform ios --profile production
   ```

2. **App Store Connect:**
   - Yeni uygulama oluştur
   - Bundle ID'yi eşleştir
   - Build'i TestFlight'a yükle
   - Test edin (en az 1 hafta)
   - Store listing doldur
   - Privacy policy URL ekle
   - Screenshots ve açıklamalar ekle
   - App review için gönder

3. **İnceleme Süresi:** Genellikle 1-7 gün

---

## ✅ Önerilen Öncelik Sırası

1. **Hemen Yapılmalı:**
   - [ ] Privacy Policy sayfası oluştur
   - [ ] App icon'ları hazırla (512x512, 1024x1024)
   - [ ] Screenshots çek

2. **Store Hesapları:**
   - [ ] Google Play Developer hesabı aç ($25)
   - [ ] Apple Developer hesabı aç ($99/yıl)

3. **Build ve Test:**
   - [ ] Production build al (Android)
   - [ ] Internal testing yap
   - [ ] Production build al (iOS)
   - [ ] TestFlight ile test yap

4. **Store Listing:**
   - [ ] Açıklamalar yaz (TR + EN)
   - [ ] Screenshots yükle
   - [ ] Privacy policy linki ekle
   - [ ] Content rating doldur

5. **Yayın:**
   - [ ] Google Play'e gönder
   - [ ] Apple App Store'a gönder

---

## 🔍 Kod İncelemesi Sonucu

### ✅ İyi Olan Şeyler
- Production API URL kullanılıyor
- Bundle identifier'lar doğru format
- Permissions makul ve gerekli
- EAS Build yapılandırması doğru

### ⚠️ Dikkat Edilmesi Gerekenler
- Privacy Policy linki app içinde yok (Settings'e eklenebilir)
- Hardcoded email adresi var (sorun değil ama belirtilmeli)
- Console.log'lar production build'de temizlenebilir (opsiyonel)

### 🔧 İsteğe Bağlı İyileştirmeler
- App içinde "Privacy Policy" ve "Terms of Service" linkleri eklenebilir
- Error handling iyileştirilebilir
- Analytics eklenebilir (Firebase, etc.)

---

## 💡 Sonuç

**Uygulamanız store'lara yayınlanmaya HAZIR!** 

Ancak önce:
1. Privacy Policy oluşturmalısınız (ZORUNLU)
2. Store hesaplarını açmalısınız
3. Store assets hazırlamalısınız (icon, screenshots, açıklamalar)
4. Test build'leri alıp test etmelisiniz

Herhangi bir teknik engel görünmüyor! 🎉





