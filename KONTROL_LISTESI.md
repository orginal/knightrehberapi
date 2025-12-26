# ✅ Firebase Push Notification Kontrol Listesi

## Yapılan Düzeltmeler

### 1. ✅ android/build.gradle
- Google Services classpath eklendi: `classpath('com.google.gms:google-services:4.4.2')`
- ✅ Doğru yerde (dependencies bloğu içinde)

### 2. ✅ android/app/build.gradle
- Plugin apply edildi: `apply plugin: "com.google.gms.google-services"`
- ✅ Doğru yerde (diğer plugin'lerle birlikte)

### 3. ✅ app.json
- `googleServicesFile: "./google-services.json"` mevcut
- `useNextNotificationsApi` kaldırıldı (artık desteklenmiyor)
- `versionCode: 4`

### 4. ✅ google-services.json
- Dosya proje root'unda mevcut
- Package name: `com.knightrehber.app` ✅

### 5. ✅ EAS Credentials
- FCM V1 Service Account JSON key yüklendi ✅

### 6. ✅ expo-notifications
- Versiyon: 0.32.15 (güncel) ✅

## ⚠️ Dikkat Edilmesi Gerekenler

### Expo Config Plugin vs Manuel Gradle
- Android klasörü mevcut olduğu için Expo config plugin'leri çalışmıyor
- Manuel Gradle değişiklikleri yapıldı ✅
- Build sırasında Expo prebuild atlanacak (zaten android klasörü var)

### google-services.json Konumu
- Şu an: Proje root'unda (`./google-services.json`)
- Expo config plugin normalde bunu `android/app/` klasörüne kopyalar
- Ama android klasörü mevcut olduğu için plugin çalışmıyor
- Manuel olarak dosyayı kopyalamak gerekebilir VEYA
- Expo config plugin'inin çalışması için android klasörünü silmek gerekebilir

## 🔍 Kontrol Edilecekler (Build Sonrası)

1. Build log'larında `google-services.json` ile ilgili referans var mı?
2. Firebase initialization hatası devam ediyor mu?
3. Push token alınabiliyor mu?

## 📝 Öneri

Eğer hala çalışmazsa, `google-services.json` dosyasını manuel olarak `android/app/` klasörüne kopyalamayı deneyin.





