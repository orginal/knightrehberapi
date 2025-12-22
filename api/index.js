const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');
const https = require('https');
const http = require('http');

// Fetch kullanımı - Node.js 18+ built-in fetch varsa kullan, yoksa Imgur album handling devre dışı
let fetch;
if (typeof globalThis.fetch !== 'undefined') {
  fetch = globalThis.fetch;
} else {
  fetch = null; // fetch yoksa Imgur album handling çalışmayacak
}

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || '';
let mongoClient = null;
let db = null;

// MongoDB bağlantısını başlat (Vercel serverless için optimize)
async function connectToMongoDB() {
  if (!MONGODB_URI) {
    console.error('⚠️ MONGODB_URI environment variable bulunamadı');
    console.error('⚠️ process.env.MONGODB_URI:', process.env.MONGODB_URI ? 'VAR' : 'YOK');
    return false;
  }

  try {
    // Eğer mevcut client varsa ve bağlıysa onu kullan
    if (mongoClient && db) {
      try {
        // Ping ile bağlantının hala aktif olduğunu kontrol et
        await mongoClient.db('admin').command({ ping: 1 });
        return true;
      } catch (pingError) {
        // Ping başarısız olduysa bağlantıyı temizle ve yeniden oluştur
        console.log('⚠️ MongoDB bağlantısı kopmuş, yeniden bağlanılıyor...');
        try {
          await mongoClient.close();
        } catch (closeError) {
          // Ignore close errors
        }
        mongoClient = null;
        db = null;
      }
    }
    
    // Yeni connection oluştur
    console.log('🔄 MongoDB bağlantısı oluşturuluyor...');
    console.log('🔄 MONGODB_URI uzunluğu:', MONGODB_URI.length);
    
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000, // 15 saniye timeout (Vercel için daha uzun)
      connectTimeoutMS: 15000,
      socketTimeoutMS: 15000,
      maxPoolSize: 1, // Serverless için 1 yeterli
      minPoolSize: 0,
      maxIdleTimeMS: 30000
    });
    
    await mongoClient.connect();
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'knightrehber';
    db = mongoClient.db(dbName);
    
    console.log('✅ MongoDB bağlantısı başarılı, database:', dbName);
    return true;
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    console.error('❌ Hata stack:', error.stack);
    console.error('❌ MONGODB_URI başlangıcı:', MONGODB_URI.substring(0, 30) + '...');
    
    // Bağlantıyı temizle
    if (mongoClient) {
      try {
        await mongoClient.close();
      } catch (closeError) {
        // Ignore
      }
    }
    mongoClient = null;
    db = null;
    return false;
  }
}

// Basit veritabanı (Fallback)
let bildirimler = [];
let userTokens = []; // Fallback için (MongoDB bağlantısı yoksa)

let database = {
  users: [
    {
      id: 'guest_123',
      username: 'Misafir',
      lastActive: new Date().toISOString(),
      pushToken: null
    }
  ],
  notifications: [],
  updateNotes: [
    {
      id: 1,
      title: 'Hoş Geldiniz!',
      content: 'Knight Rehber uygulamasına hoş geldiniz. Yeni özellikler yakında eklenecek.',
      importance: 'normal',
      date: new Date().toLocaleDateString('tr-TR'),
      created_at: new Date().toISOString()
    }
  ],
  nostaljiPhotos: [
    {
      id: 'k1',
      title: 'Eski Knight Online',
      image_url: 'https://via.placeholder.com/300x200/FFD66B/0B0B0B?text=Knight+Rehber',
      created_at: new Date().toISOString()
    }
  ],
  appSettings: {
    app_status: 'active',
    maintenance_message: 'Uygulama bakım modundadır.',
    min_version: '1.0.0'
  },
  reklamBannerlar: []
};

// Expo Push Notification gönderme fonksiyonu
async function sendExpoPushNotification(pushTokens, title, message, imageUrl = null) {
  if (!pushTokens || pushTokens.length === 0) {
    console.log('⚠️ Push token yok, bildirim gönderilemedi');
    return { success: 0, failed: 0, error: 'Push token bulunamadı' };
  }

  // Token'ları temizle ve geçerli olanları filtrele
  const validTokens = pushTokens
    .map(t => String(t).trim())
    .filter(t => t && t.startsWith('ExponentPushToken[') && t.length > 20);

  if (validTokens.length === 0) {
    console.log('⚠️ Geçerli push token yok');
    return { success: 0, failed: 0, error: 'Geçerli push token bulunamadı' };
  }

  console.log(`📤 ${validTokens.length} cihaza bildirim gönderiliyor...`);

  try {
    const messages = validTokens.map(token => {
      return {
        to: token,
        sound: 'default',
        title: title,
        body: message,
        data: { title, message, ...(imageUrl && { imageUrl }) },
        priority: 'high',
        channelId: 'default',
        badge: 1
      };
    });

    console.log('📤 Expo Push API\'ye istek gönderiliyor...');
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Expo Push API hatası:', response.status, errorText);
      return { success: 0, failed: validTokens.length, error: `API hatası: ${response.status}` };
    }

    const result = await response.json();
    console.log('📤 Expo Push Notification sonucu:', JSON.stringify(result, null, 2));

    // Her bir token için detaylı log
    if (result.data && Array.isArray(result.data)) {
      result.data.forEach((item, index) => {
        if (item.status === 'ok') {
          console.log(`✅ Token ${index + 1} (${validTokens[index]?.substring(0, 30)}...): OK - ${item.id || 'ID yok'}`);
        } else {
          console.error(`❌ Token ${index + 1} (${validTokens[index]?.substring(0, 30)}...): ${item.status} - ${item.message || 'Bilinmeyen hata'}`);
        }
      });
    }

    const successCount = result.data?.filter(r => r.status === 'ok').length || 0;
    const failedCount = result.data?.filter(r => r.status !== 'ok').length || 0;
    
    // Hata detaylarını logla
    let errorDetails = [];
    if (failedCount > 0) {
      const errors = result.data?.filter(r => r.status !== 'ok');
      console.error('❌ Başarısız bildirimler:', JSON.stringify(errors, null, 2));
      errorDetails = errors.map(e => ({
        status: e.status,
        message: e.message || 'Bilinmeyen hata',
        details: e.details || null
      }));
    }

    return { success: successCount, failed: failedCount, details: result.data, errorDetails };
  } catch (error) {
    console.error('❌ Expo Push Notification hatası:', error.message);
    console.error('❌ Hata stack:', error.stack);
    return { success: 0, failed: validTokens.length, error: error.message };
  }
}

// ROUTES
app.get('/', (req, res) => {
  res.json({
    message: 'Knight Rehber API Çalışıyor 🏰',
    version: '1.0.0',
    endpoints: {
      admin: '/admin',
      api: '/api'
    }
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'));
});

// Admin giriş
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};

  const adminUsername = 'aga';
  const adminPassword = 'aga251643';

  if (String(username).trim().toLowerCase() === adminUsername.toLowerCase() && String(password).trim() === adminPassword) {
    res.json({
      success: true,
      token: 'admin-token-2024',
      user: { username: adminUsername, role: 'admin' }
    });
  } else {
    res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
  }
});

// İstatistikler
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
    database.notifications.unshift(bildirim);

    // Expo Push Notification gönder - MongoDB'den token'ları al
    let tokensToSend = [];
    let mongoError = null;
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        
        // ÖNCE: Tüm token'ları al ve logla (debug için)
        const allTokens = await tokensCollection.find({}).toArray();
        console.log('📊 MongoDB\'de toplam token sayısı:', allTokens.length);
        allTokens.forEach(t => {
          console.log(`  - Token: ${t.token.substring(0, 30)}..., experienceId: ${t.experienceId || 'YOK'}`);
        });
        
        // Sadece @ceylan26/knight-rehber experience ID'sine ait token'ları al
        const tokens = await tokensCollection.find({ experienceId: '@ceylan26/knight-rehber' }).toArray();
        tokensToSend = tokens.map(t => t.token).filter(t => t && t.trim());
        console.log('✅ MongoDB\'den token sayısı (@ceylan26/knight-rehber):', tokensToSend.length);
        
        // Eski @mike0835 token'larını logla (silinebilir)
        const oldTokens = await tokensCollection.find({ experienceId: '@mike0835/knight-rehber' }).toArray();
        if (oldTokens.length > 0) {
          console.log('⚠️ Eski @mike0835/knight-rehber token sayısı:', oldTokens.length, '(kullanılmıyor)');
        }
        
        // ExperienceId'si null/undefined olan eski token'ları logla
        const nullExpIdTokens = await tokensCollection.find({ 
          $or: [
            { experienceId: null },
            { experienceId: { $exists: false } }
          ]
        }).toArray();
        if (nullExpIdTokens.length > 0) {
          console.log('⚠️ ExperienceId olmayan eski token sayısı:', nullExpIdTokens.length, '(kullanılmıyor)');
        }
      } catch (error) {
        console.error('❌ MongoDB token okuma hatası:', error.message);
        mongoError = error.message;
        // Fallback: Memory database
        tokensToSend = database.users.filter(u => u.pushToken).map(u => u.pushToken).filter(t => t && t.trim());
        console.log('📊 Fallback: Memory database\'den token sayısı:', tokensToSend.length);
      }
    } else {
      // MongoDB bağlantısı yok
      mongoError = 'MongoDB bağlantısı yok';
      // Fallback: Memory database
      tokensToSend = database.users.filter(u => u.pushToken).map(u => u.pushToken).filter(t => t && t.trim());
      console.log('📊 Fallback: Memory database\'den token sayısı:', tokensToSend.length);
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

    const errorMessage = pushResult.errorDetails && pushResult.errorDetails.length > 0
      ? ` Hata detayları: ${pushResult.errorDetails.map(e => e.message).join(', ')}`
      : '';
    
    res.json({
      success: true,
      message: tokensToSend.length > 0 
        ? `Bildirim gönderildi! ${pushResult.success} cihaza ulaştı, ${pushResult.failed} başarısız.${errorMessage}`
        : 'Bildirim kaydedildi ancak kayıtlı push token yok. APK\'yı açın ve bildirim izni verin.',
      notification: bildirim,
      pushStats: {
        ...pushResult,
        totalTokens: tokensToSend.length,
        mongoError: mongoError || null
      }
    });
  } catch (error) {
    console.error('Bildirim hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Hata: ' + error.message
    });
  }
});

// Güncelleme notu ekle (Fallback)
app.post('/api/admin/add-update', (req, res) => {
  try {
    const { title, content, importance } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik gerekli' });
    }

    const newUpdate = {
      id: Date.now(),
      title: title.trim(),
      content: content.trim(),
      importance: importance || 'normal',
      date: new Date().toLocaleDateString('tr-TR'),
      created_at: new Date().toISOString()
    };

    database.updateNotes.unshift(newUpdate);

    res.json({
      success: true,
      message: 'Güncelleme notu başarıyla eklendi!',
      update: newUpdate
    });
  } catch (error) {
    console.error('Güncelleme ekleme hatası:', error);
    res.status(500).json({ success: false, error: 'Güncelleme notu eklenirken hata oluştu' });
  }
});

// Nostalji fotoğrafı ekle (Fallback)
app.post('/api/admin/add-photo', (req, res) => {
  const { title, url } = req.body;

  if (!title || !url) {
    return res.status(400).json({ error: 'Başlık ve URL gerekli' });
  }

  const newPhoto = {
    id: 'k' + (database.nostaljiPhotos.length + 1),
    title,
    image_url: url,
    created_at: new Date().toISOString()
  };

  database.nostaljiPhotos.unshift(newPhoto);

  res.json({
    success: true,
    message: 'Fotoğraf eklendi',
    photo: newPhoto
  });
});

// Uygulama durumunu güncelle (Fallback)
app.post('/api/admin/app-status', (req, res) => {
  const { status, maintenanceMessage } = req.body;

  database.appSettings.app_status = status || 'active';
  database.appSettings.maintenance_message = maintenanceMessage || 'Uygulama bakım modundadır.';

  res.json({
    success: true,
    message: 'Uygulama durumu güncellendi',
    settings: database.appSettings
  });
});

// Bildirimleri listele (Fallback)
app.get('/api/admin/notifications', (req, res) => {
  res.json(database.notifications.slice(0, 20));
});

// Güncelleme notlarını listele (Fallback)
app.get('/api/admin/updates', (req, res) => {
  res.json(database.updateNotes.slice(0, 20));
});

// Güncelleme notu sil (Fallback)
app.delete('/api/admin/delete-update/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updateId = parseInt(id);

    const index = database.updateNotes.findIndex(note => note.id === updateId);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Güncelleme notu bulunamadı' });
    }

    database.updateNotes.splice(index, 1);

    res.json({
      success: true,
      message: 'Güncelleme notu başarıyla silindi'
    });
  } catch (error) {
    console.error('Güncelleme silme hatası:', error);
    res.status(500).json({ success: false, error: 'Güncelleme notu silinirken hata oluştu' });
  }
});

// Nostalji fotoğraflarını listele (Fallback)
app.get('/api/admin/photos', (req, res) => {
  res.json(database.nostaljiPhotos.slice(0, 20));
});

// MOBILE APP ROUTES
app.get('/api/app-status', (req, res) => {
  res.json({
    status: database.appSettings.app_status,
    maintenance: database.appSettings.app_status === 'maintenance',
    maintenanceMessage: database.appSettings.maintenance_message
  });
});

app.get('/api/guncelleme-notlari', (req, res) => {
  res.json(database.updateNotes.slice(0, 10));
});

app.get('/api/nostalji-fotograflar', (req, res) => {
  res.json(database.nostaljiPhotos);
});

app.post('/api/stats', (req, res) => {
  const { userId, action } = req.body;
  console.log(`📊 İstatistik: ${userId} - ${action}`);
  res.json({ success: true });
});

// Push token kaydet
app.post('/api/push/register', async (req, res) => {
  try {
    const { token, experienceId } = req.body || {};
    
    console.log('📱 Push token kayıt isteği geldi:', token ? 'Token var' : 'Token yok');
    console.log('📱 Experience ID:', experienceId || 'Yok');
    
    if (!token) {
      console.log('❌ Token gerekli');
      return res.status(400).json({ success: false, error: 'Token gerekli' });
    }

    const tokenStr = String(token).trim();
    const expId = experienceId ? String(experienceId).trim() : null;
    console.log('📝 Token uzunluğu:', tokenStr.length);
    console.log('📝 Token formatı:', tokenStr.substring(0, 30) + '...');
    console.log('📝 Token başlangıcı:', tokenStr.startsWith('ExponentPushToken[') ? 'Doğru' : 'Hatalı');
    console.log('📝 Experience ID:', expId || 'Belirtilmemiş');
    
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
              experienceId: expId,
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

// Kullanıcı kaydı
app.post('/api/notifications/register', (req, res) => {
  const { userId, token, appVersion, platform, username } = req.body;

  console.log('📱 Kullanıcı kaydı:', { userId, token, username });

  // Kullanıcıyı kaydet veya güncelle
  const existingUser = database.users.find(u => u.id === userId);
  if (existingUser) {
    existingUser.lastActive = new Date().toISOString();
    existingUser.pushToken = token;
    existingUser.platform = platform;
    existingUser.appVersion = appVersion;
    if (username) existingUser.username = username;

    console.log('✅ Mevcut kullanıcı güncellendi:', existingUser.username);
  } else {
    const newUser = {
      id: userId,
      username: username || 'Kullanıcı-' + Date.now(),
      pushToken: token,
      platform: platform,
      appVersion: appVersion,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isPremium: false
    };

    database.users.push(newUser);
    console.log('✅ Yeni kullanıcı eklendi:', newUser.username);
  }

  res.json({
    success: true,
    message: 'Kullanıcı başarıyla kaydedildi',
    totalUsers: database.users.length
  });
});

// Kullanıcı listesi
app.get('/api/admin/users', (req, res) => {
  res.json({
    users: database.users,
    total: database.users.length,
    withPushToken: database.users.filter(u => u.pushToken).length
  });
});

// Görsel Proxy - ImageBB ve diğer servisler için (Vercel serverless için optimize)
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = decodeURIComponent(req.query.url || '');
  
  if (!imageUrl) {
    return res.status(400).json({ error: 'URL parametresi gerekli' });
  }

  console.log('Proxy isteği:', imageUrl);

  try {
    const url = new URL(imageUrl);
    
    // Sadece HTTPS ve HTTP'ye izin ver
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return res.status(400).json({ error: 'Sadece HTTP ve HTTPS URL\'leri desteklenir' });
    }
    
    // Imgur album linklerini handle et - fetch yoksa skip et, direkt proxy kullan
    if (imageUrl.includes('imgur.com/a/') && fetch) {
      try {
        // Album sayfasını fetch et
        const albumResponse = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!albumResponse.ok) {
          throw new Error(`Album sayfası yüklenemedi: ${albumResponse.status}`);
        }
        
        const html = await albumResponse.text();
        
        // HTML'den görsel URL'ini çıkar (Imgur'un yeni formatı)
        // <meta property="og:image" content="https://i.imgur.com/xxxxx.jpg">
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          const directImageUrl = ogImageMatch[1];
          console.log('Imgur album\'den görsel bulundu:', directImageUrl);
          
          // Direkt görsel URL'ini proxy üzerinden aç (tekrar proxy endpoint'ine yönlendir)
          // Bu şekilde tek bir görsel için proxy kullanılır
          const baseUrl = `https://${req.get('host')}`;
          return res.redirect(`${baseUrl}/api/image-proxy?url=${encodeURIComponent(directImageUrl)}`);
        }
        
        // Eski format: JSON data içinde görsel URL'i
        const jsonDataMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*({.+?});<\/script>/);
        if (jsonDataMatch) {
          try {
            const data = JSON.parse(jsonDataMatch[1]);
            const imageUrl = data?.image?.hash 
              ? `https://i.imgur.com/${data.image.hash}.jpg`
              : null;
            
            if (imageUrl) {
              const baseUrl = `https://${req.get('host')}`;
              return res.redirect(`${baseUrl}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`);
            }
          } catch (e) {
            console.error('JSON parse hatası:', e);
          }
        }
        
        throw new Error('Album sayfasından görsel URL\'i bulunamadı');
      } catch (albumError) {
        console.error('Imgur album hatası:', albumError);
        // Hata olsa bile normal proxy'ye devam et
      }
    }
    
    // Normal görsel proxy (ImageBB, direkt Imgur görselleri vb.)
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': url.origin
      },
      timeout: 10000 // 10 saniye timeout
    };
    
    const proxyReq = protocol.get(imageUrl, options, (proxyRes) => {
      // CORS header'ları ekle
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 gün cache
      
      // Status code'u kontrol et
      if (proxyRes.statusCode !== 200) {
        console.error('Proxy status code:', proxyRes.statusCode);
        return res.status(proxyRes.statusCode).json({ error: 'Görsel yüklenemedi: ' + proxyRes.statusCode });
      }
      
      // Görseli stream et
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (error) => {
      console.error('Image proxy hatası:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Görsel proxy hatası: ' + error.message });
      }
    });
    
    proxyReq.on('timeout', () => {
      console.error('Image proxy timeout');
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Görsel yükleme zaman aşımı' });
      }
    });
    
  } catch (error) {
    console.error('URL parse hatası:', error);
    res.status(400).json({ error: 'Geçersiz URL: ' + error.message });
  }
});

// REKLAM BANNER ENDPOINTS - Tüm aktif banner'ları döndür
app.get('/api/reklam-banner/:position', async (req, res) => {
  try {
    const position = req.params.position;
    
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        const banners = await bannersCollection
          .find({ position, active: true })
          .sort({ createdAt: -1 }) // En yeni önce
          .toArray();
        if (banners && banners.length > 0) {
          // ImageBB ve Imgur album URL'lerini proxy URL'ye çevir (Vercel'de her zaman HTTPS)
          const baseUrl = `https://${req.get('host')}`;
          const bannersWithProxy = banners.map(banner => {
            if (banner.imageUrl) {
              // ImageBB linklerini proxy üzerinden aç
              if (banner.imageUrl.includes('ibb.co') && !banner.imageUrl.includes('i.ibb.co')) {
                return {
                  ...banner,
                  imageUrl: `${baseUrl}/api/image-proxy?url=${encodeURIComponent(banner.imageUrl)}`
                };
              }
              // Imgur album linklerini proxy üzerinden aç
              if (banner.imageUrl.includes('imgur.com/a/')) {
                return {
                  ...banner,
                  imageUrl: `${baseUrl}/api/image-proxy?url=${encodeURIComponent(banner.imageUrl)}`
                };
              }
            }
            return banner;
          });
          return res.json({ banners: bannersWithProxy });
        }
      } catch (error) {
        console.error('MongoDB banner okuma hatası:', error);
      }
    }
    
    const banners = database.reklamBannerlar.filter(b => b.position === position && b.active);
    const sortedBanners = banners.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // ImageBB ve Imgur album URL'lerini proxy URL'ye çevir (Vercel'de her zaman HTTPS)
    const baseUrl = `https://${req.get('host')}`;
    const bannersWithProxy = sortedBanners.map(banner => {
      if (banner.imageUrl) {
        // ImageBB linklerini proxy üzerinden aç
        if (banner.imageUrl.includes('ibb.co') && !banner.imageUrl.includes('i.ibb.co')) {
          return {
            ...banner,
            imageUrl: `${baseUrl}/api/image-proxy?url=${encodeURIComponent(banner.imageUrl)}`
          };
        }
        // Imgur album linklerini proxy üzerinden aç
        if (banner.imageUrl.includes('imgur.com/a/')) {
          return {
            ...banner,
            imageUrl: `${baseUrl}/api/image-proxy?url=${encodeURIComponent(banner.imageUrl)}`
          };
        }
      }
      return banner;
    });
    
    res.json({ banners: bannersWithProxy });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/banners', async (req, res) => {
  try {
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        const banners = await bannersCollection
          .find({})
          .sort({ position: 1, createdAt: -1 })
          .toArray();
        return res.json(banners);
      } catch (error) {
        console.error('MongoDB banner listesi hatası:', error);
      }
    }
    
    res.json(database.reklamBannerlar.sort((a, b) => {
      if (a.position !== b.position) return a.position.localeCompare(b.position);
      return new Date(b.createdAt) - new Date(a.createdAt);
    }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Imgur ve ImageBB linklerini direkt görsel linkine çevir
function convertImageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  
  const trimmedUrl = url.trim();
  
  // ImageBB linki: https://ibb.co/xxxxx -> proxy üzerinden aç
  if (trimmedUrl.includes('ibb.co')) {
    // Eğer zaten i.ibb.co formatındaysa (direkt görsel linki) olduğu gibi döndür
    if (trimmedUrl.includes('i.ibb.co')) {
      return trimmedUrl;
    }
    // ibb.co/xxxxx formatındaysa proxy üzerinden açılacak şekilde işaretle
    // Bu URL'ler banner eklenirken proxy URL'ye çevrilecek
    return trimmedUrl;
  }
  
  // Imgur album linki: https://imgur.com/a/xxxxx veya https://imgur.com/a/xxxxx.jpg
  // Album linklerinden direkt görsel almak güvenilir değil, proxy üzerinden aç
  const albumMatch = trimmedUrl.match(/imgur\.com\/a\/([a-zA-Z0-9]+)(\.[a-z]+)?/);
  if (albumMatch) {
    const imageId = albumMatch[1];
    // Album linklerini proxy üzerinden açmak için orijinal URL'i döndür
    // Banner eklenirken proxy URL'ye çevrilecek
    return trimmedUrl;
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
      bannerCount = database.reklamBannerlar.filter(b => b.position === String(position).trim()).length;
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
    
    // MongoDB'ye kaydet (ZORUNLU - Vercel serverless için)
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        await bannersCollection.insertOne(banner);
        console.log('✅ Banner MongoDB\'ye kaydedildi:', banner.position, 'Toplam:', bannerCount + 1);
        
        // Başarılı olduysa response döndür
        return res.json({ success: true, message: 'Banner kaydedildi', banner, totalBanners: bannerCount + 1 });
      } catch (error) {
        console.error('❌ MongoDB banner kayıt hatası:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Banner kaydedilemedi: ' + error.message + '. Lütfen MongoDB bağlantısını kontrol edin.' 
        });
      }
    } else {
      // MongoDB bağlantısı yoksa hata döndür (Vercel'de memory database çalışmaz)
      console.error('❌ MongoDB bağlantısı yok!');
      return res.status(500).json({ 
        success: false, 
        error: 'MongoDB bağlantısı yok. Banner kaydedilemedi. Lütfen MONGODB_URI environment variable\'ını kontrol edin.' 
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/banner/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
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
    
    const index = database.reklamBannerlar.findIndex(b => b.id === id);
    if (index !== -1) {
      database.reklamBannerlar.splice(index, 1);
      res.json({ success: true, message: 'Banner silindi' });
    } else {
      res.status(404).json({ success: false, error: 'Banner bulunamadı' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;