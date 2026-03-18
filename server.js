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

// Uygulama ayarları - zorunlu güncelleme kontrolü için
const appSettings = {
  app_status: 'active',
  maintenance_message: 'Uygulama bakım modundadır.',
  min_version: process.env.MIN_VERSION || '1.2.1',
  store_url_android: process.env.STORE_URL_ANDROID || 'https://play.google.com/store/apps/details?id=com.knightrehber.app',
  store_url_ios: process.env.STORE_URL_IOS || 'https://apps.apple.com/tr/app/knight-rehber/id6756941925'
};

// Eski projeye (@ceylan26) ait token blacklist - bu token'lar gönderim ve listelemeden hariç tutulur
const BLACKLISTED_PUSH_TOKENS = (process.env.BLACKLISTED_PUSH_TOKENS || [
  'ExponentPushToken[7sdzYUFq22KgVTyRG09Yw-]',
  'ExponentPushToken[DsFoEKHv6VWSRHPy6JqD7q]',
  'ExponentPushToken[GnmXG6NCLtdLzdNFcMZv_u]',
  'ExponentPushToken[nGhpwUMUcCdjl54RRadIJE]',
  'ExponentPushToken[PlozzGJ_-nG2Ixt4w3Oj37]'
].join(',')).split(',').map(s => s.trim()).filter(Boolean);

// Blacklist set'ini oluştur (statik + MongoDB) - tek sorgu ile
const getBlacklistSet = async (dbInstance) => {
  const set = new Set(BLACKLISTED_PUSH_TOKENS.map(b => String(b).trim()));
  if (dbInstance) {
    try {
      const list = await dbInstance.collection('push_token_blacklist').find({}).project({ token: 1 }).toArray();
      list.forEach(x => set.add(String(x.token).trim()));
    } catch (e) {
      /* ignore */
    }
  }
  return set;
};

// Token blacklist'te mi (senkron - sadece statik liste, hızlı kontrol için)
const isTokenBlacklisted = (token) => {
  if (!token || typeof token !== 'string') return false;
  const t = String(token).trim();
  return BLACKLISTED_PUSH_TOKENS.some(b => t === b || t === String(b).trim());
};

// Reklam Banner'ları - position: 'home', 'merchant', 'goldbar', 'karakter', 'skill', 'chardiz'
let reklamBannerlar = [];

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
// MongoDB bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || '';
let mongoClient = null;
let db = null;

// MongoDB bağlantısını başlat (Vercel serverless için optimize)
// Vercel serverless'ta global değişkenler instance'lar arasında paylaşılmaz
// Her istekte yeni bağlantı oluşturmak yerine, bağlantıyı global scope'da tutmaya çalışıyoruz
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
    // Connection string'den database adını çıkar veya varsayılan kullan
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

// Uygulama başlangıcında MongoDB'ye bağlan
connectToMongoDB().catch(console.error);

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

  // experienceId null / YOK / boş -> gönderimde "yok" say (kartkedi batch'ine gidecek)
  const expIdOrNull = (v) => {
    const s = v ? String(v).trim() : '';
    if (!s || s.toUpperCase() === 'YOK') return null;
    return s;
  };
  const validTokens = tokenObjects
    .map(t => ({
      token: String(t.token).trim(),
      experienceId: expIdOrNull(t.experienceId),
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

  // kartkedi + nullExpId aynı anda tek batch: hepsini @kartkedi grubuna koy. ceylan26 varsa 400'de blacklist'lenir, retry'da sadece kartkedi'ye gider.
  const tokensByExpId = {};
  const DEFAULT_EXP_ID = '@kartkedi/knight-rehber';
  validTokens.forEach(t => {
    // iOS + null experienceId -> kartkedi ile aynı batch'e (ceylan26 olanlar 400'de atlanır)
    if (!t.experienceId && t.platform === 'ios') {
      if (!tokensByExpId[DEFAULT_EXP_ID]) tokensByExpId[DEFAULT_EXP_ID] = [];
      tokensByExpId[DEFAULT_EXP_ID].push(t.token);
      return;
    }
    // Android veya platform bilinmeyen + null experienceId -> kartkedi batch
    if (!t.experienceId && (t.platform === 'android' || !t.platform)) {
      if (!tokensByExpId[DEFAULT_EXP_ID]) tokensByExpId[DEFAULT_EXP_ID] = [];
      tokensByExpId[DEFAULT_EXP_ID].push(t.token);
      return;
    }
    // experienceId'si olan token'lar -> experienceId'ye göre grupla (sadece @kartkedi dışı projeler ayrı kalır)
    if (t.experienceId) {
      const expId = t.experienceId;
      if (!tokensByExpId[expId]) tokensByExpId[expId] = [];
      tokensByExpId[expId].push(t.token);
      return;
    }
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
        // PUSH_TOO_MANY_EXPERIENCE_IDS: Projelere göre ayrı ayrı gönder - kartkedi + ceylan26 hepsi gitsin
        if (response.status === 400 && errorText.includes('PUSH_TOO_MANY_EXPERIENCE_IDS')) {
          try {
            const errJson = JSON.parse(errorText);
            const details = errJson?.errors?.[0]?.details;
            if (details && typeof details === 'object') {
              totalFailed -= tokens.length;
              const expoHeaders = {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              };
              const buildMessage = (token) => ({
                to: token,
                sound: 'default',
                title: title,
                body: message,
                data: { title, message, ...(imageUrl && { imageUrl }) },
                priority: 'high',
                badge: 1
              });
              for (const [project, tokenList] of Object.entries(details)) {
                if (!Array.isArray(tokenList) || tokenList.length === 0) continue;
                console.log(`📤 ${project} - ${tokenList.length} token'a ayrı istek gönderiliyor...`);
                const projectMessages = tokenList.map(buildMessage);
                const projectResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                  method: 'POST',
                  headers: expoHeaders,
                  body: JSON.stringify(projectMessages),
                });
                if (projectResponse.ok) {
                  const projectResult = await projectResponse.json();
                  const okCount = projectResult.data?.filter(r => r.status === 'ok').length || 0;
                  const failCount = projectResult.data?.filter(r => r.status !== 'ok').length || 0;
                  totalSuccess += okCount;
                  totalFailed += failCount;
                  if (projectResult.data) {
                    projectResult.data.forEach((item, idx) => {
                      if (item.status === 'ok') {
                        console.log(`✅ ${project} - Token ${idx + 1}: OK`);
                      } else {
                        console.error(`❌ ${project} - Token ${idx + 1}: ${item.message || item.status}`);
                      }
                    });
                  }
                  console.log(`✅ ${project}: ${okCount} ulaştı, ${failCount} hata`);
                } else {
                  totalFailed += tokenList.length;
                  const errBody = await projectResponse.text();
                  console.error(`❌ ${project} isteği başarısız:`, projectResponse.status, errBody?.substring(0, 200));
                }
              }
            }
          } catch (parseErr) {
            console.error('PUSH_TOO_MANY_EXPERIENCE_IDS parse hatası:', parseErr?.message);
          }
        }
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

      // Hata alan token'ları blacklist'e EKLEME - güncel cihazlar engellenmesin, her gönderimde tekrar denenecek
      
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
    let kartkediCount = 0;
    let ceylan26Count = 0;
    let mike0835Count = 0;
    let nullExpIdCount = 0;
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        const allT = await tokensCollection.find({}).toArray();
        tokens = allT;
        tokenCount = tokens.length;
        
        // ExperienceId'ye göre say (tüm tokenlar)
        kartkediCount = tokens.filter(t => t.experienceId === '@kartkedi/knight-rehber').length;
        ceylan26Count = tokens.filter(t => t.experienceId === '@ceylan26/knight-rehber').length;
        mike0835Count = tokens.filter(t => t.experienceId === '@mike0835/knight-rehber').length;
        nullExpIdCount = tokens.filter(t => !t.experienceId || t.experienceId === '').length;
      } catch (error) {
        console.error('❌ MongoDB token okuma hatası:', error.message);
      }
    }

    res.json({
      hasMongoUri: hasEnv,
      isConnected: isMongoConnected,
      tokenCount,
      kartkediCount,
      ceylan26Count,
      mike0835Count,
      nullExpIdCount,
      tokens: tokens.map(t => ({
        token: t.token.substring(0, 30) + '...',
        experienceId: t.experienceId || 'YOK',
        updatedAt: t.updatedAt
      })),
      memoryTokens: userTokens.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  let tokenCount = 0;
  let mongoTokenCount = 0;
  let memoryTokenCount = userTokens.length;
  
  // MongoDB'deki toplam token sayısı (panelde doğru sayı görünsün, hepsine bildirim gidecek)
  const isMongoConnected = await connectToMongoDB();
  if (isMongoConnected && db) {
    try {
      const tokensCollection = db.collection('push_tokens');
      const allT = await tokensCollection.find({}).toArray();
      mongoTokenCount = allT.length;
      console.log('📊 MongoDB toplam token sayısı:', mongoTokenCount);
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
          .limit(500)
          .toArray();
        console.log('📊 MongoDB\'den token listesi alındı (tümü, hepsine bildirim gidecek):', tokens.length);
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

// OPTIONS preflight handling - iPhone 14+ için önemli
app.options('/api/push/register', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, User-Agent, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Connection', 'keep-alive');
  res.status(200).end();
});

// Push token kaydet
app.post('/api/push/register', async (req, res) => {
  try {
    const { token, experienceId, platform } = req.body || {};
    
    console.log('📱 Push token kayıt isteği geldi:', token ? 'Token var' : 'Token yok');
    console.log('📱 Platform:', platform || 'Belirtilmemiş');
    console.log('📱 Experience ID:', experienceId || 'Yok (iOS olabilir)');
    
    if (!token) {
      console.log('❌ Token gerekli');
      return res.status(400).json({ success: false, error: 'Token gerekli' });
    }

    const tokenStr = String(token).trim();
    const expId = experienceId ? String(experienceId).trim() : null;
    const platformStr = platform ? String(platform).trim().toLowerCase() : null;
    
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
        const userAgent = req.headers['user-agent'] || 'unknown';
        const isIPhone14Plus = /iPhone.*1[4-9]|iPhone.*2[0-9]/.test(userAgent) || /iPhone.*OS.*1[6-9]/.test(userAgent);
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
    let mongoError = null;
    
    // MongoDB'ye bağlanmayı dene
    const isMongoConnected = await connectToMongoDB();
    
    if (isMongoConnected && db) {
      try {
        const tokensCollection = db.collection('push_tokens');
        
        // ✅ TÜM TOKEN'LARA GÖNDER (blacklist dahil) - Alamayan almasın, Expo/retry halledecek
        const allTokens = await tokensCollection.find({}).toArray();
        const blacklistSet = await getBlacklistSet(db);
        const blacklistedCount = allTokens.filter(t => blacklistSet.has(String(t.token || '').trim())).length;
        if (blacklistedCount > 0) {
          console.log(`📤 Tüm tokenlere gönderiliyor (blacklist'teki ${blacklistedCount} token dahil), alamayan almasın.`);
        }
        console.log('📊 MongoDB\'de toplam token sayısı (hepsi gönderilecek):', allTokens.length);
        
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
        tokensToSend = userTokens.filter(t => t && t.trim());
        console.log('📊 Fallback: Memory database\'den token sayısı:', tokensToSend.length);
      }
    } else {
      // MongoDB bağlantısı yok
      mongoError = 'MongoDB bağlantısı yok';
      // Fallback: Memory database
      tokensToSend = userTokens.filter(t => t && t.trim());
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

// Bildirimleri listele
app.get('/api/admin/notifications', (req, res) => {
  res.json(bildirimler.slice(0, 20));
});

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
          .toArray();
        
        console.log('📊 MongoDB\'den güncelleme notları okundu:', updates.length, 'adet');
        
        if (updates && updates.length > 0) {
          return res.json(updates);
        }
      } catch (error) {
        console.error('MongoDB güncelleme okuma hatası:', error);
      }
    }
    
    // Fallback: Memory database
    res.json(guncellemeler);
  } catch (error) {
    console.error('Güncelleme listesi hatası:', error);
    res.json(guncellemeler); // Fallback
  }
});

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
    const update = {
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
      await updatesCollection.insertOne(update);
      console.log('✅ Güncelleme MongoDB\'ye kaydedildi:', update.title, 'ID:', update.id);
      console.log('✅ Collection: guncelleme_notlari');
      
      // Başarılı olduysa response döndür
      return res.json({ success: true, message: 'Güncelleme kaydedildi', update, totalUpdates: 1 });
    } catch (error) {
      console.error('❌ MongoDB güncelleme kayıt hatası:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Güncelleme kaydedilemedi: ' + error.message 
      });
    }
  } catch (error) {
    console.error('❌ HATA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/delete-update/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // MongoDB'den sil - guncelleme_notlari collection'ından
    const isMongoConnected = await connectToMongoDB();
    if (isMongoConnected && db) {
      try {
        const updatesCollection = db.collection('guncelleme_notlari');
        const result = await updatesCollection.deleteOne({ id });
        if (result.deletedCount > 0) {
          console.log('✅ Güncelleme MongoDB\'den silindi:', id);
          return res.json({ success: true, message: 'Silindi!' });
        }
      } catch (error) {
        console.error('MongoDB güncelleme silme hatası:', error);
      }
    }
    
    // Fallback: Memory database
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

// Uygulama durumu - zorunlu güncelleme kontrolü için (min_version)
app.get('/api/app-status', (req, res) => {
  res.json({
    status: appSettings.app_status,
    maintenance: appSettings.app_status === 'maintenance',
    maintenanceMessage: appSettings.maintenance_message,
    min_version: appSettings.min_version,
    store_url_android: appSettings.store_url_android,
    store_url_ios: appSettings.store_url_ios
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
    res.json(guncellemeler.slice(0, 10));
  } catch (error) {
    console.error('Güncelleme notları hatası:', error);
    res.json(guncellemeler.slice(0, 10)); // Fallback
  }
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
            const imageUrlFromData = data?.image?.hash 
              ? `https://i.imgur.com/${data.image.hash}.jpg`
              : null;
            
            if (imageUrlFromData) {
              const baseUrl = `https://${req.get('host')}`;
              return res.redirect(`${baseUrl}/api/image-proxy?url=${encodeURIComponent(imageUrlFromData)}`);
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
    
    // Fallback: Memory database - tüm aktif banner'lar
    const banners = reklamBannerlar.filter(b => b.position === position && b.active);
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
