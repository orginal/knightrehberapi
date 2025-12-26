# 🔥 FCM V1 API - Server Key Yerine Service Account JSON

## Durum
Firebase Console'da "Server key" görünmüyor çünkü V1 API kullanılıyor. V1 API'de Server Key yerine **Service Account JSON key** kullanılır.

## ✅ Çözüm: Service Account JSON Key

### Adım 1: Service Accounts Sekmesine Gidin

1. Firebase Console'da **"Service accounts"** sekmesine tıklayın (Cloud Messaging'in yanında)
2. Veya doğrudan: Firebase Console > Project Settings > **"Service accounts"** sekmesi

### Adım 2: Service Account Key Oluşturun

1. **"Generate new private key"** butonuna tıklayın
2. Açılan popup'ta **"Generate key"** butonuna tıklayın
3. JSON dosyası otomatik olarak indirilecek (örn: `knightrehber-c880d-xxxxx.json`)

### Adım 3: EAS Credentials'a JSON Key'i Yükleyin

**Önemli:** Expo SDK 54'te, JSON key doğrudan yüklenemeyebilir. Bunun yerine:

#### Yöntem A: google-services.json ile Deneme (Önerilen)

`google-services.json` dosyası zaten mevcut. Expo SDK 54'te bu yeterli olmalı. Yeni bir build alın:

```bash
eas build --profile preview --platform android
```

#### Yöntem B: Service Account JSON'dan Server Key Çıkarma

Service Account JSON dosyasını açın ve şu alanları bulun:
- `private_key`
- `client_email`

Ancak Expo, JSON dosyasını doğrudan kabul etmeyebilir.

### Adım 4: Alternatif - Expo Plugin Kontrolü

`app.json`'da `expo-notifications` plugin'i var mı kontrol edin. Zaten var görünüyor.

## 🔍 Sorun Tespiti

Hata mesajı: `Default FirebaseApp is not initialized`

Bu, `google-services.json` dosyasının build'e dahil edilmediğini gösteriyor. Kontrol edin:

1. `google-services.json` dosyası proje root'unda mı? (`KnightrehberYeni2/google-services.json`)
2. `app.json`'da `"googleServicesFile": "./google-services.json"` var mı? (Zaten var)
3. Build log'larında `google-services.json` ile ilgili bir hata var mı?

## 📝 Öneri

Önce **Yöntem A**'yı deneyin: Yeni bir build alın ve test edin. Eğer hala çalışmazsa, Service Account JSON'u EAS'a yüklemeyi deneyin.





