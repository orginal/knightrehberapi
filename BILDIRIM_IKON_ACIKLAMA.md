# 📱 Bildirim İkonu Açıklaması

## İki Farklı Görsel:

### 1. **Küçük İkon (Notification Icon)** - BEYAZ OLMALI ✅
- Bildirim çekmecesinde küçük görünen ikon
- Android 5.0+ için **sadece beyaz** olmalı (Material Design kuralı)
- Renkli gönderilse bile sistem otomatik olarak beyaza çevirir
- Bu: `assets/notification-icon.png` (48x48, beyaz, şeffaf arka plan)

### 2. **Büyük Görsel (Large Image)** - RENKLİ OLABİLİR ✅
- Bildirim içinde büyük görünen görsel
- **Renkli olabilir!**
- Admin panelden bildirim gönderirken **"Görsel URL"** alanına eklenebilir
- Bu görsel bildirimin içinde renkli olarak görünür

## Örnek:
```
📱 Bildirim:
┌─────────────────────────┐
│ [Beyaz Küçük İkon]     │ ← Bu beyaz olmalı (notification-icon.png)
│ Knight Rehber           │
│ Yeni güncelleme var!    │
│ [Renkli Büyük Görsel]   │ ← Bu renkli olabilir (imageUrl)
└─────────────────────────┘
```

## Sonuç:
- ✅ Küçük ikon: Beyaz (zorunlu)
- ✅ Büyük görsel: Renkli (isteğe bağlı, admin panelden eklenebilir)

Renkli görünen bildirimler genellikle **büyük görsel** kullanıyor, küçük ikon hala beyaz!





