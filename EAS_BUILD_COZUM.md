# EAS Build Yetkilendirme Hatası Çözümü

## 🔴 Hata
```
Entity not authorized: AppEntity[2ecf89f0-3e89-4013-92fc-02cfa947ec97]
You don't have the required permissions to perform this operation.
```

## 📋 Durum
- **Proje Sahibi:** `justbe` (app.json'da tanımlı)
- **Mevcut Giriş:** `mike0835`
- **Proje ID:** `2ecf89f0-3e89-4013-92fc-02cfa947ec97`

## ✅ Çözüm Seçenekleri

### Seçenek 1: Doğru Hesaba Giriş Yap (Önerilen)
Eğer `justbe` hesabının şifresine sahipseniz:

```bash
# Mevcut hesaptan çıkış yap
eas logout

# justbe hesabına giriş yap
eas login

# Tekrar build deneyin
eas build --profile preview --platform android
```

---

### Seçenek 2: Projeyi Kendi Hesabınıza Transfer Et
Eğer `justbe` hesabına erişiminiz yoksa, projeyi kendi hesabınıza transfer edebilirsiniz:

**Adım 1:** `app.json` dosyasındaki owner'ı değiştirin:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "2ecf89f0-3e89-4013-92fc-02cfa947ec97"
      }
    },
    "owner": "mike0835"  // veya kendi Expo username'iniz
  }
}
```

**Adım 2:** Yeni bir proje oluşturun:

```bash
eas init
```

Bu komut size yeni bir project ID verecek. Bu ID'yi `app.json`'a ekleyin.

---

### Seçenek 3: Proje Sahibi Sizi Eklemesi
Eğer `justbe` hesabı başka birine aitse, o kişinin sizi projeye eklemesi gerekiyor:

1. `justbe` hesabı sahibinin yapması gerekenler:
   - Expo hesabına giriş yap
   - https://expo.dev/accounts/justbe/projects/knight-rehber sayfasına git
   - Settings > Collaborators bölümüne git
   - `mike0835` kullanıcısını ekle

2. Sonra tekrar build deneyin:
   ```bash
   eas build --profile preview --platform android
   ```

---

### Seçenek 4: Yeni Proje Oluştur
Eğer hiçbir çözüm işe yaramazsa, yeni bir proje oluşturabilirsiniz:

```bash
# app.json'daki owner'ı değiştir
# owner: "mike0835" yap

# Yeni proje oluştur
eas init

# Yeni project ID'yi app.json'a ekle
# Build yap
eas build --profile preview --platform android
```

---

## 🔍 Kontrol Komutları

```bash
# Hangi hesaba giriş yaptığınızı kontrol edin
eas whoami

# Giriş yap
eas login

# Çıkış yap
eas logout

# Proje bilgilerini görüntüle
eas project:info
```

---

## ⚠️ Önemli Notlar

1. **Owner Değişikliği:** `app.json`'daki `owner` değiştiğinde, proje yeni sahibine geçer.
2. **Project ID:** Proje ID'yi değiştirirseniz, önceki build geçmişine erişemezsiniz.
3. **Team/Organization:** Eğer bir team/organization kullanıyorsanız, owner yerine team adını kullanın.

---

## 🎯 Hızlı Çözüm

En hızlı çözüm:

```bash
# 1. Çıkış yap
eas logout

# 2. Doğru hesaba giriş yap (justbe veya kendi hesabınız)
eas login

# 3. app.json'da owner'ı kontrol et/güncelle
# owner: "mike0835" veya doğru username

# 4. Build yap
eas build --profile preview --platform android
```



