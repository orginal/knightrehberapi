# ✅ Push Notification Experience ID Filtreleme Düzeltmesi

## Sorun
Vercel log'larında `PUSH_TOO_MANY_EXPERIENCE_IDS` hatası görülüyordu. Bu hata, aynı bildirim isteğinde hem `@mike0835/knight-rehber` hem de `@ceylan26/knight-rehber` projelerine ait token'ların bulunmasından kaynaklanıyordu. Expo Push API, farklı experience ID'lere sahip token'lara aynı anda bildirim gönderemez.

## Çözüm

### 1. Token Kaydında Experience ID Eklendi
- `App.js`: Token kaydedilirken `experienceId` backend'e gönderiliyor
- `server.js` ve `api/index.js`: Token MongoDB'ye kaydedilirken `experienceId` alanı da kaydediliyor

### 2. Bildirim Gönderirken Filtreleme Eklendi
- `server.js` ve `api/index.js`: Bildirim gönderilirken sadece `experienceId: '@ceylan26/knight-rehber'` olan token'lar kullanılıyor
- Eski `@mike0835/knight-rehber` token'ları filtreleniyor ve kullanılmıyor

## Yapılan Değişiklikler

### App.js
- Token kaydedilirken `experienceId: '@ceylan26/knight-rehber'` backend'e gönderiliyor

### server.js
- `/api/push/register`: `experienceId` alanı MongoDB'ye kaydediliyor
- `/api/admin/send-notification`: Sadece `@ceylan26/knight-rehber` token'ları kullanılıyor

### api/index.js
- `/api/push/register`: `experienceId` alanı MongoDB'ye kaydediliyor
- `/api/admin/send-notification`: Sadece `@ceylan26/knight-rehber` token'ları kullanılıyor

## Sonuç
Artık bildirimler sadece `@ceylan26/knight-rehber` projesine ait token'lara gönderilecek. Eski `@mike0835/knight-rehber` token'ları MongoDB'de kalacak ama kullanılmayacak (opsiyonel olarak silinebilir).





