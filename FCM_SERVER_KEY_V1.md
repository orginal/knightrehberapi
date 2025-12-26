# 🔥 FCM Server Key Alma (V1 API ile)

## Durum
Legacy API kapatılmış, ama V1 API kullanarak da FCM Server Key alabiliriz.

## ✅ Çözüm: Google Cloud Console'dan Service Account Key

### Yöntem 1: Firebase Console'dan (Basit)

1. **Firebase Console'a gidin:**
   - https://console.firebase.google.com/
   - "KnightRehber" projesini açın

2. **Cloud Messaging sekmesine gidin:**
   - Sol üstte ⚙️ > **"Project settings"**
   - **"Cloud Messaging"** sekmesine tıklayın

3. **"Cloud Messaging API (V1)" kontrol edin:**
   - Eğer "Enabled" ise, bir "Server key" veya "Cloud Messaging API (V1)" için credential olabilir
   - Eğer yoksa, Yöntem 2'yi deneyin

### Yöntem 2: Google Cloud Console'dan (Kesin Çözüm)

1. **Google Cloud Console'a gidin:**
   - https://console.cloud.google.com/
   - Üstteki proje seçiciden **"KnightRehber"** veya **"knightrehber-c880d"** projesini seçin

2. **Service Account Oluşturun:**
   - Sol menüden **"IAM & Admin"** > **"Service Accounts"** seçin
   - **"+ CREATE SERVICE ACCOUNT"** butonuna tıklayın
   - **Service account name:** `expo-fcm` (veya istediğiniz bir isim)
   - **"Create and Continue"** tıklayın
   - **Role:** `Firebase Cloud Messaging Admin` veya `Firebase Cloud Messaging API Admin` seçin
   - **"Continue"** > **"Done"** tıklayın

3. **Service Account Key Oluşturun:**
   - Oluşturduğunuz service account'a tıklayın
   - **"Keys"** sekmesine gidin
   - **"ADD KEY"** > **"Create new key"** tıklayın
   - **Key type:** `JSON` seçin
   - **"Create"** tıklayın
   - JSON dosyası indirilecek

4. **JSON'dan Server Key Çıkartma (Alternatif):**
   Service Account JSON key, Expo'nun beklediği format değil. **Daha basit yol:**

### Yöntem 3: Firebase Console'dan Cloud Messaging API Key (Önerilen)

1. **Firebase Console:**
   - https://console.firebase.google.com/
   - "KnightRehber" projesini açın

2. **Project Settings:**
   - ⚙️ > **"Project settings"**
   - **"Service accounts"** sekmesine gidin

3. **Generate new private key:**
   - **"Generate new private key"** butonuna tıklayın
   - Uyarıyı kabul edin ve **"Generate key"** tıklayın
   - JSON dosyası indirilecek

4. **Bu JSON'u Expo'ya yüklemek için:**
   - **EAS credentials** artık JSON key kabul ediyor olabilir
   - Veya sadece `google-services.json` yeterli olabilir (test edelim)

### Yöntem 4: EAS Credentials ile Otomatik (En Kolay - Önerilen)

Expo'nun yeni versiyonlarında, `google-services.json` dosyası yeterli olabilir:

1. **Terminal'de:**
   ```bash
   eas credentials
   ```

2. Menüden:
   - `Android` seçin
   - `Push Notifications` seçin
   - **"Use google-services.json"** veya benzer bir seçenek olabilir

3. Eğer Server Key istenirse:
   - Firebase Console > Project Settings > Cloud Messaging
   - Orada bir "Server key" veya "API key" olup olmadığını kontrol edin

## 🔍 Firebase Console'da Kontrol

1. Firebase Console > Project Settings > Cloud Messaging
2. Şunları kontrol edin:
   - **"Cloud Messaging API (V1)"** durumu (Enabled olmalı)
   - **"Server key"** alanı var mı?
   - Veya **"API Key"** alanı var mı?

Eğer hiçbiri yoksa, Google Cloud Console'dan Service Account oluşturmak gerekebilir.

## 📝 Not

Expo SDK 54'te, `google-services.json` dosyası build sırasında otomatik olarak Firebase'i başlatmalı. Eğer hala "FirebaseApp is not initialized" hatası alıyorsanız, build sırasında bir sorun olabilir.

Yeni bir build alıp tekrar deneyin:
```bash
eas build --profile preview --platform android
```





