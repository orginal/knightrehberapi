export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body;

    // Basit admin giriş kontrolü - production'da daha güvenli yapın
    const adminUsers = [
      { username: 'admin', password: 'admin123', role: 'superadmin' },
      { username: 'moderator', password: 'mod123', role: 'moderator' }
    ];

    const user = adminUsers.find(u => u.username === username && u.password === password);

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
    }

    // JWT token oluşturabilirsiniz, şimdilik basit tutuyoruz
    res.status(200).json({
      success: true,
      user: {
        username: user.username,
        role: user.role
      },
      token: 'demo-token-' + Date.now()
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}