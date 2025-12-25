# 🔥 Cloud Messaging API (Legacy) Etkinleştirme

## Yöntem 1: Direkt Google Cloud Console Link

1. Bu linke tıklayın (projeniz için):
   ```
   https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=knightrehber-c880d
   ```

2. Sayfa açıldığında **"Enable"** (Etkinleştir) butonuna tıklayın

## Yöntem 2: Google Cloud Console'dan Manuel

1. https://console.cloud.google.com/ adresine gidin
2. Üstteki proje seçiciden **"knightrehber-c880d"** projesini seçin
3. Sol menüden **"APIs & Services"** > **"Library"** seçin
4. Arama kutusuna şunu yazın: **"Firebase Cloud Messaging API"**
5. **"Firebase Cloud Messaging API (Legacy)"** seçeneğini bulun
6. **"Enable"** (Etkinleştir) butonuna tıklayın

## Yöntem 3: Firebase Console'dan

1. Firebase Console'a geri dönün
2. **Project settings** (⚙️) > **Cloud Messaging** sekmesine gidin
3. **"Cloud Messaging API (Legacy)"** bölümünde:
   - Üç nokta (⋮) menüsüne tıklayın
   - **"Manage API in Google Cloud Console"** seçin
   - Açılan sayfada **"Enable"** butonuna tıklayın

## Server Key'i Alma

Legacy API etkinleştirildikten sonra:

1. Firebase Console'a geri dönün
2. **Project settings** (⚙️) > **Cloud Messaging** sekmesine gidin
3. Sayfayı yenileyin (F5)
4. **"Cloud Messaging API (Legacy)"** bölümünde **"Server key"** görünecek
5. Server key'i kopyalayın

## EAS Credentials'a Ekleme

Terminal'de:
```bash
eas credentials
```

Menüde:
1. `Android` seçin
2. `Push Notifications` seçin  
3. `Set up FCM Server Key` seçin
4. Server key'i yapıştırın

