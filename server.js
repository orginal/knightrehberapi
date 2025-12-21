const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Memory Database - PostgreSQL YOK!
let guncellemeler = [
  {
    id: 1,
    title: 'Hoş Geldiniz!',
    content: 'Knight Rehber uygulamasına hoş geldiniz. Güncelleme notları buradan yönetilebilir.',
    importance: 'normal',
    date: new Date().toLocaleDateString('tr-TR'),
    created_at: new Date().toISOString()
  }
];

let bildirimler = [];
let userTokens = []; // Fallback için (MongoDB bağlantısı yoksa)

// Reklam Banner'ları - position: 'home', 'merchant', 'goldbar', 'karakter', 'skill', 'chardiz'
let reklamBannerlar = [];

const ADMIN_USER = 'aga';
const ADMIN_PASS = 'aga251643';

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || '';
let mongoClient = null;
let db = null;

// MongoDB bağlantısını başlat
async function connectToMongoDB() {
  if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI environment variable bulunamadı, memory database kullanılacak');
    return false;
  }

  try {
    if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      // Connection string'den database adını çıkar veya varsayılan kullan
      const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'knightrehber';
      db = mongoClient.db(dbName);
      console.log('✅ MongoDB bağlantısı başarılı, database:', dbName);
    }
    return true;
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    mongoClient = null;
    db = null;
    return false;
  }
}

// Uygulama başlangıcında MongoDB'ye bağlan
connectToMongoDB().catch(console.error);

// Expo Push Notification gönderme fonksiyonu
async function sendExpoPushNotification(pushTokens, title, message, imageUrl = null) {
  if (!pushTokens || pushTokens.length === 0) {
    console.log('⚠️ Push token yok, bildirim gönderilemedi');
    return { success: 0, failed: 0 };
  }

  try {
    const messages = pushTokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: message,
      data: { title, message, imageUrl },
      priority: 'high',
      channelId: 'default',
      ...(imageUrl && { _displayInForeground: true })
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('📤 Expo Push Notification sonucu:', result);

    const successCount = result.data?.filter(r => r.status === 'ok').length || 0;
    const failedCount = result.data?.filter(r => r.status !== 'ok').length || 0;

    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error('❌ Expo Push Notification hatası:', error);
    return { success: 0, failed: pushTokens.length };
  }
}

// ========== ADMIN API ==========

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    // Trim whitespace ve kontrol
    const user = String(username || '').trim();
    const pass = String(password || '').trim();
    
    console.log('🔐 Login denemesi - Kullanıcı:', user, 'Şifre uzunluğu:', pass.length);
    
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      console.log('✅ Başarılı giriş');
      res.json({ success: true, token: 'admin-token-123' });
    } else {
      console.log('❌ Başarısız giriş - Beklenen:', ADMIN_USER, 'Gelen:', user);
      res.status(401).json({ success: false, error: 'Yanlış kullanıcı adı veya şifre' });
    }
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({ success: false, error: 'Giriş hatası: ' + error.message });
  }
});

// MongoDB durum kontrolü (test için)
app.get('/api/admin/mongo-status', async (req, res) => {
  try {
    const isMongoConnected = await connectToMongoDB();
    const hasEnv = !!process.env.MONGODB_URI;
    
    let tokenCount = 0;
    let tokens = [];
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        tokenCount = await tokensCollection.countDocuments();
        tokens = await tokensCollection.find({}).limit(5).toArray();
      } catch (error) {
        console.error('❌ MongoDB token okuma hatası:', error.message);
      }
    }
    
    res.json({
      hasMongoUri: hasEnv,
      isConnected: isMongoConnected,
      tokenCount,
      sampleTokens: tokens.map(t => t.token.substring(0, 20) + '...'),
      memoryTokens: userTokens.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  let tokenCount = 0;
  
  // MongoDB'den token sayısını al
  const isMongoConnected = await connectToMongoDB();
  if (isMongoConnected && db) {
    try {
      const tokensCollection = db.collection('push_tokens');
      tokenCount = await tokensCollection.countDocuments();
    } catch (error) {
      console.error('❌ MongoDB token sayısı hatası:', error.message);
      tokenCount = userTokens.length; // Fallback
    }
  } else {
    tokenCount = userTokens.length; // Fallback
  }
  
  res.json({
    totalUsers: 0,
    activeUsers: 0,
    sentNotifications: bildirimler.length,
    usersWithPushToken: tokenCount,
    appVersion: '1.0.0',
    appStatus: 'active'
  });
});

// Push token kaydet
app.post('/api/push/register', async (req, res) => {
  try {
    const { token } = req.body || {};
    
    console.log('📱 Push token kayıt isteği geldi:', token ? 'Token var' : 'Token yok');
    
    if (!token) {
      console.log('❌ Token gerekli');
      return res.status(400).json({ success: false, error: 'Token gerekli' });
    }

    const tokenStr = String(token).trim();
    console.log('📝 Token uzunluğu:', tokenStr.length);
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      // MongoDB'ye kaydet
      try {
        const tokensCollection = db.collection('push_tokens');
        const result = await tokensCollection.updateOne(
          { token: tokenStr },
          { 
            $set: { 
              token: tokenStr,
              updatedAt: new Date(),
              lastSeen: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
        
        const totalTokens = await tokensCollection.countDocuments();
        console.log('✅ Push token MongoDB\'ye kaydedildi. Toplam:', totalTokens);
        res.json({ success: true, message: 'Token kaydedildi', totalTokens });
        return;
      } catch (mongoError) {
        console.error('❌ MongoDB kayıt hatası:', mongoError.message);
        // Fallback: Memory database'ye kaydet
      }
    }
    
    // Fallback: Memory database
    console.log('📊 Mevcut token sayısı (kayıt öncesi):', userTokens.length);
    
    if (!userTokens.includes(tokenStr)) {
      userTokens.push(tokenStr);
      console.log('✅ Yeni push token memory\'ye kaydedildi. Toplam:', userTokens.length);
    } else {
      console.log('⚠️ Token zaten kayıtlı');
    }

    console.log('📊 Token kayıt sonrası toplam:', userTokens.length);
    res.json({ success: true, message: 'Token kaydedildi (memory)', totalTokens: userTokens.length });
  } catch (error) {
    console.error('❌ Token kayıt hatası:', error);
    res.status(500).json({ success: false, error: 'Hata: ' + error.message });
  }
});

// Bildirim gönder
app.post('/api/admin/send-notification', async (req, res) => {
  try {
    const { title, message, target } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Başlık ve mesaj gerekli'
      });
    }

    const bildirim = {
      id: Date.now(),
      title: String(title).trim(),
      message: String(message).trim(),
      target: target || 'all',
      imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : null,
      created_at: new Date().toISOString()
    };

    bildirimler.unshift(bildirim);

    // Expo Push Notification gönder - MongoDB'den token'ları al
    let tokensToSend = [];
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        const tokens = await tokensCollection.find({}).toArray();
        tokensToSend = tokens.map(t => t.token);
        console.log('📊 MongoDB\'den token sayısı:', tokensToSend.length);
      } catch (mongoError) {
        console.error('❌ MongoDB token okuma hatası:', mongoError.message);
        // Fallback: Memory database
        tokensToSend = userTokens;
      }
    } else {
      // Fallback: Memory database
      tokensToSend = userTokens;
      console.log('📊 Memory database\'den token sayısı:', tokensToSend.length);
    }
    
    console.log('📋 Gönderilecek token listesi:', tokensToSend);
    
    let pushResult = { success: 0, failed: 0 };
    if (tokensToSend.length > 0) {
      console.log(`📤 ${tokensToSend.length} cihaza bildirim gönderiliyor...`);
      pushResult = await sendExpoPushNotification(tokensToSend, bildirim.title, bildirim.message, bildirim.imageUrl);
      console.log(`✅ ${pushResult.success} başarılı, ❌ ${pushResult.failed} başarısız`);
    } else {
      console.log('⚠️ Kayıtlı push token yok, bildirim sadece kaydedildi');
      console.log('💡 APK\'yı açın ve bildirim izni verin, token otomatik kaydedilecek');
    }

    res.json({
      success: true,
      message: `Bildirim gönderildi! ${pushResult.success} cihaza ulaştı.`,
      notification: bildirim,
      pushStats: pushResult
    });
  } catch (error) {
    console.error('Bildirim hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hata: ' + error.message
    });
  }
});

// Bildirimleri listele
app.get('/api/admin/notifications', (req, res) => {
  res.json(bildirimler.slice(0, 20));
});

app.get('/api/admin/updates', (req, res) => {
  res.json(guncellemeler);
});

app.post('/api/admin/add-update', (req, res) => {
  try {
    const { title, content, importance, imageUrl } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Başlık ve içerik gerekli'
      });
    }

    const yeni = {
      id: Date.now(),
      title: String(title).trim(),
      content: String(content).trim(),
      importance: importance || 'normal',
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      date: new Date().toLocaleDateString('tr-TR'),
      created_at: new Date().toISOString()
    };

    guncellemeler.unshift(yeni);

    res.json({
      success: true,
      message: 'Güncelleme eklendi!',
      update: yeni
    });
  } catch (error) {
    console.error('HATA:', error.message);
    res.status(500).json({
      success: false,
      error: 'Hata: ' + error.message
    });
  }
});

app.delete('/api/admin/delete-update/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = guncellemeler.findIndex(g => g.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Bulunamadı' });
    }

    guncellemeler.splice(index, 1);
    res.json({ success: true, message: 'Silindi!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== MOBIL API ==========

app.get('/api/guncelleme-notlari', (req, res) => {
  res.json(guncellemeler.slice(0, 10));
});

// Reklam Banner API - Tüm aktif banner'ları döndür (sırayla gösterilecek)
app.get('/api/reklam-banner/:position', async (req, res) => {
  try {
    const position = req.params.position;
    
    // MongoDB'den al - tüm aktif banner'lar
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        const banners = await bannersCollection
          .find({ position, active: true })
          .sort({ createdAt: -1 }) // En yeni önce
          .toArray();
        if (banners && banners.length > 0) {
          return res.json({ banners });
        }
      } catch (error) {
        console.error('MongoDB banner okuma hatası:', error);
      }
    }
    
    // Fallback: Memory database - tüm aktif banner'lar
    const banners = reklamBannerlar.filter(b => b.position === position && b.active);
    const sortedBanners = banners.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ banners: sortedBanners });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/banners', async (req, res) => {
  try {
    // MongoDB'den al - position ve createdAt'e göre sırala
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        const banners = await bannersCollection
          .find({})
          .sort({ position: 1, createdAt: -1 }) // Position'a göre, sonra en yeni
          .toArray();
        return res.json(banners);
      } catch (error) {
        console.error('MongoDB banner listesi hatası:', error);
      }
    }
    
    // Fallback
    res.json(reklamBannerlar.sort((a, b) => {
      if (a.position !== b.position) return a.position.localeCompare(b.position);
      return new Date(b.createdAt) - new Date(a.createdAt);
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Banner sil
app.delete('/api/admin/banner/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // MongoDB'den sil
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        const result = await bannersCollection.deleteOne({ id });
        if (result.deletedCount > 0) {
          console.log('✅ Banner MongoDB\'den silindi:', id);
          return res.json({ success: true, message: 'Banner silindi' });
        }
      } catch (error) {
        console.error('MongoDB banner silme hatası:', error);
      }
    }
    
    // Fallback: Memory database
    const index = reklamBannerlar.findIndex(b => b.id === id);
    if (index !== -1) {
      reklamBannerlar.splice(index, 1);
      res.json({ success: true, message: 'Banner silindi' });
    } else {
      res.status(404).json({ success: false, error: 'Banner bulunamadı' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Imgur ve ImageBB linklerini direkt görsel linkine çevir
function convertImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  const trimmedUrl = url.trim();
  
  // ImageBB linki: https://ibb.co/xxxxx -> direkt görsel linki önerilir
  // ImageBB linkleri genellikle direkt görsel linki olarak kullanılmalı
  if (trimmedUrl.includes('ibb.co')) {
    // Eğer zaten i.ibb.co formatındaysa (direkt görsel linki) olduğu gibi döndür
    if (trimmedUrl.includes('i.ibb.co')) {
      return trimmedUrl;
    }
    // ibb.co/xxxxx formatındaysa kullanıcıya direkt görsel linki kullanmasını söyle
    console.warn('ImageBB linki kullanıldı, direkt görsel linki önerilir:', trimmedUrl);
    return trimmedUrl;
  }
  
  // Imgur album linki: https://imgur.com/a/xxxxx -> https://i.imgur.com/xxxxx.jpg
  const albumMatch = trimmedUrl.match(/imgur\.com\/a\/([a-zA-Z0-9]+)/);
  if (albumMatch) {
    const imageId = albumMatch[1];
    return `https://i.imgur.com/${imageId}.jpg`;
  }
  
  // Imgur direkt link: https://imgur.com/xxxxx -> https://i.imgur.com/xxxxx.jpg
  const directMatch = trimmedUrl.match(/imgur\.com\/([a-zA-Z0-9]+)(\.[a-z]+)?$/);
  if (directMatch && !trimmedUrl.includes('/a/')) {
    const imageId = directMatch[1];
    return `https://i.imgur.com/${imageId}.jpg`;
  }
  
  // Zaten i.imgur.com formatındaysa olduğu gibi döndür
  if (trimmedUrl.includes('i.imgur.com')) {
    return trimmedUrl;
  }
  
  return trimmedUrl;
}

app.post('/api/admin/banner', async (req, res) => {
  try {
    const { position, imageUrl, clickUrl, active = true } = req.body || {};
    
    if (!position) {
      return res.status(400).json({ success: false, error: 'Position gerekli' });
    }
    
    // Aynı position için maksimum 5 banner kontrolü
    const isMongoConnected = await connectToMongoDB();
    let bannerCount = 0;
    
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        bannerCount = await bannersCollection.countDocuments({ position: String(position).trim() });
        
        if (bannerCount >= 10) {
          return res.status(400).json({ 
            success: false, 
            error: 'Bu position için maksimum 10 banner eklenebilir. Önce bir banner silin.' 
          });
        }
      } catch (error) {
        console.error('MongoDB banner sayısı kontrolü hatası:', error);
      }
    } else {
      // Fallback: Memory database
      bannerCount = reklamBannerlar.filter(b => b.position === String(position).trim()).length;
      if (bannerCount >= 10) {
        return res.status(400).json({ 
          success: false, 
          error: 'Bu position için maksimum 10 banner eklenebilir. Önce bir banner silin.' 
        });
      }
    }
    
    // Imgur/ImageBB URL'ini düzelt
    const convertedImageUrl = imageUrl ? convertImageUrl(imageUrl) : null;
    
    const banner = {
      id: Date.now(),
      position: String(position).trim(),
      imageUrl: convertedImageUrl,
      clickUrl: clickUrl ? String(clickUrl).trim() : null,
      active: active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // MongoDB'ye kaydet (yeni banner olarak ekle, update değil)
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        await bannersCollection.insertOne(banner);
        console.log('✅ Banner MongoDB\'ye kaydedildi:', banner.position, 'Toplam:', bannerCount + 1);
      } catch (error) {
        console.error('MongoDB banner kayıt hatası:', error);
      }
    }
    
    // Memory database'ye ekle
    reklamBannerlar.push(banner);
    
    res.json({ success: true, message: 'Banner kaydedildi', banner, totalBanners: bannerCount + 1 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== PAGES ==========

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/', (req, res) => {
  res.json({
    message: 'Knight Rehber API Çalışıyor 🏰',
    version: '1.0.0'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err);
  res.status(500).json({ error: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server: http://localhost:${PORT}`);
  });
}

module.exports = app;
