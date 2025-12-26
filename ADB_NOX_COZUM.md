# 🔧 ADB Nox Bağlantı Sorunu Çözümü

## Sorun
ADB Nox emülatörüne bağlanamıyor: "protocol fault (couldn't read status): connection reset"

## ✅ Çözüm Adımları

### 1. Nox Emülatörünü Yeniden Başlatın
- Nox'u tamamen kapatın
- Yeniden açın
- 1-2 dakika bekleyin (emülatör tamamen başlasın)

### 2. ADB Server'ı Yeniden Başlatın
```powershell
adb kill-server
adb start-server
adb devices
```

### 3. Nox ADB Port'unu Kontrol Edin
Nox genellikle `62001` portunu kullanır. Kontrol edin:
```powershell
netstat -ano | findstr 62001
```

### 4. Alternatif: Nox'un Kendi Log Görüntüleyicisi
- Nox emülatöründe: Settings > Advanced > Log Viewer
- Veya Nox'un kendi konsolunu kullanın

### 5. Manuel Log Paylaşımı
Uygulama açıkken console'da görünen hataları kopyalayıp paylaşın.

## 📝 Not
Eğer ADB çalışmıyorsa, push notification testi için fiziksel cihaz kullanabilirsiniz.





