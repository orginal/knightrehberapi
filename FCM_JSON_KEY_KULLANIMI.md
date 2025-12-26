# 🔥 FCM Service Account JSON Key Kullanımı

## Durum
Service Account JSON key dosyası indirildi: `knightrehber-c880d-firebase-adminsdk-fbsvc-33ad96bcd8.json`

## ⚠️ Önemli Not

**Expo SDK 54'te, Service Account JSON key dosyasını doğrudan EAS credentials'a yükleyemezsiniz.**

Expo, FCM için **Server Key** bekliyor. Ancak V1 API'de Server Key yok.

## ✅ Çözüm Seçenekleri

### Seçenek 1: google-services.json ile Deneme (Önerilen)

Expo SDK 54'te `google-services.json` dosyası yeterli olmalı. Yeni bir build alıp test edin:

```bash
eas build --profile preview --platform android
```

Eğer hala çalışmazsa, Seçenek 2'yi deneyin.

### Seçenek 2: EAS Credentials'da FCM Credentials Kontrolü

1. Terminal'de:
   ```bash
   eas credentials
   ```

2. Menüden:
   - `Android` seçin
   - `Push Notifications` seçin
   - Ne görüyorsunuz kontrol edin:
     - "Set up FCM Server Key" varsa → JSON key'i kullanmayı deneyin
     - "FCM Credentials" veya benzer bir seçenek varsa → JSON key'i oraya yüklemeyi deneyin
     - Hiçbir şey yoksa → Expo otomatik olarak `google-services.json` kullanıyor olabilir

### Seçenek 3: JSON Key'den Server Key Çıkarma (İleri Seviye)

Service Account JSON dosyasından Server Key çıkaramazsınız. Ancak, Expo'nun yeni versiyonlarında JSON key'i kabul edebilir.

## 📝 Güvenlik Notu

- JSON key dosyası **ASLA** GitHub'a commit edilmemeli
- `.gitignore` dosyasına eklendi: `*firebase-adminsdk*.json`
- Bu dosyayı güvenli bir yerde saklayın

## 🔍 Sonraki Adımlar

1. Önce **Seçenek 1**'i deneyin: Yeni build alın
2. Eğer çalışmazsa, `eas credentials` komutunu çalıştırıp ne göründüğünü kontrol edin
3. Build log'larını kontrol edin: Firebase başlatılıyor mu?





