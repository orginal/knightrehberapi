const express = require('express');
const cors = require('cors');
const path = require('path');

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

const ADMIN_USER = 'Aga';
const ADMIN_PASS = '2312631';

// ========== ADMIN API ==========

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ success: true, token: 'admin-token-123' });
  } else {
    res.status(401).json({ success: false, error: 'Yanlış kullanıcı adı veya şifre' });
  }
});

app.get('/api/admin/stats', (req, res) => {
  res.json({
    totalUsers: 0,
    activeUsers: 0,
    sentNotifications: 0,
    usersWithPushToken: 0,
    appVersion: '1.0.0',
    appStatus: 'active'
  });
});

app.get('/api/admin/updates', (req, res) => {
  res.json(guncellemeler);
});

app.post('/api/admin/add-update', (req, res) => {
  try {
    const { title, content, importance } = req.body || {};

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
