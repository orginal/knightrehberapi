# iOS APNs Credentials Kurulumu

## Sorun
iOS cihazlara bildirim gönderilirken şu hata alınıyor:
```
Could not find APNs credentials for com.knightrehber.app (@ceylan26/knight-rehber). 
You may need to generate or upload new push credentials.
```

## Çözüm: EAS Credentials Yükleme

### Adım 1: EAS CLI Kurulumu
Eğer EAS CLI kurulu değilse:
```bash
npm install -g eas-cli
```

### Adım 2: EAS'a Giriş Yapın
```bash
eas login
```
Expo hesabınızla giriş yapın (`kartkedi` veya `@ceylan26/knight-rehber`).

### Adım 3: Credentials Yönetimi
```bash
eas credentials
```

### Adım 4: iOS Seçin
Komut çalıştırıldığında:
1. Platform seçimi: **iOS** seçin
2. Action seçimi: **Set up push notification credentials** veya **Manage credentials** seçin

### Adım 5: Push Notification Key Oluşturma/Yükleme

#### Seçenek A: Otomatik Oluşturma (Önerilen)
EAS, Apple Developer hesabınıza bağlanarak otomatik olarak push notification key oluşturabilir:
- Apple Developer hesabı bilgilerinizi girin
- EAS otomatik olarak key oluşturur ve yükler

#### Seçenek B: Manuel Yükleme
Eğer zaten bir push notification key'iniz varsa:
1. Apple Developer Portal'dan (.p8) key dosyanınızı indirin
2. EAS credentials komutunda "Upload existing credentials" seçin
3. Key dosyasını yükleyin

### Adım 6: Key ID ve Team ID
Push notification key oluşturulduktan sonra:
- **Key ID**: Apple Developer Portal'dan alın
- **Team ID**: Apple Developer hesabınızın Team ID'si

Bu bilgiler EAS tarafından otomatik olarak kaydedilir.

### Adım 7: Doğrulama
Credentials yüklendikten sonra:
```bash
eas credentials
```
Komutunu tekrar çalıştırıp iOS credentials'larını kontrol edin.

### Adım 8: Test
Admin panelden bir test bildirimi gönderin. iOS cihazlara bildirim gitmeli.

## Notlar

1. **Apple Developer Hesabı Gerekli**: Push notification key oluşturmak için aktif bir Apple Developer hesabı gereklidir ($99/yıl).

2. **Key Geçerliliği**: Push notification key'ler süresiz geçerlidir, ancak Apple Developer hesabınız aktif olmalıdır.

3. **Production vs Development**: 
   - Production build için production credentials
   - Development build için development credentials gerekir

4. **EAS Build**: Credentials yüklendikten sonra yeni bir iOS build almanız gerekebilir:
   ```bash
   eas build --platform ios --profile production
   ```

## Sorun Giderme

### Hata: "Could not find APNs credentials"
- EAS credentials'ların doğru yüklendiğinden emin olun
- `eas credentials` komutuyla kontrol edin
- Yeni bir build alın

### Hata: "Invalid credentials"
- Key ID ve Team ID'nin doğru olduğundan emin olun
- Apple Developer Portal'dan key'in aktif olduğunu kontrol edin

### Bildirimler Hala Gitmiyor
- iOS cihazda bildirim izinlerinin açık olduğundan emin olun
- Uygulamanın production build olduğundan emin olun
- Token'ların doğru kaydedildiğini kontrol edin (admin panel > token listesi)

## İlgili Dosyalar
- `app.json`: Bundle identifier ve iOS ayarları
- `eas.json`: EAS build profilleri
- Admin Panel: `/api/admin/send-notification` endpoint'i

