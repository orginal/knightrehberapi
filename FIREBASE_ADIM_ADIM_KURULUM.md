# 🔥 Firebase Android App Kurulumu - Adım Adım

## 1️⃣ Android App Ekleme

1. Firebase Console'da mavi **"+ Add app"** butonuna tıklayın
2. Açılan pencerede **Android ikonuna** (🤖) tıklayın

## 2️⃣ Android Package Name Girme

Açılan formda:

- **Android package name:** 
  ```
  com.knightrehber.app
  ```
  (Bu değer `app.json` dosyasındaki `android.package` ile TAMAMEN AYNI olmalı)

- **App nickname (optional):** 
  ```
  Knight Rehber
  ```
  (İstediğiniz bir isim, opsiyonel)

- **Debug signing certificate SHA-1:** 
  (Şimdilik boş bırakabilirsiniz - opsiyonel)

3. **"Register app"** butonuna tıklayın

## 3️⃣ google-services.json Dosyasını İndirme

1. Sayfada **"Download google-services.json"** butonunu göreceksiniz
2. Bu butona tıklayın
3. Dosya otomatik olarak indirilecek (genellikle Downloads klasörüne)
4. **ÖNEMLİ:** Bu dosyayı kopyalayıp `KnightrehberYeni2` klasörünün **içine** (projenizin kök dizinine) yapıştırın

## 4️⃣ FCM Server Key Alma

1. Firebase Console'da sol menüden **⚙️ Project settings** (Proje ayarları) tıklayın
2. **"Cloud Messaging"** sekmesine gidin
3. **"Server key"** (Sunucu anahtarı) değerini görünce **kopyalayın** (sağ tık > Copy)
   - Bu key uzun bir string'dir, örneğin: `AAAAxxxxxxx:APA91bH...` gibi

## 5️⃣ FCM Server Key'i EAS'a Yükleme

Terminal'de (KnightrehberYeni2 klasöründe) şu komutu çalıştırın:

```bash
eas credentials
```

Menüde şunları seçin:
1. `Android` seçin (klavyede ok tuşları + Enter)
2. `Push Notifications` seçin
3. `Set up FCM Server Key` seçin
4. Kopyaladığınız Server key'i yapıştırın (Ctrl+V)
5. Enter'a basın

## 6️⃣ Yeni APK Build Alma

FCM credentials eklendikten sonra:

```bash
eas build --profile preview --platform android
```

## ✅ Kontrol Listesi

- [ ] Firebase Console'da Android app eklendi
- [ ] `google-services.json` dosyası `KnightrehberYeni2/` klasörüne kopyalandı
- [ ] FCM Server Key EAS credentials'a eklendi
- [ ] Yeni APK build alındı
- [ ] APK kuruldu ve test edildi
- [ ] Vercel log'larında `/api/push/register` POST isteği görünüyor
- [ ] MongoDB token sayısı artıyor
- [ ] Bildirim gönderildiğinde APK'ya geliyor

## 🆘 Sorun Giderme

### google-services.json dosyası bulunamıyor hatası
- Dosyanın `KnightrehberYeni2/` klasöründe (proje kök dizininde) olduğundan emin olun
- Dosya adının tam olarak `google-services.json` olduğundan emin olun

### FCM Server Key bulunamıyorum
- Firebase Console > Project settings > Cloud Messaging sekmesine gidin
- Eğer "Cloud Messaging API (Legacy)" aktif değilse, aktif edin
- Server key görünmüyorsa, "Cloud Messaging API (Legacy)"'yi etkinleştirmeniz gerekebilir

### Build hatası alıyorum
- `google-services.json` dosyasının doğru konumda olduğundan emin olun
- Package name'in (`com.knightrehber.app`) Firebase'deki ile aynı olduğundan emin olun





