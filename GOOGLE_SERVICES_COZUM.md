# ✅ Google Services JSON Dosyası Çözümü

## Sorun
Build hatası: `File google-services.json is missing.`

Google Services Gradle plugin'i dosyayı şu konumlarda arıyor:
- `android/app/src/release/google-services.json`
- `android/app/src/google-services.json`
- `android/app/google-services.json` ✅ (burada olmalı)

## Çözüm
`google-services.json` dosyası `android/app/` klasörüne kopyalandı.

## Not
Android klasörü mevcut olduğu için Expo config plugin çalışmıyor, bu yüzden dosya manuel olarak kopyalandı.

## Sonraki Adım
Yeni build alın:
```bash
eas build --profile preview --platform android --clear-cache
```





