# 🔔 Bildirim İkonu Çözümü

## Sorun
Android'de bildirimler geliyor ama ikon boş/gri kare görünüyor.

## Çözüm
`app.json`'a `android.notification` ayarı eklendi:
```json
"android": {
  "notification": {
    "icon": "./assets/adaptive-icon.png",
    "color": "#FFD66B"
  }
}
```

## Önemli Not
Android'de bildirim ikonu için:
- İkon **tamamen beyaz** renkte olmalı
- **Şeffaf arka plan** olmalı
- Önerilen boyut: 24x24 veya 48x48 piksel

Eğer `adaptive-icon.png` renkli ise, beyaz bir versiyon oluşturmanız gerekebilir.

## Sonraki Adım
Yeni APK build alın:
```bash
eas build --profile preview --platform android
```

Build sonrası bildirim ikonu görünecektir.





