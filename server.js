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
