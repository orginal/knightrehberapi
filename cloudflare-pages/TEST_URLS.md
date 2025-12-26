# 🧪 Test URL'leri

Deployment başarılı! Şu URL'leri test edin:

## Production Deployment URL'leri:

1. **Root (index.html)**: 
   - https://48bd747f.privacy-policy-6io.pages.dev/
   - https://master.privacy-policy-6io.pages.dev/

2. **Privacy Policy (privacy-policy.html)**:
   - https://48bd747f.privacy-policy-6io.pages.dev/privacy-policy.html
   - https://master.privacy-policy-6io.pages.dev/privacy-policy.html

## Custom Domain (DNS yayılımından sonra):

1. **Root**: 
   - https://www.knightrehber.com/
   - https://www.knightrehber.com/index.html

2. **Privacy Policy**:
   - https://www.knightrehber.com/privacy-policy.html

## ✅ Kontrol Listesi:

- [ ] Production deployment URL çalışıyor mu? (48bd747f... veya master...)
- [ ] Custom domain "Active" durumunda mı? (Cloudflare Dashboard)
- [ ] SSL "Enabled" durumunda mı? (Cloudflare Dashboard)
- [ ] Namecheap'te nameserver'lar Cloudflare'i gösteriyor mu?
- [ ] DNS yayılımı tamamlandı mı? (24-48 saat sürebilir, ama genelde 5-10 dakika)

## 🔧 Sorun Giderme:

Eğer custom domain hala çalışmıyorsa:

1. **Cloudflare Dashboard'da Custom Domain'i kontrol edin**:
   - Workers & Pages → privacy-policy → Custom domains
   - Domain'in yanında "Active" yazmalı
   - Eğer "Initializing" veya "Pending" görünüyorsa, birkaç dakika bekleyin

2. **Namecheap DNS Ayarları**:
   - Domain → Advanced DNS → Nameservers
   - "Custom DNS" seçili olmalı
   - Cloudflare nameserver'larını göstermeli

3. **Bekleme Süresi**:
   - İlk kez bağlanıyorsa: 5-10 dakika
   - DNS yayılımı: 24-48 saat (ama genelde çok daha hızlı)

4. **Alternatif Çözüm**:
   - Eğer acil erişim gerekiyorsa, deployment URL'lerini kullanabilirsiniz
   - Store'larda deployment URL'i de kabul edilebilir (ama custom domain daha profesyonel)




