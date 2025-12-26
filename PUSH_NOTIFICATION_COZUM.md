# 🔔 Push Notification Çözüm Notları

## Önemli Bilgi: Legacy API Gereksiz!

**Legacy Cloud Messaging API kapatılmış olabilir, ama sorun değil!**

Expo SDK 54'te standalone APK'larda push notification için:
- ✅ Expo Push Notification servisi kullanılır (`https://exp.host/--/api/v2/push/send`)
- ✅ FCM Server Key'e **ihtiyaç yoktur**
- ✅ Expo kendi credential'larını kullanır
- ✅ `google-services.json` dosyası yeterlidir (zaten mevcut)

## Yapılan Düzeltmeler

1. **App.js'de projectId:** Artık `Constants.expoConfig.extra.eas.projectId`'den otomatik alınıyor
2. **google-services.json:** Proje root'unda mevcut ve `app.json`'da tanımlı
3. **ExperienceId:** `@ceylan26/knight-rehber` olarak ayarlandı

## Test Adımları

1. **Yeni Build Al:**
   ```bash
   eas build --profile preview --platform android
   ```

2. **APK'yı Telefona Kur**

3. **Log'ları Kontrol Et:**
   - Uygulama açıldığında push token alınıyor mu?
   - Token backend'e kaydediliyor mu?
   - `https://knightrehberapi.vercel.app/api/admin/mongo-status` sayfasından token sayısını kontrol et

4. **Bildirim Gönder:**
   - Admin panelden bildirim gönder
   - Vercel log'larında Expo Push API yanıtını kontrol et

## Hala Çalışmıyorsa

1. **Token Alınıyor mu?**
   - Logcat'te "✅ Expo Push Token alındı" mesajını kontrol et
   - Token formatı `ExponentPushToken[...]` şeklinde olmalı

2. **Token Backend'e Gidiyor mu?**
   - Logcat'te "✅ Push token backend'e kaydedildi" mesajını kontrol et
   - MongoDB'de token var mı kontrol et

3. **Expo Push API Yanıtı:**
   - Vercel log'larında Expo Push API yanıtını kontrol et
   - `status: 'ok'` dönüyor mu?

## Not

Legacy API'yi etkinleştirmeye çalışmayın - gereksiz! Expo kendi servisini kullanıyor.





