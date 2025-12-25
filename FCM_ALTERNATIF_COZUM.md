# 🔥 FCM Credentials Alternatif Çözüm

## Problem
Legacy API sayfası yüklenmiyor. Server Key'e erişemiyoruz.

## Çözüm 1: EAS Credentials ile google-services.json Yükleme

Expo SDK 54'te, EAS Build `google-services.json` dosyasını otomatik olarak kullanır. Ama bazen FCM Server Key'e de ihtiyaç olabilir.

### Adımlar:

1. **Terminal'de EAS credentials'ı açın:**
   ```bash
   eas credentials
   ```

2. Menüden şunları seçin:
   - `Android` seçin
   - `Push Notifications` seçin
   - `Set up FCM Server Key` seçin
   - **Boş bırakın veya "Skip" deyin** (eğer sunucu key yoksa)

3. Veya direkt komutla:
   ```bash
   eas build:configure
   ```

## Çözüm 2: Legacy API'yi Farklı Yoldan Etkinleştirme

### Yöntem A: Google Cloud Console'dan API'leri Listele

1. Google Cloud Console'da (console.cloud.google.com)
2. Sol menüden **"APIs & Services"** > **"Enabled APIs & services"** seçin
3. Üstte **"+ ENABLE APIS AND SERVICES"** butonuna tıklayın
4. Arama kutusuna **"Cloud Messaging"** yazın
5. **"Cloud Messaging API (Legacy)"** bulun ve **"Enable"** tıklayın

### Yöntem B: Firebase Console'dan

1. Firebase Console'a dönün
2. **Project settings** (⚙️) > **Cloud Messaging** sekmesine gidin
3. **"Cloud Messaging API (Legacy)"** bölümünde:
   - Sayfanın kaynak kodunu görüntüleyin (F12 > Elements)
   - Veya direkt şu URL'yi deneyin:
     ```
     https://console.cloud.google.com/apis/library/googlecloudmessaging.googleapis.com?project=knightrehber-c880d
     ```

## Çözüm 3: Expo'nun Otomatik Credentials Yönetimi

Eğer Legacy API etkinleştirilemezse, Expo'nun otomatik credentials yönetimini kullanabiliriz:

1. Yeni bir build alın:
   ```bash
   eas build --profile preview --platform android
   ```

2. Build sırasında EAS otomatik olarak FCM credentials'ı yapılandırmayı dener

3. Build log'larında FCM credentials ile ilgili bir uyarı veya hata görürseniz, oradan bilgi alabilirsiniz

## Öneri

Önce **Çözüm 2 - Yöntem A**'yı deneyin (Google Cloud Console'dan "Enable APIs" butonu ile). Bu en kolay yol.

