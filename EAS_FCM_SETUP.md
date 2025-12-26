# 🔥 EAS FCM Credentials Kurulumu

## Adımlar

### 1. Service Account JSON Key İndirin

Firebase Console > Project Settings > **Service accounts** sekmesinden JSON key indirin.

### 2. EAS Credentials'a Yükleyin

Terminal'de:
```bash
eas credentials
```

Menüden:
1. `Android` seçin
2. `Push Notifications` seçin
3. Eğer "Set up FCM Server Key" seçeneği varsa:
   - Service Account JSON dosyasını açın
   - İçindeki değerleri kullanın (genellikle JSON dosyasını direkt yükleyemezsiniz)
   
4. Alternatif: EAS artık JSON key'i kabul ediyor olabilir. JSON dosyasının yolunu girebilirsiniz.

### 3. Alternatif: google-services.json Yeterli Olabilir

Expo SDK 54'te `google-services.json` dosyası yeterli olmalı. Eğer hala çalışmıyorsa, build log'larını kontrol edin.

### 4. Yeni Build Alın

```bash
eas build --profile preview --platform android
```

## Not

Eğer EAS credentials menüsünde "FCM Server Key" yerine "FCM Credentials" veya benzer bir seçenek varsa, Service Account JSON dosyasını oraya yükleyin.





