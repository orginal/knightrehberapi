const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || '';
let mongoClient = null;
let db = null;

async function connectToMongoDB() {
  if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI environment variable bulunamadı, memory database kullanılacak');
    return false;
  }

  try {
    if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
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

// Basit veritabanı (Fallback)
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

// Mock Push Notification fonksiyonu
async function sendPushNotification(pushToken, title, message) {
  try {
    console.log(`📤 Mock Push Notification: ${title} - ${message}`);
    console.log(`Token: ${pushToken}`);

    // Burada gerçek Expo, FCM vs. entegre edilebilir
    return true;
  } catch (error) {
    console.error('❌ Push notification hatası:', error);
    return false;
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

// Admin giriş (Fallback)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  const adminUsername = 'Aga';
  const adminPassword = '2312631';

  if (username === adminUsername && password === adminPassword) {
    res.json({
      success: true,
      token: 'admin-token-2024',
      user: { username: adminUsername, role: 'admin' }
    });
  } else {
    res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
  }
});

// İstatistikler (Fallback)
app.get('/api/admin/stats', (req, res) => {
  const usersWithToken = database.users.filter(u => u.pushToken).length;

  res.json({
    totalUsers: database.users.length,
    activeUsers: database.users.filter(u => {
      const lastActive = new Date(u.lastActive);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastActive > sevenDaysAgo;
    }).length,
    sentNotifications: database.notifications.length,
    usersWithPushToken: usersWithToken,
    appVersion: '1.0.0',
    appStatus: database.appSettings.app_status
  });
});

// Bildirim gönder (Fallback)
app.post('/api/admin/send-notification', async (req, res) => {
  const { title, message, target } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Başlık ve mesaj gerekli' });
  }

  try {
    const newNotification = {
      id: Date.now(),
      title,
      message,
      target: target || 'all',
      sent_count: database.users.filter(u => u.pushToken).length,
      total_users: database.users.length,
      failed_count: 0,
      created_at: new Date().toISOString()
    };

    database.notifications.unshift(newNotification);

    res.json({
      success: true,
      message: `Bildirim başarıyla gönderildi!`,
      notification: newNotification
    });

  } catch (error) {
    console.error('Bildirim gönderme hatası:', error);
    res.status(500).json({ error: 'Bildirim gönderilirken hata oluştu' });
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
          return res.json({ banners });
        }
      } catch (error) {
        console.error('MongoDB banner okuma hatası:', error);
      }
    }
    
    const banners = database.reklamBannerlar.filter(b => b.position === position && b.active);
    const sortedBanners = banners.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ banners: sortedBanners });
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
  
  // ImageBB linki: https://ibb.co/xxxxx -> https://i.ibb.co/xxxxx/xxxxx.jpg
  // ImageBB linkleri genellikle direkt görsel linki olarak kullanılmalı
  // Kullanıcıya direkt görsel linki kullanmasını öneriyoruz
  if (trimmedUrl.includes('ibb.co')) {
    // Eğer zaten i.ibb.co formatındaysa (direkt görsel linki) olduğu gibi döndür
    if (trimmedUrl.includes('i.ibb.co')) {
      return trimmedUrl;
    }
    // ibb.co/xxxxx formatındaysa kullanıcıya direkt görsel linki kullanmasını söyle
    // Ancak API'den döndürelim, mobil uygulama error handling yapsın
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
    
    if (isMongoConnected && db) {
      try {
        const bannersCollection = db.collection('reklam_bannerlar');
        await bannersCollection.insertOne(banner);
        console.log('✅ Banner MongoDB\'ye kaydedildi:', banner.position, 'Toplam:', bannerCount + 1);
      } catch (error) {
        console.error('MongoDB banner kayıt hatası:', error);
      }
    }
    
    database.reklamBannerlar.push(banner);
    
    res.json({ success: true, message: 'Banner kaydedildi', banner, totalBanners: bannerCount + 1 });
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