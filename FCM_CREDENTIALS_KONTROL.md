# FCM Credentials Kontrol Raporu

## ✅ Dosya Kontrolleri

### 1. google-services.json
- ✅ **Konum:** `./google-services.json` (root)
- ✅ **Konum:** `./android/app/google-services.json` (build için)
- ✅ **Package Name:** `com.knightrehber.app` (doğru)
- ✅ **Project ID:** `knightrehber-c880d`
- ✅ **Project Number:** `16418022198`

### 2. app.json
- ✅ **googleServicesFile:** `"./google-services.json"` (doğru)
- ✅ **package:** `"com.knightrehber.app"` (doğru)
- ✅ **projectId:** `"01db3b91-a023-4742-a675-e40753963569"` (ceylan26 hesabı)
- ✅ **owner:** `"ceylan26"` (doğru)

### 3. Android Gradle Konfigürasyonu
- ✅ **android/build.gradle:**
  - Google Services classpath: `classpath('com.google.gms:google-services:4.4.2')`
  
- ✅ **android/app/build.gradle:**
  - Google Services plugin: `apply plugin: "com.google.gms.google-services"`

## ⚠️ EAS Credentials Kontrolü Gerekli

EAS credentials'ını kontrol etmek için:

1. **Web Arayüzünden:**
   - https://expo.dev/accounts/ceylan26/projects/knight-rehber
   - Credentials → Android → FCM Server Key veya Service Account JSON

2. **Terminal'den:**
   ```bash
   eas credentials
   ```
   - Android → Push Notifications → FCM Server Key kontrolü

## 🔍 Sorun Tespiti

Expo Push API "ok" dönüyor ama bildirimler gelmiyorsa, muhtemel nedenler:

1. **FCM Server Key eksik/yanlış** (EAS credentials'da)
2. **Service Account JSON key eksik/yanlış** (EAS credentials'da)
3. **APK build'inde FCM credentials dahil edilmemiş**

## ✅ Çözüm

Yeni build alın ve test edin:
```bash
eas build --platform android --profile production
```

Build aldıktan sonra:
1. APK'yı kurun
2. Uygulamayı açın (token otomatik kaydedilecek)
3. Admin panelden test bildirimi gönderin
4. Bildirimlerin geldiğini kontrol edin





