# 📱 Logcat Kontrol Komutları

## Yeni APK'yı Kurun

1. Build linkinden APK'yı indirin
2. Telefona kurun (eski versiyonu kaldırıp yeni versiyonu kurun)
3. Uygulamayı açın

## Logcat Kontrolü

### Komut 1: Tüm ReactNativeJS Logları
```powershell
adb logcat -d | Select-String -Pattern "ReactNativeJS" | Select-Object -Last 100
```

### Komut 2: Firebase ve Push Notification Hataları
```powershell
adb logcat -d | Select-String -Pattern "Firebase|Push|Token|Notification|E_REGISTRATION" | Select-Object -Last 50
```

### Komut 3: Canlı Log İzleme (Uygulama açıkken)
```powershell
adb logcat | Select-String -Pattern "ReactNativeJS"
```

### Komut 4: Sadece Hatalar
```powershell
adb logcat -d *:E | Select-String -Pattern "knightrehber|Firebase|Push"
```

## Kontrol Edilecekler

1. ✅ Push token alınıyor mu? (`Expo Push Token alındı`)
2. ❌ Firebase hatası var mı? (`Default FirebaseApp is not initialized`)
3. ✅ Token backend'e gönderiliyor mu? (`Push token backend'e kaydedildi`)
4. ✅ Bildirim izni verildi mi? (`Bildirim izni verildi`)





