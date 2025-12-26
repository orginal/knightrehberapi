# 🚀 Cloudflare Pages Deployment Guide

## Yöntem 1: Wrangler CLI ile Deploy (Önerilen)

### Adım 1: Wrangler CLI Kurulumu

```bash
npm install -g wrangler
```

veya

```bash
npm install wrangler --save-dev
```

### Adım 2: Cloudflare'de Giriş Yap

```bash
wrangler login
```

Tarayıcı açılacak ve Cloudflare hesabınızla giriş yapmanız istenecek.

### Adım 3: Proje Klasörüne Git

```bash
cd cloudflare-pages
```

### Adım 4: Deploy Et

```bash
wrangler pages deploy . --project-name=privacy-policy
```

---

## Yöntem 2: Cloudflare Dashboard'dan Doğrudan Upload

Eğer Cloudflare Pages dashboard'da "Upload assets" veya "Direct upload" seçeneği varsa:

1. Cloudflare Dashboard → Workers & Pages → privacy-policy projesine gidin
2. "Deployments" sekmesine gidin
3. "Create deployment" butonuna tıklayın
4. "Upload assets" seçeneğini seçin
5. `privacy-policy.html` dosyasını yükleyin

---

## Yöntem 3: GitHub Integration (En Kolay - Otomatik Deploy)

1. Bu dosyaları bir GitHub repository'ye yükleyin
2. Cloudflare Dashboard → Workers & Pages → privacy-policy → Settings
3. "Builds & deployments" sekmesine gidin
4. "Connect to Git" butonuna tıklayın
5. GitHub repository'nizi seçin
6. Build settings:
   - **Build command**: (boş bırakın - static site)
   - **Build output directory**: `/` (root)
7. Save & Deploy

Her commit'te otomatik deploy yapılacak!

---

## ✅ Deploy Sonrası Kontrol

Deploy tamamlandıktan sonra şu URL'leri test edin:

- `https://www.knightrehber.com/privacy-policy.html`
- `https://privacy-policy.pages.dev/privacy-policy.html` (Cloudflare Pages default URL)

---

## 🔧 Sorun Giderme

### 404 Hatası Alıyorsanız:

1. **Dosya adını kontrol edin**: `privacy-policy.html` olmalı
2. **Deploy durumunu kontrol edin**: Cloudflare Dashboard'da deployment'ın "Success" olduğundan emin olun
3. **DNS yayılımını bekleyin**: Domain ilk kez bağlanıyorsa 24-48 saat sürebilir

### Domain Bağlantı Sorunu:

1. Cloudflare Dashboard → Workers & Pages → privacy-policy → Custom domains
2. Domain'in "Active" durumunda olduğunu kontrol edin
3. Namecheap DNS ayarlarının Cloudflare nameserver'larını gösterdiğini kontrol edin




