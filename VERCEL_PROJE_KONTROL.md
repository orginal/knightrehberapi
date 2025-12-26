# ⚠️ VERCEL PROJE KONTROLÜ GEREKLİ

## Sorun
Mobil uygulama şu URL'i kullanıyor: `https://knightrehberapi.vercel.app/api`

Ama kodlarımız `knight-rehber-admin` klasöründe. Vercel'de hangi proje deploy ediliyor?

## Çözüm

1. **Vercel Dashboard'a gidin**
2. **İki proje kontrol edin:**
   - `knightrehberapi` (kullanılan proje - mobil uygulama buraya bağlanıyor)
   - `knight-rehber-admin` (kodların olduğu klasör)

3. **Eğer `knightrehberapi` ayrı bir proje ise:**
   - `knight-rehber-admin` klasöründeki kodları `knightrehberapi` projesine deploy edin
   - Veya `knightrehberapi` projesinin GitHub repo'sunu kontrol edin

4. **Vercel'de proje ayarlarını kontrol edin:**
   - Root Directory: `knight-rehber-admin` mi?
   - Build Command: Doğru mu?
   - Output Directory: Doğru mu?

## Önemli
Mobil uygulama `knightrehberapi.vercel.app` kullandığı için, kodlarımızın bu projeye deploy edilmesi gerekiyor!





