# 🔥 Firebase Cloud Messaging (FCM) Credentials Kurulumu

## Sorun
Standalone APK'larda push notification çalışmıyor çünkü Firebase Cloud Messaging (FCM) credentials eksik.

**Hata:**
```
Error: Default FirebaseApp is not initialized in this process com.knightrehber.app. 
Make sure to call FirebaseApp.initializeApp(Context) first.
```

## ✅ Çözüm Adımları

### 1. Firebase Console'da Proje Oluşturun

1. https://console.firebase.google.com/ adresine gidin
2. "Add project" (Proje Ekle) butonuna tıklayın
3. Proje adı: `Knight Rehber` (veya istediğiniz bir isim)
4. Google Analytics'i açık bırakın (opsiyonel)
5. "Create project" (Proje Oluştur) butonuna tıklayın

### 2. Android App Ekleyin

1. Firebase Console'da projenizi açın
2. Sol menüden "Project settings" (⚙️) > "Your apps" sekmesine gidin
3. Android ikonuna (🤖) tıklayın
4. **Android package name:** `com.knightrehber.app` (app.json'daki package ile aynı olmalı)
5. **App nickname (optional):** `Knight Rehber`
6. **Debug signing certificate SHA-1:** (opsiyonel, şimdilik boş bırakabilirsiniz)
7. "Register app" butonuna tıklayın

### 3. google-services.json Dosyasını İndirin

1. Firebase Console'da "Download google-services.json" butonuna tıklayın
2. Dosyayı bilgisayarınıza indirin
3. **ÖNEMLİ:** Bu dosyayı projenizin **kök dizinine** (`KnightrehberYeni2/` klasörüne) kopyalayın

### 4. app.json'a google-services.json Ekleyin

`app.json` dosyasına şunu ekleyin:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json"
    }
  }
}
```

### 5. FCM Server Key'i EAS'a Yükleyin

1. Firebase Console'da:
   - "Project settings" (⚙️) > "Cloud Messaging" sekmesine gidin
   - **"Server key"** (Sunucu anahtarı) değerini kopyalayın

2. Terminal'de şu komutu çalıştırın:
   ```bash
   eas credentials
   ```
   
3. Menüden:
   - `Android` seçin
   - `Push Notifications` seçin
   - `Set up FCM Server Key` seçin
   - Server key'i yapıştırın

**VEYA** direkt komutla:
```bash
eas credentials
```
Sonra interaktif menüden FCM Server Key'i ekleyin.

### 6. Yeni APK Build Alın

```bash
eas build --profile preview --platform android
```

## ✅ Kontrol

Build tamamlandıktan sonra:
1. APK'yı kurun
2. Uygulamayı açın
3. Vercel log'larında `/api/push/register` POST isteği görünmeli
4. MongoDB token sayısı artmalı
5. Bildirim gönderildiğinde APK'ya gelmeli

## 📝 Notlar

- `google-services.json` dosyasını **ASLA** GitHub'a commit etmeyin (güvenlik riski)
- `.gitignore` dosyasına `google-services.json` ekleyin
- FCM Server Key'i de **ASLA** kod içine yazmayın, sadece EAS credentials'a ekleyin

## 🔗 Referanslar

- Expo FCM Setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Firebase Console: https://console.firebase.google.com/





