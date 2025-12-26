# iOS APNs Credentials Kontrol ve Çözüm

## Hata
```
Could not find APNs credentials for com.knightrehber.app (@ceylan26/knight-rehber)
```

## Kontrol Adımları

### 1. EAS Credentials Kontrolü

Terminal'de şu komutu çalıştırın:
```bash
eas credentials
```

Sonra:
1. **iOS** seçin
2. **Push Notifications** seçin
3. **View existing push key** veya **List push keys** seçin

Push key'in yüklü olduğunu ve bundle identifier'ın `com.knightrehber.app` olduğunu kontrol edin.

### 2. Expo Web Arayüzünden Kontrol

1. https://expo.dev/accounts/kartkedi/projects/knight-rehber adresine gidin
2. Sol menüden **"Credentials"** seçin
3. **iOS** sekmesine gidin
4. **Push Notifications** bölümünü kontrol edin
5. Push key'in yüklü olduğunu ve bundle identifier'ın doğru olduğunu kontrol edin

### 3. Bundle Identifier Kontrolü

`app.json` dosyasında:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.knightrehber.app"
    }
  }
}
```

Bu değer, EAS credentials'daki bundle identifier ile **tam olarak eşleşmeli**.

## Çözüm Adımları

### Çözüm 1: Yeni Build Al (Önerilen)

APNs credentials build sırasında dahil edilir. Yeni bir iOS build alın:

```bash
eas build --platform ios --profile production
```

Build tamamlandıktan sonra:
1. Yeni build'i TestFlight'a yükleyin
2. TestFlight'tan uygulamayı kurun
3. Test bildirimi gönderin

### Çözüm 2: Credentials'ı Yeniden Yükle

Eğer credentials yanlış bundle identifier ile yüklendiyse:

1. Terminal'de:
   ```bash
   eas credentials
   ```

2. Menüden:
   - **iOS** seçin
   - **Push Notifications** seçin
   - **Remove a push key from your account** seçin (eğer yanlış key varsa)
   - **Set up your project to use Push Notifications** seçin
   - Bundle identifier'ın `com.knightrehber.app` olduğundan emin olun

### Çözüm 3: Expo'nun Credentials Cache'ini Temizle

Bazen Expo credentials cache'i güncellenmemiş olabilir:

1. `eas.json` dosyasını kontrol edin
2. Yeni bir build alın (build sırasında credentials yeniden yüklenir)

### Çözüm 4: Manuel Push Key Yükleme

Eğer Apple Developer Portal'dan manuel olarak push key oluşturduysanız:

1. Terminal'de:
   ```bash
   eas credentials
   ```

2. Menüden:
   - **iOS** seçin
   - **Push Notifications** seçin
   - **Use an existing push key** seçin
   - Key ID'yi girin
   - Key dosyasını (.p8) yükleyin

## Önemli Notlar

1. **Build Gerekli**: APNs credentials build sırasında dahil edilir. Credentials yükledikten sonra mutlaka yeni bir build alın.

2. **Bundle Identifier**: Bundle identifier'ın tam olarak eşleşmesi gerekiyor. Büyük/küçük harf duyarlıdır.

3. **Apple Developer Hesabı**: Push notification key oluşturmak için aktif bir Apple Developer hesabı gereklidir ($99/yıl).

4. **TestFlight**: Production build'i TestFlight'a yükleyip oradan test edin. Development build'lerde push notification çalışmayabilir.

## Test

Credentials yüklendikten ve yeni build alındıktan sonra:

1. Admin panelden test bildirimi gönderin
2. Vercel log'larında "Could not find APNs credentials" hatası görünmemeli
3. iOS cihazda bildirim gelmeli

## Sorun Devam Ederse

1. Expo support'a başvurun: https://expo.dev/support
2. EAS credentials log'larını kontrol edin
3. Apple Developer Portal'dan push key'in aktif olduğunu kontrol edin

