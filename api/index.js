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

// Middleware - iPhone 14+ için optimize edilmiş CORS ve timeout ayarları
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'User-Agent', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false,
  maxAge: 86400, // 24 saat preflight cache
  optionsSuccessStatus: 200 // iPhone 14+ için önemli
}));

// Request timeout ayarları - iPhone 14+ için daha uzun timeout
app.use((req, res, next) => {
  // Request timeout'u 30 saniyeye çıkar (iPhone 14+ network stack için)
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // iPhone 14+ için özel header'lar
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=30, max=1000');
  
  // PAC (Proxy Auto-Configuration) desteği için
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
});

app.use(express.json({ limit: '10mb' })); // Request body limit artırıldı
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
      serverSelectionTimeoutMS: 30000, // 30 saniye timeout (iPhone 14+ network stack için)
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10, // Connection pool size artırıldı
      minPoolSize: 1,
      maxIdleTimeMS: 30000,
      maxPoolSize: 1, // Serverless için 1 yeterli
      minPoolSize: 0,
      maxIdleTimeMS: 30000
    });
    
    await mongoClient.connect();
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'knightrehber';
    db = mongoClient.db(dbName);
    
    // ✅ GÜNCELLEME NOTLARI İÇİN AYRI COLLECTION OLUŞTURMA - ÖNEMLİ!
    try {
      const collections = await db.listCollections({ name: 'guncelleme_notlari' }).toArray();
      if (collections.length === 0) {
        console.log('📦 guncelleme_notlari collection yok, oluşturuluyor...');
        try {
          await db.createCollection('guncelleme_notlari');
          console.log('✅ Collection oluşturuldu: guncelleme_notlari');
        } catch (createError) {
          console.log('ℹ️ Collection oluşturma hatası (normal olabilir):', createError.message);
        }
      } else {
        console.log('✅ Collection mevcut: guncelleme_notlari');
      }
    } catch (collectionError) {
      console.log('ℹ️ Collection kontrolü hatası (normal olabilir):', collectionError.message);
    }
    
    // ✅ TTL Index kontrolü ve kaldırma - guncelleme_notlari collection'ı için
    try {
      const updatesCollection = db.collection('guncelleme_notlari');
      const indexes = await updatesCollection.indexes();
      
      let ttlIndexFound = false;
      for (const index of indexes) {
        if (index.expireAfterSeconds !== undefined && index.expireAfterSeconds !== null) {
          ttlIndexFound = true;
          console.log('⚠️⚠️⚠️ TTL INDEX BULUNDU:', index.name);
          try {
            await updatesCollection.dropIndex(index.name);
            console.log('✅ TTL index kaldırıldı:', index.name);
          } catch (dropError) {
            console.error('❌ TTL index kaldırma hatası:', dropError.message);
            try {
              await updatesCollection.dropIndexes();
              console.log('✅ Tüm index\'ler kaldırıldı');
            } catch (dropAllError) {
              console.error('❌ Tüm index\'leri kaldırma hatası:', dropAllError.message);
            }
          }
        }
      }
      
      if (!ttlIndexFound) {
        console.log('✅ TTL index bulunamadı, güncelleme notları silinmeyecek');
      }
    } catch (ttlError) {
      console.log('ℹ️ TTL index kontrolü hatası (normal olabilir):', ttlError.message);
    }
    
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
    min_version: '1.2.1',
    store_url_android: 'https://play.google.com/store/apps/details?id=com.knightrehber.app',
    store_url_ios: 'https://apps.apple.com/tr/app/knight-rehber/id6756941925'
  },
  reklamBannerlar: []
};

// Expo Push Notification gönderme fonksiyonu
// pushTokens: Array of {token: string, experienceId: string|null} veya string array
async function sendExpoPushNotification(pushTokens, title, message, imageUrl = null) {
  if (!pushTokens || pushTokens.length === 0) {
    console.log('⚠️ Push token yok, bildirim gönderilemedi');
    return { success: 0, failed: 0, error: 'Push token bulunamadı' };
  }

  // Expo Push API bazı string alanlar için max uzunluk kuralı uygular.
  // Payload'daki herhangi bir stringin sınırı aşması durumunda tüm istek 400 ile reddedilebilir.
  const truncateExpoString = (value, max = 100) => {
    if (value === undefined || value === null) return value;
    const str = String(value);
    return str.length > max ? str.slice(0, max) : str;
  };

  const safeTitle = truncateExpoString(title, 100);
  const safeMessage = truncateExpoString(message, 100);
  const safeImageUrl = imageUrl ? truncateExpoString(imageUrl, 100) : null;

  // Token'ları normalize et: eğer string array ise object array'e çevir
  const tokenObjects = pushTokens.map(t => {
    if (typeof t === 'string') {
      return { token: t, experienceId: null, platform: null };
    }
    return { 
      token: t.token || t, 
      experienceId: t.experienceId || null,
      platform: t.platform || null
    };
  });

  // Token'ları temizle ve geçerli olanları filtrele
  const validTokens = tokenObjects
    .map(t => ({
      token: String(t.token).trim(),
      experienceId: t.experienceId ? String(t.experienceId).trim() : null,
      platform: t.platform ? String(t.platform).trim().toLowerCase() : null
    }))
    .filter(t => t.token && t.token.startsWith('ExponentPushToken[') && t.token.length > 20);

  if (validTokens.length === 0) {
    console.log('⚠️ Geçerli push token yok');
    return { success: 0, failed: 0, error: 'Geçerli push token bulunamadı' };
  }

  console.log(`📤 ${validTokens.length} cihaza bildirim gönderiliyor...`);
  console.log(`📤 Bildirim başlığı: "${title}"`);
  console.log(`📤 Bildirim mesajı: "${message}"`);

  // Token'ları experienceId'ye göre grupla
  // iOS token'ları (platform='ios' ve experienceId=null) tek grup olarak gönderilebilir
  // Diğer experienceId olmayan token'lar atlanır (farklı projelere ait olabilir)
  const tokensByExpId = {};
  validTokens.forEach(t => {
    // iOS token'ları: platform='ios' ve experienceId=null -> 'IOS_NO_EXP_ID' grubuna ekle
    if (!t.experienceId && t.platform === 'ios') {
      const expId = 'IOS_NO_EXP_ID';
      if (!tokensByExpId[expId]) {
        tokensByExpId[expId] = [];
      }
      tokensByExpId[expId].push(t.token);
      return;
    }
    
    // experienceId'si olan token'lar -> experienceId'ye göre grupla
    if (t.experienceId) {
      const expId = t.experienceId;
      if (!tokensByExpId[expId]) {
        tokensByExpId[expId] = [];
      }
      tokensByExpId[expId].push(t.token);
      return;
    }
    
    // experienceId olmayan ve iOS olmayan token'lar atlanır
    console.log(`⚠️ Token atlandı (experienceId yok, platform: ${t.platform || 'bilinmiyor'}): ${t.token.substring(0, 30)}...`);
  });

  console.log(`📊 Token'lar ${Object.keys(tokensByExpId).length} experienceId grubuna ayrıldı:`);
  Object.keys(tokensByExpId).forEach(expId => {
    console.log(`  - ${expId || 'null'}: ${tokensByExpId[expId].length} token`);
  });

  let totalSuccess = 0;
  let totalFailed = 0;
  let allErrorDetails = [];

  // Her experienceId grubu için ayrı request gönder
  for (const [expId, tokens] of Object.entries(tokensByExpId)) {
    try {
      console.log(`📤 ${expId || 'null'} experienceId için ${tokens.length} token'a bildirim gönderiliyor...`);
      
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: safeTitle,
        body: safeMessage,
        data: { title: safeTitle, message: safeMessage, ...(safeImageUrl && { imageUrl: safeImageUrl }) },
        priority: 'high',
        badge: 1
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
      
      console.log(`📤 ${expId || 'null'} - Expo Push API response status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ ${expId || 'null'} - Expo Push API hatası:`, response.status, errorText);
        totalFailed += tokens.length;
        allErrorDetails.push({
          experienceId: expId,
          status: response.status,
          message: errorText,
          tokenCount: tokens.length
        });
        continue;
      }

      const result = await response.json();
      
      // Her bir token için detaylı log
      if (result.data && Array.isArray(result.data)) {
        result.data.forEach((item, index) => {
          if (item.status === 'ok') {
            console.log(`✅ ${expId || 'null'} - Token ${index + 1}: OK - ${item.id || 'ID yok'}`);
          } else {
            console.error(`❌ ${expId || 'null'} - Token ${index + 1}: ${item.status} - ${item.message || 'Bilinmeyen hata'}`);
          }
        });
      }

      const successCount = result.data?.filter(r => r.status === 'ok').length || 0;
      const failedCount = result.data?.filter(r => r.status !== 'ok').length || 0;
      
      totalSuccess += successCount;
      totalFailed += failedCount;
      
      // Hata detaylarını topla
      if (failedCount > 0) {
        const errors = result.data?.filter(r => r.status !== 'ok');
        allErrorDetails.push(...errors.map(e => ({
          experienceId: expId,
          status: e.status,
          message: e.message || 'Bilinmeyen hata',
          details: e.details || null
        })));
      }
    } catch (error) {
      console.error(`❌ ${expId || 'null'} - Expo Push Notification hatası:`, error.message);
      totalFailed += tokens.length;
      allErrorDetails.push({
        experienceId: expId,
        error: error.message
      });
    }
  }

  console.log(`✅ Toplam: ${totalSuccess} başarılı, ❌ ${totalFailed} başarısız`);

  return { 
    success: totalSuccess, 
    failed: totalFailed, 
    errorDetails: allErrorDetails 
  };
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


// Admin credentials - Environment variables kullan (güvenlik için)
// ⚠️ LOCAL: .env.local dosyasında tanımlayın
// ⚠️ PRODUCTION: Vercel'de Environment Variables ayarlayın
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

// Environment variable'lar kontrolü - CRITICAL!
if (!ADMIN_USER || !ADMIN_PASS) {
  console.error('❌ HATA: ADMIN_USER ve ADMIN_PASS environment variable\'ları ayarlanmalı!');
  console.error('❌ LOCAL GELİŞTİRME: Proje kökünde .env.local dosyası oluşturun');
  console.error('❌ PRODUCTION: Vercel Dashboard > Settings > Environment Variables');
  console.error('❌ Uygulama çalışmayacak! Lütfen bu değişkenleri ayarlayın.');
  
  // Uygulamanın çalışmaya devam etmemesi için hata fırlat
  throw new Error('Admin credentials not configured. Check environment variables.');
}

  if (String(username).trim().toLowerCase() === ADMIN_USER.toLowerCase() && String(password).trim() === ADMIN_PASS) {
    res.json({
      success: true,
      token: 'admin-token-2024',
      user: { username: ADMIN_USER, role: 'admin' }
    });
  } else {
    res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
  }
});

// İstatistikler
app.get('/api/admin/stats', async (req, res) => {
  let tokenCount = 0;
  let mongoTokenCount = 0;
  let memoryTokenCount = userTokens.length;
  
  // MongoDB'den token sayısını al
  const isMongoConnected = await connectToMongoDB();
  if (isMongoConnected && db) {
    try {
      const tokensCollection = db.collection('push_tokens');
      mongoTokenCount = await tokensCollection.countDocuments();
      console.log('📊 MongoDB token sayısı:', mongoTokenCount);
    } catch (error) {
      console.error('❌ MongoDB token sayısı hatası:', error.message);
    }
  }
  
  // Toplam token sayısı: MongoDB + Memory (eğer MongoDB'de yoksa memory'den)
  // Memory'deki token'lar MongoDB'de de olabilir, bu yüzden sadece MongoDB sayısını kullan
  // Ama MongoDB bağlantısı yoksa memory'den al
  if (isMongoConnected && db && mongoTokenCount > 0) {
    tokenCount = mongoTokenCount;
  } else {
    tokenCount = memoryTokenCount;
  }
  
  console.log('📊 Toplam token sayısı (istatistik):', tokenCount, '(MongoDB:', mongoTokenCount, ', Memory:', memoryTokenCount, ')');
  
  res.json({
    totalUsers: 0,
    activeUsers: 0,
    sentNotifications: bildirimler.length,
    usersWithPushToken: tokenCount,
    appVersion: '1.0.0',
    appStatus: 'active'
  });
});

// Token listesi (debug için)
app.get('/api/admin/tokens', async (req, res) => {
  try {
    const isMongoConnected = await connectToMongoDB();
    let tokens = [];
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        tokens = await tokensCollection.find({})
          .sort({ updatedAt: -1 })
          .limit(100)
          .toArray();
        console.log('📊 MongoDB\'den token listesi alındı:', tokens.length);
      } catch (error) {
        console.error('❌ MongoDB token listesi hatası:', error.message);
      }
    } else {
      // Memory'den al
      tokens = userTokens.map((token, index) => ({
        token: token.substring(0, 50) + '...',
        fullToken: token,
        source: 'memory',
        index: index
      }));
    }
    
    res.json({
      success: true,
      tokens: tokens.map(t => ({
        token: t.token ? t.token.substring(0, 50) + '...' : (t.fullToken ? t.fullToken.substring(0, 50) + '...' : 'N/A'),
        experienceId: t.experienceId || 'YOK',
        updatedAt: t.updatedAt || t.lastSeen || 'N/A',
        createdAt: t.createdAt || 'N/A'
      })),
      total: tokens.length,
      mongoConnected: isMongoConnected && db ? true : false
    });
  } catch (error) {
    console.error('❌ Token listesi hatası:', error);
    res.status(500).json({ success: false, error: error.message });
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
    database.notifications.unshift(bildirim);

    // Expo Push Notification gönder - MongoDB'den token'ları al
    let tokensToSend = [];
    let mongoError = null;
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        
        // ✅ TÜM TOKEN'LARI AL - ExperienceId'ye göre filtreleme YOK
        // Tüm platformlardan (Android, iOS) ve tüm experienceId'lerden token'ları al
        const allTokens = await tokensCollection.find({}).toArray();
        console.log('📊 MongoDB\'de toplam token sayısı:', allTokens.length);
        
        // ExperienceId'ye göre grupla (sadece log için)
        const tokensByExpId = {};
        allTokens.forEach(t => {
          const expId = t.experienceId || 'YOK (iOS)';
          if (!tokensByExpId[expId]) {
            tokensByExpId[expId] = [];
          }
          tokensByExpId[expId].push(t);
          console.log(`  - Token: ${t.token.substring(0, 30)}..., experienceId: ${expId}`);
        });
        
        // Her experienceId için sayı göster
        Object.keys(tokensByExpId).forEach(expId => {
          console.log(`📱 ${expId}: ${tokensByExpId[expId].length} token`);
        });
        
        // ✅ TÜM TOKEN'LARI experienceId ve platform ile birlikte al - Gruplama için
        tokensToSend = allTokens.map(t => ({
          token: t.token,
          experienceId: t.experienceId || null,
          platform: t.platform || null
        })).filter(t => t.token && t.token.trim());
        console.log('✅ MongoDB\'den toplam token sayısı (TÜM PLATFORMLAR):', tokensToSend.length);
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

// Güncelleme notu ekle
app.post('/api/admin/add-update', async (req, res) => {
  try {
    const { title, content, importance, imageUrl } = req.body || {};
    
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Başlık ve içerik gerekli' });
    }
    
    // MongoDB bağlantısı
    const isMongoConnected = await connectToMongoDB();
    
    if (!isMongoConnected || !db) {
      console.error('❌ MongoDB bağlantısı yok!');
      return res.status(500).json({ 
        success: false, 
        error: 'MongoDB bağlantısı yok. Güncelleme kaydedilemedi.' 
      });
    }
    
    // ✅ GÜNCELLEME NOTLARI İÇİN AYRI COLLECTION OLUŞTURMA - ÖNEMLİ!
    try {
      const collections = await db.listCollections({ name: 'guncelleme_notlari' }).toArray();
      if (collections.length === 0) {
        console.log('📦 guncelleme_notlari collection yok, oluşturuluyor...');
        try {
          await db.createCollection('guncelleme_notlari');
          console.log('✅ Collection oluşturuldu: guncelleme_notlari');
        } catch (createError) {
          console.log('ℹ️ Collection oluşturma hatası (normal olabilir):', createError.message);
        }
      } else {
        console.log('✅ Collection mevcut: guncelleme_notlari');
      }
    } catch (collectionError) {
      console.error('Collection kontrolü hatası:', collectionError.message);
    }
    
    // ✅ TTL INDEX KONTROLÜ VE KALDIRMA
    try {
      const updatesCollection = db.collection('guncelleme_notlari');
      const indexes = await updatesCollection.indexes();
      for (const index of indexes) {
        if (index.expireAfterSeconds !== undefined && index.expireAfterSeconds !== null) {
          console.log('⚠️⚠️⚠️ TTL INDEX BULUNDU, KALDIRILIYOR:', index.name);
          try {
            await updatesCollection.dropIndex(index.name);
            console.log('✅ TTL index kaldırıldı');
          } catch (dropError) {
            console.error('❌ TTL index kaldırma hatası:', dropError.message);
            try {
              await updatesCollection.dropIndexes();
              console.log('✅ Tüm index\'ler kaldırıldı');
            } catch (e) {
              console.error('❌ Tüm index\'leri kaldırma hatası:', e.message);
            }
          }
        }
      }
    } catch (indexError) {
      console.error('Index kontrolü hatası:', indexError.message);
    }
    
    // Güncelleme objesi
    const newUpdate = {
      id: Date.now(),
      title: String(title).trim(),
      content: String(content).trim(),
      importance: importance || 'normal',
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      date: new Date().toLocaleDateString('tr-TR'),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // MongoDB'ye kaydet - AYRI COLLECTION'A
    try {
      const updatesCollection = db.collection('guncelleme_notlari');
      await updatesCollection.insertOne(newUpdate);
      console.log('✅ Güncelleme MongoDB\'ye kaydedildi:', newUpdate.title, 'ID:', newUpdate.id);
      console.log('✅ Collection: guncelleme_notlari');
      
      // Başarılı olduysa response döndür
      return res.json({
        success: true,
        message: 'Güncelleme notu başarıyla eklendi!',
        update: newUpdate
      });
    } catch (error) {
      console.error('❌ MongoDB güncelleme kayıt hatası:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Güncelleme kaydedilemedi: ' + error.message 
      });
    }
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
  const { status, maintenanceMessage, min_version, store_url_android, store_url_ios } = req.body;

  database.appSettings.app_status = status || 'active';
  database.appSettings.maintenance_message = maintenanceMessage || 'Uygulama bakım modundadır.';
  if (min_version !== undefined) database.appSettings.min_version = min_version;
  if (store_url_android !== undefined) database.appSettings.store_url_android = store_url_android;
  if (store_url_ios !== undefined) database.appSettings.store_url_ios = store_url_ios;

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

// Güncelleme notlarını listele
app.get('/api/admin/updates', async (req, res) => {
  try {
    // MongoDB'den al - guncelleme_notlari collection'ından
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const updatesCollection = db.collection('guncelleme_notlari');
        const updates = await updatesCollection
          .find({}) // ✅ Tüm güncelleme notlarını al
          .sort({ createdAt: -1 }) // En yeni önce
          .limit(20)
          .toArray();
        
        if (updates && updates.length > 0) {
          return res.json(updates);
        }
      } catch (error) {
        console.error('MongoDB güncelleme okuma hatası:', error);
      }
    }
    
    // Fallback: Memory database
    res.json(database.updateNotes.slice(0, 20));
  } catch (error) {
    console.error('Güncelleme listesi hatası:', error);
    res.json(database.updateNotes.slice(0, 20)); // Fallback
  }
});

// Güncelleme notu sil
app.delete('/api/admin/delete-update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateId = parseInt(id);
    
    // MongoDB'den sil - guncelleme_notlari collection'ından
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const updatesCollection = db.collection('guncelleme_notlari');
        const result = await updatesCollection.deleteOne({ id: updateId });
        if (result.deletedCount > 0) {
          console.log('✅ Güncelleme MongoDB\'den silindi:', updateId);
          return res.json({
            success: true,
            message: 'Güncelleme notu başarıyla silindi'
          });
        }
      } catch (error) {
        console.error('MongoDB güncelleme silme hatası:', error);
      }
    }
    
    // Fallback: Memory database
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
    maintenanceMessage: database.appSettings.maintenance_message,
    min_version: database.appSettings.min_version || '1.0.0',
    store_url_android: database.appSettings.store_url_android || 'https://play.google.com/store/apps/details?id=com.knightrehber.app',
    store_url_ios: database.appSettings.store_url_ios || 'https://apps.apple.com/tr/app/knight-rehber/id6756941925'
  });
});

app.get('/api/guncelleme-notlari', async (req, res) => {
  try {
    // MongoDB'den al - guncelleme_notlari collection'ından
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const updatesCollection = db.collection('guncelleme_notlari');
        const updates = await updatesCollection
          .find({}) // ✅ Tüm güncelleme notlarını al
          .sort({ createdAt: -1 }) // En yeni önce
          .limit(10)
          .toArray();
        
        if (updates && updates.length > 0) {
          return res.json(updates);
        }
      } catch (error) {
        console.error('MongoDB güncelleme okuma hatası:', error);
      }
    }
    
    // Fallback: Memory database
    res.json(database.updateNotes.slice(0, 10));
  } catch (error) {
    console.error('Güncelleme notları hatası:', error);
    res.json(database.updateNotes.slice(0, 10)); // Fallback
  }
});

app.get('/api/nostalji-fotograflar', (req, res) => {
  res.json(database.nostaljiPhotos);
});

app.post('/api/stats', (req, res) => {
  const { userId, action } = req.body;
  console.log(`📊 İstatistik: ${userId} - ${action}`);
  res.json({ success: true });
});

// OPTIONS preflight handling - iPhone 14+ için önemli
app.options('/api/push/register', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, User-Agent, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Connection', 'keep-alive');
  res.status(200).end();
});

// Blacklist: Bu token'lar MongoDB'ye kaydedilmez (ceylan26 veya eski/geçersiz)
// BLACKLISTED_PUSH_TOKENS = "token1,token2" (virgülle ayrılmış tam Expo push token)
// BLACKLISTED_EXPERIENCE_IDS = "@user/dev-app" (belirli experienceId'leri engelle - örn. test projeleri)
const BLACKLISTED_PUSH_TOKENS_LIST = (process.env.BLACKLISTED_PUSH_TOKENS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const BLACKLISTED_EXPERIENCE_IDS_LIST = (process.env.BLACKLISTED_EXPERIENCE_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Push token kaydet
app.post('/api/push/register', async (req, res) => {
  try {
    const { token, experienceId, platform } = req.body || {};
    
    // iPhone 14+ için User-Agent loglama
    const userAgent = req.headers['user-agent'] || 'unknown';
    const isIPhone14Plus = /iPhone.*1[4-9]|iPhone.*2[0-9]/.test(userAgent) || /iPhone.*OS.*1[6-9]/.test(userAgent);
    
    console.log('📱 Push token kayıt isteği geldi:', token ? 'Token var' : 'Token yok');
    console.log('📱 Platform:', platform || 'Belirtilmemiş');
    console.log('📱 Experience ID:', experienceId || 'Yok (iOS olabilir)');
    console.log('📱 User-Agent:', userAgent);
    console.log('📱 iPhone 14+ tespit edildi:', isIPhone14Plus);
    
    if (!token) {
      console.log('❌ Token gerekli');
      return res.status(400).json({ success: false, error: 'Token gerekli' });
    }

    const tokenStr = String(token).trim();
    const expId = experienceId ? String(experienceId).trim() : null;
    const platformStr = platform ? String(platform).trim().toLowerCase() : null;
    
    // Eski/geçersiz token formatı – sadece geçerli Expo formatını kabul et
    const isValidFormat = tokenStr.startsWith('ExponentPushToken[') && tokenStr.endsWith(']') && tokenStr.length >= 30 && tokenStr.length <= 250;
    if (!isValidFormat) {
      console.log('❌ Eski/geçersiz token formatı, MongoDB\'ye kaydedilmedi:', tokenStr.substring(0, 40) + '...');
      return res.status(200).json({ success: true, message: 'Token formatı kabul edilmedi (eski/geçersiz)' });
    }
    
    // Blacklist – tam token eşleşmesi
    if (BLACKLISTED_PUSH_TOKENS_LIST.length > 0 && BLACKLISTED_PUSH_TOKENS_LIST.includes(tokenStr)) {
      console.log('❌ Blacklist: Token kaydedilmedi (engelli token listesi)');
      return res.status(200).json({ success: true, message: 'Token kabul edilmedi (blacklist)' });
    }
    
    // Blacklist – experienceId ile engelleme (test projeleri vb.)
    if (BLACKLISTED_EXPERIENCE_IDS_LIST.length > 0 && expId && BLACKLISTED_EXPERIENCE_IDS_LIST.includes(expId)) {
      console.log('❌ Blacklist: experienceId engelli:', expId);
      return res.status(200).json({ success: true, message: 'Token kabul edilmedi (experienceId blacklist)' });
    }
    
    console.log('📝 Token uzunluğu:', tokenStr.length);
    console.log('📝 Token formatı:', tokenStr.substring(0, 30) + '...');
    console.log('📝 Token başlangıcı:', tokenStr.startsWith('ExponentPushToken[') ? 'Doğru' : 'Hatalı');
    console.log('📝 Platform:', platformStr || 'Belirtilmemiş');
    console.log('📝 Experience ID:', expId || 'null (iOS veya belirtilmemiş)');
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      // MongoDB'ye kaydet
      try {
        const tokensCollection = db.collection('push_tokens');
        const updateData = {
          token: tokenStr,
          updatedAt: new Date(),
          lastSeen: new Date()
        };
        
        // ExperienceId sadece varsa ekle (iOS'ta null olabilir)
        if (expId) {
          updateData.experienceId = expId;
        }
        
        // Platform bilgisini ekle (iOS/Android)
        if (platformStr) {
          updateData.platform = platformStr;
        }
        
        const result = await tokensCollection.updateOne(
          { token: tokenStr },
          { 
            $set: updateData,
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true }
        );
        
        const totalTokens = await tokensCollection.countDocuments();
        console.log('✅ Push token MongoDB\'ye kaydedildi. Toplam:', totalTokens);
        console.log('📊 Platform:', platformStr || 'Belirtilmemiş');
        console.log('📊 Experience ID:', expId || 'null');
        console.log('📊 Upsert sonucu - Matched:', result.matchedCount, 'Modified:', result.modifiedCount, 'Upserted:', result.upsertedCount);
        
        // iPhone 14+ için özel response header'ları
        if (isIPhone14Plus) {
          res.setHeader('X-iPhone14Plus', 'true');
          res.setHeader('Connection', 'keep-alive');
        }
        
        res.json({ success: true, message: 'Token kaydedildi', totalTokens, platform: platformStr || 'unknown' });
        return;
      } catch (mongoError) {
        console.error('❌ MongoDB kayıt hatası:', mongoError.message);
        console.error('❌ MongoDB hata detayları:', mongoError);
        // MongoDB bağlantısı varsa ama kayıt başarısız olursa hata döndür
        // Memory'ye kaydetme - MongoDB çalışıyorsa oraya kaydetmeliyiz
        return res.status(500).json({ 
          success: false, 
          error: 'Token MongoDB\'ye kaydedilemedi: ' + mongoError.message 
        });
      }
    }
    
    // Fallback: Memory database (sadece MongoDB bağlantısı yoksa)
    console.log('⚠️ MongoDB bağlantısı yok, memory\'ye kaydediliyor...');
    console.log('📊 Mevcut token sayısı (kayıt öncesi):', userTokens.length);
    
    if (!userTokens.includes(tokenStr)) {
      userTokens.push(tokenStr);
      console.log('✅ Yeni push token memory\'ye kaydedildi. Toplam:', userTokens.length);
    } else {
      console.log('⚠️ Token zaten kayıtlı');
    }

    console.log('📊 Token kayıt sonrası toplam:', userTokens.length);
    res.json({ success: true, message: 'Token kaydedildi (memory - MongoDB bağlantısı yok)', totalTokens: userTokens.length });
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
        let banners = await bannersCollection
          .find({ position, active: true })
          .toArray();
        // order: 1 = en üstte (yoksa 999 = sona), sonra en yeni
        if (banners && banners.length > 0) {
          banners = banners.sort((a, b) => {
            const orderA = a.order != null ? a.order : 999;
            const orderB = b.order != null ? b.order : 999;
            if (orderA !== orderB) return orderA - orderB;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
        }
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
    const sortedBanners = banners.sort((a, b) => {
      const orderA = a.order != null ? a.order : 999;
      const orderB = b.order != null ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
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
          .sort({ position: 1, order: 1, createdAt: -1 })
          .toArray();
        return res.json(banners);
      } catch (error) {
        console.error('MongoDB banner listesi hatası:', error);
      }
    }
    
    res.json(database.reklamBannerlar.sort((a, b) => {
      if (a.position !== b.position) return a.position.localeCompare(b.position);
      const orderA = a.order != null ? a.order : 999;
      const orderB = b.order != null ? b.order : 999;
      if (orderA !== orderB) return orderA - orderB;
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
    const ext = directMatch[2] || '';
    // Uzantı yoksa .jpg'e zorlamayalım (Imgur bazen .png/.gif döndürüyor).
    // i.imgur.com/<id> çoğu durumda doğru dosyaya yönlendirir.
    return ext ? `https://i.imgur.com/${imageId}${ext}` : `https://i.imgur.com/${imageId}`;
  }
  
  // Zaten i.imgur.com formatındaysa olduğu gibi döndür
  if (trimmedUrl.includes('i.imgur.com')) {
    return trimmedUrl;
  }
  
  return trimmedUrl;
}

app.post('/api/admin/banner', async (req, res) => {
  try {
    const { position, imageUrl, clickUrl, active = true, order } = req.body || {};
    
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
    
    const orderNum = order != null && order !== '' ? parseInt(order, 10) : 999;
    const banner = {
      id: Date.now(),
      position: String(position).trim(),
      imageUrl: convertedImageUrl,
      clickUrl: clickUrl ? String(clickUrl).trim() : null,
      active: active !== false,
      order: isNaN(orderNum) ? 999 : orderNum,
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

// Banner sıralaması güncelle
app.patch('/api/admin/banner/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { order } = req.body || {};
    if (order == null || order === '') {
      return res.status(400).json({ success: false, error: 'order gerekli' });
    }
    const orderNum = parseInt(order, 10);
    if (isNaN(orderNum)) {
      return res.status(400).json({ success: false, error: 'Geçersiz sıra numarası' });
    }
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      const bannersCollection = db.collection('reklam_bannerlar');
      const result = await bannersCollection.updateOne(
        { id },
        { $set: { order: orderNum, updatedAt: new Date().toISOString() } }
      );
      if (result.matchedCount > 0) {
        return res.json({ success: true, message: 'Sıralama güncellendi' });
      }
    }
    return res.status(404).json({ success: false, error: 'Banner bulunamadı' });
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
