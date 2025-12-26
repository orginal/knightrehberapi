const API_BASE_URL = 'https://knight-rehber-admin.vercel.app/api';

let currentUser = null;
let currentTarget = 'all';

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', function() {
    // Target butonlarına tıklama event'leri
    document.querySelectorAll('.target-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentTarget = this.dataset.target;
        });
    });

    // Oturum kontrolü
    checkAuth();
});

// Giriş yap
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

    if (!username || !password) {
        errorDiv.textContent = 'Lütfen kullanıcı adı ve şifre giriniz.';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminUser', JSON.stringify(data.user));
            showAdminScreen();
            loadStats();
        } else {
            errorDiv.textContent = data.error || 'Giriş başarısız!';
        }
    } catch (error) {
        errorDiv.textContent = 'Giriş sırasında hata oluştu.';
        console.error('Login error:', error);
    }
}

// Çıkış yap
function logout() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    currentUser = null;
    showLoginScreen();
}

// Oturum kontrolü
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const user = localStorage.getItem('adminUser');

    if (token && user) {
        currentUser = JSON.parse(user);
        showAdminScreen();
        loadStats();
        loadNotificationHistory();
    } else {
        showLoginScreen();
    }
}

// Ekranları değiştir
function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('adminScreen').classList.remove('active');
}

function showAdminScreen() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('adminScreen').classList.add('active');
    document.getElementById('userRole').textContent = `${currentUser.username} (${currentUser.role})`;
}

// İstatistikleri yükle
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/stats`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('totalUsers').textContent = data.stats.totalUsers.toLocaleString();
            document.getElementById('activeUsers').textContent = data.stats.activeUsers.toLocaleString();
            document.getElementById('premiumUsers').textContent = data.stats.premiumUsers.toLocaleString();
        }
    } catch (error) {
        console.error('Load stats error:', error);
    }
}
