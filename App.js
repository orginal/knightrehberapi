import React, { useState, useEffect, useContext, createContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
  Modal,
  TextInput,
  Platform,
  Dimensions,
  Linking
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// API Yapılandırması
const API_BASE_URL = 'https://knight-rehber-admin.vercel.app/api'; // Kendi backend URL'niz
const APP_VERSION = '1.0.0';

// API servisleri
const ApiService = {
  // Push bildirim ayarları
  async registerForPushNotifications(userId, token) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          token,
          appVersion: APP_VERSION,
        }),
      });
      return await response.json();
    } catch (error) {
      console.log('Push notification kaydı hatası:', error);
      return null;
    }
  },

  // Güncelleme notlarını getir
  async getGuncellemeNotlari() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/guncelleme-notlari`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.log('Güncelleme notları yüklenirken hata:', error);
      return null;
    }
  },

  // Nostalji fotoğraflarını getir
  async getNostaljiFotograflar() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/nostalji-fotograflar`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.log('Nostalji fotoğrafları yüklenirken hata:', error);
      return null;
    }
  },

  // Uygulama istatistikleri gönder
  async sendAppStats(userId, action) {
    try {
      await fetch(`${API_BASE_URL}/api/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          action,
          timestamp: new Date().toISOString(),
          appVersion: APP_VERSION,
          platform: Platform.OS,
        }),
      });
    } catch (error) {
      console.log('İstatistik gönderilirken hata:', error);
    }
  },

  // Uygulama kontrolü (ban/update kontrolü)
  async checkAppStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/app-status`);
      return await response.json();
    } catch (error) {
      console.log('App status kontrolü hatası:', error);
      return { status: 'active', maintenance: false };
    }
  }
};

// Bildirim ayarları
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Bildirim kanalı oluştur (Android için)
const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarm-channel', {
      name: 'Alarm Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }
};

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appStatus, setAppStatus] = useState({ status: 'active', maintenance: false });

  // AsyncStorage fonksiyonları
  const saveUserToStorage = async (userData) => {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.log('Kullanıcı bilgileri kaydedilemedi:', error);
    }
  };

  const loadUserFromStorage = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (error) {
      console.log('Kullanıcı bilgileri yüklenemedi:', error);
    }
    return null;
  };

  const saveDisclaimerStatus = async (accepted) => {
    try {
      await AsyncStorage.setItem('disclaimerAccepted', JSON.stringify(accepted));
    } catch (error) {
      console.log('Sorumluluk reddi durumu kaydedilemedi:', error);
    }
  };

  const loadDisclaimerStatus = async () => {
    try {
      const status = await AsyncStorage.getItem('disclaimerAccepted');
      return status ? JSON.parse(status) : false;
    } catch (error) {
      console.log('Sorumluluk reddi durumu yüklenemedi:', error);
    }
    return false;
  };

  const saveAlarmsToStorage = async (userId, alarms) => {
    try {
      await AsyncStorage.setItem(`alarms_${userId}`, JSON.stringify(alarms));
    } catch (error) {
      console.log('Alarmlar kaydedilemedi:', error);
    }
  };

  const loadAlarmsFromStorage = async (userId) => {
    try {
      const alarms = await AsyncStorage.getItem(`alarms_${userId}`);
      return alarms ? JSON.parse(alarms) : {};
    } catch (error) {
      console.log('Alarmlar yüklenemedi:', error);
    }
    return {};
  };

  const saveUsersToStorage = async (usersData) => {
    try {
      await AsyncStorage.setItem('users', JSON.stringify(usersData));
    } catch (error) {
      console.log('Kullanıcılar kaydedilemedi:', error);
    }
  };

  const loadUsersFromStorage = async () => {
    try {
      const usersData = await AsyncStorage.getItem('users');
      return usersData ? JSON.parse(usersData) : [];
    } catch (error) {
      console.log('Kullanıcılar yüklenemedi:', error);
    }
    return [];
  };

  const saveAlarmTypeToStorage = async (alarmType) => {
    try {
      await AsyncStorage.setItem('alarmType', alarmType);
    } catch (error) {
      console.log('Alarm tipi kaydedilemedi:', error);
    }
  };

  const loadAlarmTypeFromStorage = async () => {
    try {
      const alarmType = await AsyncStorage.getItem('alarmType');
      return alarmType || 'notification';
    } catch (error) {
      console.log('Alarm tipi yüklenemedi:', error);
    }
    return 'notification';
  };

  // Push bildirim token'ını kaydet
  const registerPushToken = async (token) => {
    if (user) {
      await ApiService.registerForPushNotifications(user.id, token);
      await ApiService.sendAppStats(user.id, 'app_open');
    }
  };

  // Uygulama durumunu kontrol et
  const checkAppStatus = async () => {
    const status = await ApiService.checkAppStatus();
    setAppStatus(status);
    return status;
  };

  // Uygulama başlangıcında kayıtlı kullanıcıyı yükle
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const savedUsers = await loadUsersFromStorage();
        const savedDisclaimer = await loadDisclaimerStatus();

        if (savedUsers.length > 0) {
          setUsers(savedUsers);
        }

        // Otomatik olarak misafir kullanıcı oluştur
        const guestUser = {
          id: 'guest_' + Date.now(),
          email: 'guest@knightrehber.com',
          username: 'Misafir',
          phone: '',
          createdAt: new Date(),
          favorites: [],
          alarms: {},
          premium: false,
        };
        
        setUser(guestUser);
        await saveUserToStorage(guestUser);
        
        setDisclaimerAccepted(savedDisclaimer);
        setShowDisclaimer(!savedDisclaimer);

        // Uygulama durumunu kontrol et
        await checkAppStatus();

      } catch (error) {
        console.log('Uygulama başlatılırken hata:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const updateUser = async (updatedUser) => {
    setUser(updatedUser);
    const updatedUsers = users.map(u => u.id === updatedUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    await saveUserToStorage(updatedUser);
    await saveUsersToStorage(updatedUsers);
  };

  const acceptDisclaimer = async () => {
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
    await saveDisclaimerStatus(true);
  };

  return (
    <AuthContext.Provider value={{
      user,
      updateUser,
      users,
      showDisclaimer,
      setShowDisclaimer,
      disclaimerAccepted,
      acceptDisclaimer,
      saveAlarmsToStorage,
      loadAlarmsFromStorage,
      saveAlarmTypeToStorage,
      loadAlarmTypeFromStorage,
      isLoading,
      appStatus,
      checkAppStatus,
      registerPushToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Splash Screen
const SplashScreen = () => (
  <SafeAreaView style={{ flex: 1, backgroundColor: "#07070C" }}>
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: "#07070C"}}>
      <Image
        source={require('./assets/kapak.jpg')}
        style={{width: '100%', height: '100%', resizeMode: 'cover'}}
      />
    </View>
  </SafeAreaView>
);

// Header Component
const Header = ({ onOpenSettings }) => {
  const { user } = useAuth();

  return (
    <View style={styles.header}>
      <Text style={styles.title}>KNIGHT REHBER</Text>
      <TouchableOpacity style={styles.settingsWrap} onPress={onOpenSettings}>
        <View style={styles.settingsCircle}>
          <Text style={styles.settingsEmoji}>⚙️</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// WhatsApp Çekiliş Kutusu Bileşeni
const CekilisKutusu = () => {
  const WHATSAPP_CHANNEL_LINK = "https://whatsapp.com/channel/0029Vb6bmZE9RZATfks6gj3k";

  const handleWhatsappKatil = () => {
    Alert.alert(
      '📱 WhatsApp Kanalına Katıl',
      '✅ **GÜVENLİ KATILIM**\n\n' +
      '• Üyeler birbirini GÖREMEZ\n' +
      '• Telefon numaranız GİZLİ kalır\n' + 
      '• Sadece çekiliş duyuruları alırsınız\n' +
      '• İstediğiniz zaman çıkabilirsiniz\n\n' +
      'WhatsApp kanalına yönlendirileceksiniz.',
      [
        {text: 'İptal', style: 'cancel'},
        {text: 'Katıl', onPress: () => Linking.openURL(WHATSAPP_CHANNEL_LINK)}
      ]
    );
  };

  return (
    <View style={styles.cekilisCard}>
      <Text style={styles.cekilisTitle}>🎉 ÇEKİLİŞLER</Text>
      <Text style={styles.cekilisDescription}>
        Güncel çekilişler için WhatsApp kanalımıza katılın! Noah, item ve daha birçok ödül sizi bekiyor.
      </Text>
      
      <TouchableOpacity 
        style={styles.whatsappButton}
        onPress={handleWhatsappKatil}
      >
        <Text style={styles.whatsappButtonText}>📱 WhatsApp Kanalına Katıl</Text>
      </TouchableOpacity>

      <View style={styles.cekilisInfo}>
        <Text style={styles.cekilisInfoText}>• Katılım: WhatsApp kanalı</Text>
        <Text style={styles.cekilisInfoText}>• Kazanan açıklama: Kanalda</Text>
      </View>
    </View>
  );
};

// GÜNCELLENMİŞ Dinamik Güncelleme Notları Bileşeni
const GuncellemeNotlariKutusu = () => {
  const [guncellemeler, setGuncellemeler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadGuncellemeler = async () => {
    try {
      setLoading(true);
      
      // Önce backend'den güncellemeleri çek
      const backendGuncellemeler = await ApiService.getGuncellemeNotlari();
      
      if (backendGuncellemeler && backendGuncellemeler.length > 0) {
        // Backend'den gelen verileri kullan
        setGuncellemeler(backendGuncellemeler);
        await AsyncStorage.setItem('guncellemeNotlari', JSON.stringify(backendGuncellemeler));
        await AsyncStorage.setItem('guncellemeLastUpdate', new Date().toISOString());
      } else {
        // Backend'den veri gelmezse local storage'dan yükle
        const savedGuncellemeler = await AsyncStorage.getItem('guncellemeNotlari');
        const savedLastUpdate = await AsyncStorage.getItem('guncellemeLastUpdate');
        
        if (savedGuncellemeler) {
          setGuncellemeler(JSON.parse(savedGuncellemeler));
        } else {
          // Varsayılan güncellemeler
          const defaultGuncellemeler = [
            {
              id: 1,
              tarih: '19.11.2024',
              baslik: 'Hoş Geldiniz!',
              icerik: 'Knight Rehber uygulamasına hoş geldiniz. Yeni özellikler yakında eklenecek.',
              onem: 'normal'
            }
          ];
          setGuncellemeler(defaultGuncellemeler);
          await AsyncStorage.setItem('guncellemeNotlari', JSON.stringify(defaultGuncellemeler));
        }
        
        setLastUpdate(savedLastUpdate);
      }
    } catch (error) {
      console.log('Güncelleme notları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGuncellemeler();
    
    // Her 6 saatte bir güncellemeleri kontrol et
    const interval = setInterval(loadGuncellemeler, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    loadGuncellemeler();
    Alert.alert('Başarılı', 'Güncellemeler kontrol edildi!');
  };

  if (loading) {
    return (
      <View style={styles.guncellemeCard}>
        <Text style={styles.guncellemeTitle}>🔄 Güncelleme Notları</Text>
        <Text style={styles.muted}>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.guncellemeCard}>
      <View style={styles.guncellemeHeader}>
        <Text style={styles.guncellemeTitle}>🔄 Güncelleme Notları</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.refreshButton}>🔄</Text>
        </TouchableOpacity>
      </View>
      
      {guncellemeler.slice(0, 3).map((guncelleme) => (
        <TouchableOpacity 
          key={guncelleme.id}
          style={styles.guncellemeItem}
          onPress={() => {
            Alert.alert(
              `Güncelleme - ${guncelleme.tarih}`,
              guncelleme.icerik,
              [{ text: 'Tamam' }]
            );
          }}
        >
          <View style={styles.guncellemeHeader}>
            <Text style={styles.guncellemeTarih}>{guncelleme.tarih}</Text>
            <Text style={[
              styles.guncellemeOnem,
              guncelleme.onem === 'yuksek' && styles.guncellemeOnemYuksek
            ]}>
              {guncelleme.onem === 'yuksek' ? '❗' : '📝'}
            </Text>
          </View>
          <Text style={styles.guncellemeBaslik}>{guncelleme.baslik}</Text>
          <Text style={styles.guncellemeOzet} numberOfLines={2}>
            {guncelleme.icerik}
          </Text>
        </TouchableOpacity>
      ))}
      
      {guncellemeler.length === 0 && (
        <Text style={styles.muted}>Henüz güncelleme bulunmuyor.</Text>
      )}
      
      {lastUpdate && (
        <Text style={styles.lastUpdateText}>
          Son güncelleme: {new Date(lastUpdate).toLocaleDateString('tr-TR')}
        </Text>
      )}
    </View>
  );
};

// Settings Modal
const SettingsModal = ({ visible, onClose }) => {
  const { user, saveAlarmTypeToStorage } = useAuth();
  const [text, setText] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alarmType, setAlarmType] = useState('notification');

  // Alarm tipini yükle
  useEffect(() => {
    const loadAlarmType = async () => {
      try {
        const savedAlarmType = await AsyncStorage.getItem('alarmType');
        if (savedAlarmType) {
          setAlarmType(savedAlarmType);
        }
      } catch (error) {
        console.log('Alarm tipi yüklenirken hata:', error);
      }
    };
    loadAlarmType();
  }, []);

  const sendFeedback = () => {
    if (!text.trim()) return Alert.alert("Boş", "Mesaj yazmalısınız.");
    
    // Geri bildirimi API'ye gönder
    ApiService.sendAppStats(user?.id, 'feedback_sent');
    
    Alert.alert("Teşekkürler", "Öneriniz gönderildi!");
    setText("");
    onClose();
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    Alert.alert(
      'Bildirim Ayarları',
      `Bildirimler ${!notificationsEnabled ? 'açıldı' : 'kapatıldı'}`,
      [{ text: 'Tamam' }]
    );
  };

  const handleAlarmTypeChange = async (type) => {
    setAlarmType(type);
    await saveAlarmTypeToStorage(type);
    Alert.alert(
      'Alarm Tipi',
      `Alarm tipi ${type === 'notification' ? 'bildirim' : 'telefon alarmı'} olarak ayarlandı`,
      [{ text: 'Tamam' }]
    );
  };

  const openEmail = (subject = '', body = '') => {
    const email = 'info@knightrehber.com';
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(mailto).catch(err => Alert.alert('Hata', 'E-posta uygulaması açılamadı.'));
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>

          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>⬅ Geri</Text>
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginTop: 10 }}>
            <View style={styles.avatarImage}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
            <Text style={styles.profileName}>{user?.username || 'Kullanıcı'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>

            {user?.premium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>⭐ PREMIUM</Text>
              </View>
            )}
          </View>

          <Text style={[styles.small, { marginTop: 18 }]}>AYARLAR</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Bildirimler</Text>
              <Text style={styles.settingDescription}>
                Etkinlik alarmları ve güncellemeler için bildirim al
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#475467', true: '#FFD66B' }}
              thumbColor={notificationsEnabled ? '#0B0B0B' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Alarm Tipi</Text>
              <Text style={styles.settingDescription}>
                Bildirim veya telefon alarmı seçebilirsiniz
              </Text>
            </View>
            <View style={styles.alarmTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.alarmTypeButton,
                  alarmType === 'notification' && styles.alarmTypeButtonActive
                ]}
                onPress={() => handleAlarmTypeChange('notification')}
              >
                <Text style={[
                  styles.alarmTypeText,
                  alarmType === 'notification' && styles.alarmTypeTextActive
                ]}>
                  📢 Bildirim
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.alarmTypeButton,
                  alarmType === 'phone' && styles.alarmTypeButtonActive
                ]}
                onPress={() => handleAlarmTypeChange('phone')}
              >
                <Text style={[
                  styles.alarmTypeText,
                  alarmType === 'phone' && styles.alarmTypeTextActive
                ]}>
                  ⏰ Telefon Alarmı
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.small, { marginTop: 18 }]}>SORUMLULUK REDDİ</Text>
          <TouchableOpacity
            style={styles.disclaimerSetting}
            onPress={() => {
              Alert.alert(
                'Genel Sorumluluk Reddi Beyanı',
                "Knight Online'ın tüm hakları Mgame Corp.'a aittir ve Game Cafe Services, Inc. tarafından yayımlanır. Knight Rehber uygulaması, Mgame ve NTTGame'den bağımsızdır.Uygulama da bulunan bilgiler internet ortamından ve oyun içinden toplanan verilerle oluşturulmuştur. Verilerin doğruluğu garantisi verilmemektedir.Uygulamadaki verilere dayanarak oyun içi ya da dışı oluşabilecek sorunlardan KNIGHT REHBER uygulaması sorumlu tutulamaz.",
                [{ text: 'Tamam' }]
              );
            }}
          >
            <Text style={styles.disclaimerSettingText}>📄 Sorumluluk Reddi Beyanını Oku</Text>
          </TouchableOpacity>

          <Text style={[styles.small, { marginTop: 18 }]}>ÖNERİ / GERİ BİLDİRİM</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Görüşünüzü yazın..."
            placeholderTextColor="#8E97A8"
            multiline
            value={text}
            onChangeText={setText}
          />

          <Text style={[styles.small, { marginTop: 18 }]}>HIZLI İLETİŞİM</Text>
          <View style={styles.quickContactButtons}>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => openEmail('Şikayet/Öneri', 'Merhaba, Knight Rehber uygulaması hakkında şikayet/önerim var:')}
            >
              <Text style={styles.contactButtonText}>💡 Şikayet/Öneri</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => openEmail('Fotoğraf Gönderme', 'Merhaba, Knight Rehber uygulaması için fotoğraf göndermek istiyorum.')}
            >
              <Text style={styles.contactButtonText}>📸 Fotoğraf Gönder</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.sendBtn} onPress={sendFeedback}>
              <Text style={styles.sendBtnText}>Gönder</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

// Genel Sorumluluk Reddi Beyanı
const DisclaimerModal = ({ visible, onAccept }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View style={styles.disclaimerContainer}>
        <View style={styles.disclaimerContent}>
          <Text style={styles.disclaimerTitle}>📜 Genel Sorumluluk Reddi Beyanı</Text>

          <ScrollView style={styles.disclaimerScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.disclaimerText}>
              Knight Online'ın tüm hakları Mgame Corp.'a aittir ve Game Cafe Services, Inc. tarafından yayımlanır. Knight Rehber uygulaması, Mgame ve NTTGame'den bağımsızdır.{'\n\n'}
              
              Uygulamada bulunan bilgiler internet ortamından ve oyun içinden toplanan verilerle oluşturulmuştur. Verilerin doğruluğu garantisi verilmemektedir.{'\n\n'}
              
              Uygulamadaki verilere dayanarak oyun içi ya da dışı oluşabilecek sorunlardan KNIGHT REHBER uygulaması sorumlu tutulamaz.{'\n\n'}
              
              Bu uygulamayı kullanarak yukarıdaki şartları kabul etmiş sayılırsınız.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.disclaimerButton}
            onPress={onAccept}
          >
            <Text style={styles.disclaimerButtonText}>✅ Okudum ve Kabul Ediyorum</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// DÜZELTİLMİŞ ALARM SİSTEMİ - GELİŞTİRİLMİŞ VERSİYON
const useAlarmSystem = () => {
  const auth = useAuth();
  const { user, saveAlarmsToStorage, loadAlarmsFromStorage, loadAlarmTypeFromStorage } = auth;
  const [alarms, setAlarms] = useState({});
  const [alarmType, setAlarmType] = useState('notification');

  // Alarm tipini ve alarmları yükle
  useEffect(() => {
    const loadAlarmData = async () => {
      if (user) {
        const savedAlarms = await loadAlarmsFromStorage(user.id);
        const savedAlarmType = await loadAlarmTypeFromStorage();
        setAlarms(savedAlarms || {});
        setAlarmType(savedAlarmType);
      }
    };
    loadAlarmData();
  }, [user]);

  // Bildirim kanalını kur
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  // Bildirim izinlerini kontrol et
  const checkNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      return finalStatus === 'granted';
    } catch (error) {
      console.log('❌ Bildirim izni kontrol hatası:', error);
      return false;
    }
  };

  // Tüm bildirimleri temizle
  const clearAllNotifications = async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ Tüm bildirimler temizlendi');
    } catch (error) {
      console.log('❌ Bildirim temizleme hatası:', error);
    }
  };

  // Doğru zamanlı bildirim oluştur
  const createNotificationAlarm = async (etkinlik, timeStr, isFiveMinBefore = false) => {
    try {
      const hasPermission = await checkNotificationPermissions();
      if (!hasPermission) {
        console.log('❌ Bildirim izni yok');
        return null;
      }

      const [hours, minutes] = timeStr.split(':').map(Number);
      const now = new Date();
      const targetTime = new Date();
      
      targetTime.setHours(hours, minutes, 0, 0);
      
      // Eğer hedef zaman bugün geçtiyse, yarına ayarla
      if (targetTime <= now) {
        targetTime.setDate(targetTime.getDate() + 1);
      }

      // 5 dakika önce için zamanı ayarla
      if (isFiveMinBefore) {
        targetTime.setMinutes(targetTime.getMinutes() - 5);
      }

      const triggerTime = targetTime.getTime() - now.getTime();
      
      // Geçmişe alarm kurma
      if (triggerTime <= 0) {
        console.log(`⏰ Geçmiş zaman atlandı: ${etkinlik.name} - ${timeStr}`);
        return null;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: isFiveMinBefore ? `⏰ 5 Dakika Kala - ${etkinlik.name}` : `🎯 Şimdi - ${etkinlik.name}`,
          body: isFiveMinBefore 
            ? `${etkinlik.description} başlamasına 5 dakika kaldı! Hazırlanın.` 
            : `${etkinlik.description} şimdi başlıyor! Katılın.`,
          sound: 'default',
          data: { 
            etkinlikId: etkinlik.id,
            etkinlikName: etkinlik.name,
            time: timeStr,
            type: isFiveMinBefore ? '5dk_once' : 'tam_zaman'
          },
        },
        trigger: {
          seconds: Math.floor(triggerTime / 1000),
        },
      });

      console.log(`✅ ${isFiveMinBefore ? '5dk önce' : 'Tam zaman'} bildirimi oluşturuldu: ${etkinlik.name} - ${timeStr} (ID: ${notificationId})`);
      return notificationId;
    } catch (error) {
      console.log('❌ Bildirim oluşturma hatası:', error);
      return null;
    }
  };

  // Alarm ayarla
  const scheduleAlarm = async (etkinlikId, etkinlik) => {
    if (!user) {
      Alert.alert('Uyarı', 'Alarm özelliğini kullanmak için giriş yapmalısınız.');
      return false;
    }

    try {
      // Önce mevcut alarmları temizle
      await cancelAlarm(etkinlikId);

      const scheduledIds = [];

      // Tüm saatler için alarm ayarla - SADECE 5 DAKİKA KALA VE ZAMANINDA
      for (const timeStr of etkinlik.times) {
        // 5 dakika önce bildirimi
        const fiveMinBeforeId = await createNotificationAlarm(etkinlik, timeStr, true);
        if (fiveMinBeforeId) scheduledIds.push(fiveMinBeforeId);

        // Tam zamanında bildirim
        const onTimeId = await createNotificationAlarm(etkinlik, timeStr, false);
        if (onTimeId) scheduledIds.push(onTimeId);
      }

      // Alarm durumunu kaydet
      const newAlarms = {
        ...alarms,
        [etkinlikId]: {
          active: true,
          type: alarmType,
          lastScheduled: new Date().toISOString(),
          scheduledIds: scheduledIds.filter(id => id !== null),
          scheduledTimes: etkinlik.times,
          etkinlikName: etkinlik.name
        }
      };
      
      setAlarms(newAlarms);
      if (user) {
        await saveAlarmsToStorage(user.id, newAlarms);
      }

      console.log(`🎉 ${etkinlik.name} için alarm ayarlandı! Toplam ${scheduledIds.length} bildirim`);
      return true;
    } catch (error) {
      console.log('❌ Alarm ayarlama hatası:', error);
      Alert.alert('Hata', 'Alarm ayarlanırken bir hata oluştu: ' + error.message);
      return false;
    }
  };

  // Alarmı kaldır
  const cancelAlarm = async (etkinlikId) => {
    try {
      const alarmData = alarms[etkinlikId];
      
      // Kayıtlı alarm ID'lerini kaldır
      if (alarmData?.scheduledIds) {
        for (const notificationId of alarmData.scheduledIds) {
          await Notifications.cancelScheduledNotificationAsync(notificationId);
        }
      }

      // Alarm durumunu güncelle
      const newAlarms = { ...alarms };
      delete newAlarms[etkinlikId];
      setAlarms(newAlarms);
      if (user) {
        await saveAlarmsToStorage(user.id, newAlarms);
      }

      console.log(`🔕 ${etkinlikId} alarmları kaldırıldı`);
      return true;
    } catch (error) {
      console.log('❌ Alarm kaldırma hatası:', error);
      return false;
    }
  };

  // Tüm alarmları temizle
  const clearAllAlarms = async () => {
    try {
      await clearAllNotifications();
      setAlarms({});
      if (user) {
        await saveAlarmsToStorage(user.id, {});
      }
      console.log('✅ Tüm alarmlar temizlendi');
    } catch (error) {
      console.log('❌ Tüm alarmları temizleme hatası:', error);
    }
  };

  // Alarm durumunu değiştir
  const toggleAlarm = async (etkinlikId, etkinlik) => {
    const isActive = alarms[etkinlikId]?.active;

    if (isActive) {
      const success = await cancelAlarm(etkinlikId);
      if (success) {
        Alert.alert('Alarm Kapatıldı', `${etkinlik.name} alarmları kapatıldı.`);
      } else {
        Alert.alert('Hata', 'Alarm kapatılırken bir hata oluştu.');
      }
    } else {
      const success = await scheduleAlarm(etkinlikId, etkinlik);
      if (success) {
        Alert.alert(
          'Alarm Ayarlandı 🎯',
          `${etkinlik.name} için alarmlar ayarlandı!\n\n⏰ Saatler: ${etkinlik.times.join(', ')}\n\n🔔 Bildirimler:\n• Etkinlikten 5 dakika önce\n• Etkinlik tam zamanında`
        );
      } else {
        Alert.alert('Hata', 'Alarm ayarlanırken bir hata oluştu.');
      }
    }
  };

  return {
    alarms,
    alarmType,
    setAlarmType,
    toggleAlarm,
    scheduleAlarm,
    cancelAlarm,
    clearAllAlarms
  };
};

// GÜNCELLENMİŞ KnightNostalji Bileşeni - Backend Entegre
const KnightNostaljiScreen = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [nostaljiFotograflar, setNostaljiFotograflar] = useState([]);
  const [loading, setLoading] = useState(true);

  // Nostalji fotoğraflarını yükle
  const loadNostaljiFotograflar = async () => {
    try {
      setLoading(true);
      
      // Backend'den fotoğrafları çek
      const backendFotograflar = await ApiService.getNostaljiFotograflar();
      
      if (backendFotograflar && backendFotograflar.length > 0) {
        // Backend'den gelen verileri kullan
        setNostaljiFotograflar(backendFotograflar);
        await AsyncStorage.setItem('nostaljiFotograflar', JSON.stringify(backendFotograflar));
      } else {
        // Backend'den veri gelmezse local storage'dan yükle
        const savedFotograflar = await AsyncStorage.getItem('nostaljiFotograflar');
        
        if (savedFotograflar) {
          setNostaljiFotograflar(JSON.parse(savedFotograflar));
        } else {
          // Varsayılan fotoğraflar
          const defaultFotograflar = [
            {
              id: 'k1',
              title: 'Eski Knight Online 1',
              image: require('./assets/ko1.jpg')
            },
            {
              id: 'k2',
              title: 'Eski Knight Online 2',
              image: require('./assets/ko2.jpg')
            },
            {
              id: 'k3',
              title: 'Eski Knight Online 3',
              image: require('./assets/ko3.jpg')
            },
            {
              id: 'k4',
              title: 'Eski Knight Online 4',
              image: require('./assets/ko4.jpg')
            },
            {
              id: 'k5',
              title: 'Eski Knight Online 5',
              image: require('./assets/ko5.jpg')
            },
            {
              id: 'k6',
              title: 'Eski Knight Online 6',
              image: require('./assets/ko6.jpg')
            },
          ];
          setNostaljiFotograflar(defaultFotograflar);
          await AsyncStorage.setItem('nostaljiFotograflar', JSON.stringify(defaultFotograflar));
        }
      }
    } catch (error) {
      console.log('Nostalji fotoğrafları yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNostaljiFotograflar();
    
    // Her 12 saatte bir fotoğrafları kontrol et
    const interval = setInterval(loadNostaljiFotograflar, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const openImage = (foto, index) => {
    setSelectedImage(foto);
    setCurrentImageIndex(index);
  };

  const nextImage = () => {
    const nextIndex = (currentImageIndex + 1) % nostaljiFotograflar.length;
    setCurrentImageIndex(nextIndex);
    setSelectedImage(nostaljiFotograflar[nextIndex]);
  };

  const prevImage = () => {
    const prevIndex = (currentImageIndex - 1 + nostaljiFotograflar.length) % nostaljiFotograflar.length;
    setCurrentImageIndex(prevIndex);
    setSelectedImage(nostaljiFotograflar[prevIndex]);
  };

  const handleRefresh = () => {
    loadNostaljiFotograflar();
    Alert.alert('Başarılı', 'Nostalji fotoğrafları güncellendi!');
  };

  const renderImage = (foto, index) => {
    return (
      <TouchableOpacity
        key={foto.id}
        style={styles.nostaljiImageContainer}
        onPress={() => openImage(foto, index)}
      >
        <Image
          source={foto.image}
          style={styles.nostaljiImage}
          resizeMode="cover"
        />
        <View style={styles.nostaljiImageInfo}>
          <Text style={styles.nostaljiImageTitle}>{foto.title}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.tabContent}>
          <Text style={styles.homeTitle}>📸 KnightNostalji</Text>
          <Text style={styles.muted}>Yükleniyor...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <View style={styles.nostaljiHeader}>
          <Text style={styles.homeTitle}>📸 KnightNostalji</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Text style={styles.refreshButton}>🔄</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionDescription}>
            Knight Online'ın unutulmaz eski günlerinden nostaljik fotoğraflar
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Sizde paylaşmamızı istediğiniz eski Knight Online görsellerinizi info@knightrehber.com adresine gönderebilirsiniz.
            </Text>
          </View>

          <View style={styles.nostaljiGrid}>
            {nostaljiFotograflar.map(renderImage)}
          </View>
        </View>
      </View>

      {/* Modal for full screen image view */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.fullScreenImageContainer}>
            <TouchableOpacity
              style={styles.navButtonLeft}
              onPress={prevImage}
            >
              <Text style={styles.navButtonText}>‹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullScreenImageTouchable}
              activeOpacity={1}
            >
              <Image
                source={selectedImage?.image}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButtonRight}
              onPress={nextImage}
            >
              <Text style={styles.navButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.imageInfoOverlay}>
            <Text style={styles.fullImageTitle}>{selectedImage?.title}</Text>
            <Text style={styles.imageCounter}>
              {currentImageIndex + 1} / {nostaljiFotograflar.length}
            </Text>
            <Text style={styles.nostaljiWatermark}>
              KnightRehber Nostalji Arşivi
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

// Skill-Stat Reset Tablosu Bileşeni
const SkillStatResetScreen = () => {
  const resetData = [
 { level: 1, skill: 0, stat: 0 },
  { level: 2, skill: 60, stat: 40 },
  { level: 3, skill: 240, stat: 160 },
  { level: 4, skill: 660, stat: 440 },
  { level: 5, skill: 1500, stat: 1000 },
  { level: 6, skill: 2760, stat: 1840 },
  { level: 7, skill: 4680, stat: 3120 },
  { level: 8, skill: 7440, stat: 4960 },
  { level: 9, skill: 11100, stat: 7400 },
  { level: 10, skill: 15900, stat: 10600 },
  { level: 11, skill: 21960, stat: 14640 },
  { level: 12, skill: 29520, stat: 19680 },
  { level: 13, skill: 38820, stat: 25880 },
  { level: 14, skill: 49920, stat: 33280 },
  { level: 15, skill: 63120, stat: 42080 },
  { level: 16, skill: 78600, stat: 52400 },
  { level: 17, skill: 96600, stat: 64400 },
  { level: 18, skill: 117360, stat: 78240 },
  { level: 19, skill: 141060, stat: 94040 },
  { level: 20, skill: 167940, stat: 111960 },
  { level: 21, skill: 198240, stat: 132160 },
  { level: 22, skill: 232200, stat: 154800 },
  { level: 23, skill: 270060, stat: 180040 },
  { level: 24, skill: 312120, stat: 208080 },
  { level: 25, skill: 358620, stat: 239080 },
  { level: 26, skill: 409740, stat: 273160 },
  { level: 27, skill: 465840, stat: 310560 },
  { level: 28, skill: 527160, stat: 351440 },
  { level: 29, skill: 594000, stat: 396000 },
  { level: 30, skill: 1666500, stat: 1111000 },
  { level: 31, skill: 1863000, stat: 1242000 },
  { level: 32, skill: 2075000, stat: 1383600 },
  { level: 33, skill: 2304300, stat: 1536200 },
  { level: 34, skill: 2550450, stat: 1700300 },
  { level: 35, skill: 2814600, stat: 1876400 },
  { level: 36, skill: 3097500, stat: 2065000 },
  { level: 37, skill: 3399000, stat: 2266600 },
  { level: 38, skill: 3722550, stat: 2481700 },
  { level: 39, skill: 4066350, stat: 2710900 },
  { level: 40, skill: 4431900, stat: 2954600 },
  { level: 41, skill: 4820100, stat: 3213400 },
  { level: 42, skill: 5231550, stat: 3487700 },
  { level: 43, skill: 5667300, stat: 3778200 },
  { level: 44, skill: 6128100, stat: 4085400 },
  { level: 45, skill: 6614700, stat: 4409800 },
  { level: 46, skill: 7128000, stat: 4752000 },
  { level: 47, skill: 7668750, stat: 5112500 },
  { level: 48, skill: 8237700, stat: 5491800 },
  { level: 49, skill: 8836050, stat: 5890700 },
  { level: 50, skill: 9464250, stat: 6309500 },
  { level: 51, skill: 10123500, stat: 6749000 },
  { level: 52, skill: 10814400, stat: 7209600 },
  { level: 53, skill: 11538000, stat: 7692000 },
  { level: 54, skill: 12295050, stat: 8196700 },
  { level: 55, skill: 13086450, stat: 8724300 },
  { level: 56, skill: 13913250, stat: 9275500 },
  { level: 57, skill: 14776350, stat: 9850900 },
  { level: 58, skill: 15676350, stat: 10450900 },
  { level: 59, skill: 16614600, stat: 11076400 },
  { level: 60, skill: 26387325, stat: 17591550 },
  { level: 61, skill: 27912825, stat: 18608550 },
  { level: 62, skill: 29499525, stat: 19666350 },
  { level: 63, skill: 31148775, stat: 20765850 },
  { level: 64, skill: 32862150, stat: 21908100 },
  { level: 65, skill: 34640775, stat: 23093850 },
  { level: 66, skill: 36486450, stat: 24324300 },
  { level: 67, skill: 38400525, stat: 25600350 },
  { level: 68, skill: 40384350, stat: 26922900 },
  { level: 69, skill: 42439500, stat: 28293000 },
  { level: 70, skill: 44567325, stat: 29711550 },
  { level: 71, skill: 46769400, stat: 31179600 },
  { level: 72, skill: 49047075, stat: 32698050 },
  { level: 73, skill: 51402150, stat: 34268100 },
  { level: 74, skill: 53835750, stat: 35890500 },
  { level: 75, skill: 56349675, stat: 37566450 },
  { level: 76, skill: 58945500, stat: 39297000 },
  { level: 77, skill: 61624350, stat: 41082900 },
  { level: 78, skill: 64388025, stat: 42925350 },
  { level: 79, skill: 67238100, stat: 44825400 },
  { level: 80, skill: 70176150, stat: 46784100 },
  { level: 81, skill: 73203750, stat: 48802500 },
  { level: 82, skill: 76322250, stat: 50881500 },
  { level: 83, skill: 79533450, stat: 53022300 }
];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>📊 Skill-Stat Reset</Text>
        <Text style={styles.sectionDescription}>
          Skill ve Stat reset maliyetleri
        </Text>

        <View style={styles.card}>
          <Text style={styles.eventName}>Reset Maliyet Tablosu</Text>

          {/* Tablo Başlığı */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Level</Text>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Skill</Text>
            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Stat</Text>
          </View>

          {/* Tablo İçeriği */}
          {resetData.map((item, index) => (
            <View key={index} style={[
              styles.tableRow,
              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
            ]}>
              <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold' }]}>
                {item.level}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {item.skill.toLocaleString()}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {item.stat.toLocaleString()}
              </Text>
            </View>
          ))}

          <View style={styles.resetInfo}>
            <Text style={styles.resetInfoTitle}>💡 Bilgiler:</Text>
            <Text style={styles.resetInfoText}>• Skill Reset: Skill puanlarını sıfırlar</Text>
            <Text style={styles.resetInfoText}>• Stat Reset: Stat puanlarını sıfırlar</Text>
            <Text style={styles.resetInfoText}>• NPC: Moradon - Reset NPC</Text>
            <Text style={styles.resetInfoText}>• Ücret: Noah</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

// Achievements Bileşeni
const AchievementsScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState('Tümü');
  const [achievementSearch, setAchievementSearch] = useState('');

const achievementsData = [
    { id: 1, name: "Beginning of an Honor", title: "Trainee Soldier", effect: "Attack power +10", description: "Defeat 100 enemy users", reward: "", category: "War -> Common -> Page 1" },
    { id: 2, name: "Battlefield Soldier", title: "Soldier", effect: "Attack power +10, Defense +20", description: "Defeat 500 enemy users", reward: "", category: "War -> Common -> Page 1" },
    { id: 3, name: "Battlefield General", title: "General", effect: "Attack power +13, Defense +1", description: "Defeat 1'000 enemy users", reward: "", category: "War -> Common -> Page 1" },
    { id: 4, name: "Battlefield Commander", title: "Berserker", effect: "Attack power +26", description: "Defeat 5'000 enemy users", reward: "", category: "War -> Common -> Page 2" },
    { id: 5, name: "Battlefield Warrior", title: "God of War", effect: "Short sword defense +1, Sword defense +1, Jamadar defense +1, Spear defense +1", description: "Defeat 10'000 enemy users", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Common -> Page 2" },
    { id: 6, name: "Battlefield Hero", title: "Over God", effect: "Defense +10, Short sword defense +1, Sword defense +1, Arrow defense +1, Axe defense +1", description: "Defeat 20'000 enemy users", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Common -> Page 2" },
    { id: 7, name: "Corps Hero", title: "Overmind", effect: "Attack power +13, Strength +1, Health +2, Intelligence +1, Magic power +1, Dexterity +1", description: "Defeat 30'000 enemy users", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Common -> Page 2" },
    { id: 8, name: "You know who I am?", title: "Can't Lose", effect: "Attack power +20", description: "Succeed in Revenge 100x", reward: "", category: "War -> Common -> Page 3" },
    { id: 9, name: "Revenge expert", title: "Revenger", effect: "Defense +70", description: "Succeed in Revenge 500x", reward: "", category: "War -> Common -> Page 3" },
    { id: 10, name: "Nemesis!", title: "Hatred", effect: "Attack power +20, Defense +40", description: "Succeed in Revenge 1'000x", reward: "", category: "War -> Common -> Page 3" },
    { id: 11, name: "I'm the best here!", title: "Fighter", effect: "Attack power +4, Health +4", description: "Win 100 duels in Moradon", reward: "", category: "War -> Moradon -> Page 1" },
    { id: 12, name: "Neverending Match", title: "Undaunted", effect: "Strength +1, Health +3, Intelligence +1, Magic power +1, Dexterity +1", description: "Win 1'000 duels in Moradon", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Moradon -> Page 1" },
    { id: 13, name: "Legend of the Arena", title: "Arena Legend", effect: "Strength +9", description: "Win 10'000 duels in Moradon", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Moradon -> Page 1" },
    { id: 14, name: "Warrior of an Ardream", title: "Ardream Veteran", effect: "Ice bonus +6", description: "Defeat 100 enemies at Ardream", reward: "", category: "War -> Pioneer Area -> Page 1" },
    { id: 15, name: "Revenger of Ardream", title: "Ardream's Revenger", effect: "Strength +6", description: "Succeed 100 times in revenge at Ardream", reward: "", category: "War -> Pioneer Area -> Page 1" },
    { id: 16, name: "Legend of Ronarkland", title: "Military Base Veteran", effect: "Health +6", description: "Defeat 100 enemies at Ronarkland base", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 2" },
    { id: 17, name: "Revenger of Ronarkland", title: "Military Base Revenger", effect: "Dexterity +6", description: "Succeed 100 times in revenge at Ronarkland base", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 2" },
    { id: 18, name: "Ronarkland Warrior", title: "Ronarkland Soldier", effect: "Attack power +5, Defense +5, Health +2", description: "Defeat 100 enemies in Ronarkland", reward: "Monster stone", category: "War -> Pioneer Area -> Page 3" },
    { id: 19, name: "Ronarkland Soldier", title: "Ronarkland Warrior", effect: "Health +1, Dexterity +5", description: "Defeat 500 enemies in Ronarkland", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 3" },
    { id: 20, name: "Ronarkland Warrior", title: "Ronarkland Veteran", effect: "Attack power +20, Defense +10", description: "Defeat 1'000 enemies in Ronarkland", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 3" },
    { id: 21, name: "Legend of Ronarkland", title: "Ronarkland Legend", effect: "Attack power +33", description: "Defeat 10'000 enemy users in Ronarkland", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 4" },
    { id: 22, name: "Ronarkland Revenger", title: "Ronarkland Revenger", effect: "Magic power +10", description: "Succeed 100 times in revenge at Ronarkland", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Pioneer Area -> Page 4" },
    { id: 23, name: "Lunar War's Warrior", title: "Lunar War Soldier", effect: "Strength +4, Health +1", description: "Defeat 100 enemies in Lunar war", reward: "Monster stone", category: "War -> Lunar -> Page 1" },
    { id: 24, name: "Lunar War's Soldier", title: "Lunar War Warrior", effect: "Strength +5, Health +1", description: "Defeat 500 enemy users in Lunar war", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Lunar -> Page 1" },
    { id: 25, name: "Lunar War's Warrior", title: "Lunar War Veteran", effect: "Attack power +15, Defense +15, Exp bonus +1%", description: "Defeat 1'000 enemy users in Lunar war", reward: "", category: "War -> Lunar -> Page 1" },
    { id: 26, name: "Legend of Lunar War", title: "Lunar War Legend", effect: "Intelligence +20", description: "Defeat 10'000 enemy users in Lunar war", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Lunar -> Page 2" },
    { id: 27, name: "Lunar War's Revenger", title: "Lunar War Revenger", effect: "Dexterity +10", description: "Succeed 100 times in revenge at Lunar War", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Lunar -> Page 2" },
    { id: 28, name: "Follow me!", title: "Commander", effect: "Health +9", description: "Win 100 times in Lunar War", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Lunar -> Page 3" },
    { id: 29, name: "Fortress of Defense", title: "Impregnable", effect: "Defense +90", description: "Win 100 Border Defense Wars", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Border Defense -> Page 1" },
    { id: 30, name: "Piece of Cake", title: "The Best", effect: "Intelligence +2, Magic power +4", description: "Win first place 10 times in Chaos event", reward: "", category: "War -> Chaos -> Page 1" },
    { id: 31, name: "I'm the best", title: "Most Popular", effect: "Strength +5, Health +4", description: "Win first place 100 times in Chaos event", reward: "", category: "War -> Chaos -> Page 1" },
    { id: 32, name: "So Close!", title: "2nd Best", effect: "Magic power +7", description: "Win second place 10 times in Chaos event", reward: "", category: "War -> Chaos -> Page 1" },
    { id: 33, name: "Next time I'll be #1", title: "3rd Best", effect: "Health +2, Dexterity +3", description: "Win third place 10 times in Chaos event", reward: "", category: "War -> Chaos -> Page 2" },
    { id: 34, name: "Commander of Battle", title: "Commander of Chaos", effect: "Short sword defense +1, Jamadar defense +1", description: "30 or more kills in Chaos event", reward: "", category: "War -> Chaos -> Page 2" },
    { id: 35, name: "Strong Excitement", title: "Gone Mad", effect: "Intelligence +14", description: "40 or more kills in Chaos event", reward: "", category: "War -> Chaos -> Page 3" },
    { id: 36, name: "Appearance of Legend", title: "For better or worse", effect: "Attack power +13, Contribution (NP per kill) +1", description: "50 or more kills in Chaos event", reward: "", category: "War -> Chaos -> Page 3" },
    { id: 37, name: "Juraid Commander", title: "King of Evil Spirit", effect: "Health +5, Intelligence +10", description: "Win 100 times at Juraid event", reward: "", category: "War -> Juraid -> Page 1" },
    { id: 38, name: "Magical Castle", title: "Crown Prince", effect: "Exp bonus +1%, Contribution (NP per kill) +1", description: "Cumulative Win x10 at Castle Siege War", reward: "", category: "War -> Castle Siege -> Page 1" },
    { id: 39, name: "Castle of War", title: "King", effect: "Attack power +20, Contribution (NP per kill) +2", description: "Cumulative Win x50 at Castle Siege War", reward: "", category: "War -> Castle Siege -> Page 1" },
    { id: 40, name: "Castle of King's Throne", title: "Emperor", effect: "Contribution (NP per kill) +2", description: "Cumulative Win x100 at Castle Siege War", reward: "", category: "War -> Castle Siege -> Page 1" },
    { id: 41, name: "Ronarkland Hunter", title: "Novice Hunter", effect: "Attack power +3", description: "Defeat 100 Ronarkland monsters", reward: "", category: "Adventure -> Common -> Page 1" },
    { id: 42, name: "Step by Step", title: "Noob", effect: "Health +2", description: "Defeat 1'000 Ronarkland monsters", reward: "Monster stone", category: "Adventure -> Common -> Page 1" },
    { id: 43, name: "Expert Hunter", title: "Novice Archer", effect: "Attack power +5, Defense +5, Exp bonus +1%", description: "Defeat 5'000 Ronarkland monsters", reward: "", category: "Adventure -> Common -> Page 1" },
    { id: 44, name: "Monster Chaser", title: "Chaser", effect: "Magic power +6, Exp bonus +2%", description: "Defeat 10'000 Ronarkland monsters", reward: "", category: "Adventure -> Common -> Page 1" },
    { id: 45, name: "Monster's King", title: "Beast Master", effect: "Ice bonus +8", description: "Defeat 30'000 Ronarkland monsters", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Common -> Page 1" },
    { id: 46, name: "Life is Precious", title: "Previous Life", effect: "Attack power +2, Defense +4", description: "Do not get killed and defeat 100 monsters", reward: "", category: "Adventure -> Common -> Page 2" },
    { id: 47, name: "Never Die", title: "Proficient", effect: "Intelligence +4", description: "Do not get killed and defeat 1000 monsters", reward: "Monster stone", category: "Adventure -> Common -> Page 2" },
    { id: 48, name: "Skilled in Hunting", title: "Expert", effect: "Defense +40", description: "Do not get killed and defeat 10000 monsters", reward: "", category: "Adventure -> Common -> Page 2" },
    { id: 49, name: "Secret of Immportality", title: "Four Phases of Life", effect: "Attack power +10, Exp bonus +3%", description: "Do not get killed and defeat 20'000 monsters", reward: "", category: "Adventure -> Common -> Page 2" },
    { id: 50, name: "I'm the Legend", title: "Immortal", effect: "Attack power +25, Defense +5", description: "Do not get killed and defeat 30'000 monsters", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Common -> Page 2" },
    { id: 51, name: "[Level 10] Piece of Cake", title: "Level 10", effect: "", description: "Reach level 10", reward: "Monster stone", category: "Normal -> Character -> Page 4" },
    { id: 52, name: "It's just the beginning", title: "Sprout", effect: "Health +1", description: "Defeat 1 Worm in Moradon", reward: "", category: "Adventure -> Field -> Page 1" },
    { id: 53, name: "Chief Hunting I", title: "Street Smart", effect: "", description: "Defeat [Chief] Hideous and [Chief] Bendiking in Moradon", reward: "Monster stone", category: "Adventure -> Field -> Page 1" },
    { id: 54, name: "Battle with Fog", title: "Ignorant", effect: "Magic power +3", description: "Complete Wings in the Fog 1 and 2 in Moradon\nWing of Fog I: Defeat 100 Gavolts or Giant Gavolts in Moradon\nWing of Fog II: Defeat 100 Gloomwing or Spoiler in Moradon", reward: "Monster stone", category: "Adventure -> Field -> Page 2" },
    { id: 55, name: "Violent Herbivore", title: "Patience", effect: "Strength +1, Health +1", description: "Defeat 100 Gliptodont", reward: "", category: "Adventure -> Field -> Page 3" },
    { id: 56, name: "Dance with the Wolves", title: "Wolf Hunter", effect: "Health +1, Dexterity +1", description: "Defeat 100 Dire wolves, Shadow Seekers, Loup-garous or Lycans", reward: "", category: "Adventure -> Field -> Page 3" },
    { id: 57, name: "Scorpion?", title: "Deadly Poisonus", effect: "Dexterity +2", description: "Defeat 100 Pincers, Paralyzers or Scorpions", reward: "", category: "Adventure -> Field -> Page 4" },
    { id: 58, name: "Walking Dead", title: "Undead Hunter", effect: "Magic power +2", description: "Defeat 100 Rotten Eyes and 100 Undying", reward: "", category: "Adventure -> Field -> Page 4" },
    { id: 59, name: "Crack in Resources", title: "All Resource Guardian", effect: "", description: "Defeat 100 Shadow Rifts in Moradon", reward: "", category: "Adventure -> Field -> Page 5" },
    { id: 60, name: "Troll's Friend", title: "Troller", effect: "", description: "Defeat 200 Gafs or Trolls in Luferson/El Morad castle", reward: "", category: "Adventure -> Field -> Page 6" },
    { id: 61, name: "Grave Guard", title: "Bony", effect: "Dexterity +3", description: "Abandoned Bones I & II\nAbandoned Bones I: Defeat 300 Skeleton Knights and 300 Skeleton Champions\nAbandoned Bones II: Defeat 300 Skeleton Warriors", reward: "Monster stone", category: "Adventure -> Field -> Page 9" },
    { id: 62, name: "Big Goblin Family", title: "Goblin's Enemy", effect: "Intelligence +6, Magic power +2", description: "Complete Goblin Family I & II\nGoblin Family I: Defeat 300 Pooka and 300 Goblin Bouncer\nGoblin Family II: Defeat 300 Bugbears and 300 Kobolds", reward: "", category: "Adventure -> Field -> Page 11" },
    { id: 63, name: "I like cure Aif", title: "Awesome Expert", effect: "Strength +1, Health +1, Intelligence +2, Magic power +1, Dexterity +1", description: "Defeat 2'000 Apes in Luferson/El Morad Castle", reward: "", category: "Adventure -> Field -> Page 13" },
    { id: 64, name: "The Burning", title: "Fireworks", effect: "Flame bonus +4", description: "Complete Extreme Pain and Flaming Heart\nExtreme Pain: Defeat 200 Burning Skeletons\nFlaming Heart: Defeat 100 Burning Stones and 100 Flame Rocks", reward: "Monster stone", category: "Adventure -> Field -> Page 17" },
    { id: 65, name: "Vindictive Spirit Liberator", title: "Skull King", effect: "Health +5", description: "Defeat 200 Dragon Tooth Commanders and 200 Dragon Tooth Knights", reward: "", category: "Adventure -> Field -> Page 18" },
    { id: 66, name: "Fat and Stupid", title: "Orc's Enemy", effect: "Strength +3", description: "Complete Orc Slayer I & II\nOrc Slayer I: Defeat 100 Uruk Hais and 100 Uruk Blades\nOrc Slayer II: Defeat 100 Uruk Trons", reward: "Monster stone", category: "Adventure -> Field -> Page 19" },
    { id: 67, name: "Storm's coming", title: "Blitz", effect: "Electric bonus +2", description: "Defeat 100 Storming Apostles", reward: "", category: "Adventure -> Field -> Page 25" },
    { id: 68, name: "Avoiding Whip", title: "Whipped", effect: "", description: "Defeat 100 Balogs", reward: "", category: "Adventure -> Field -> Page 26" },
    { id: 69, name: "Heat Hunting", title: "Flame", effect: "Flame bonus +2", description: "Defeat 100 Apostles of Flames", reward: "", category: "Adventure -> Field -> Page 29" },
    { id: 70, name: "Never ending Power", title: "Solid", effect: "Defense +20", description: "Defeat 200 Titans or Dark Stones", reward: "", category: "Adventure -> Field -> Page 29" },
    { id: 71, name: "Bitter Hunting", title: "Chill", effect: "Ice bonus +2", description: "Defeat 100 Apostles of Piercing Cold", reward: "", category: "Adventure -> Field -> Page 30" },
    { id: 72, name: "Sons of Darkness", title: "Blue Skin", effect: "Attack power +3, Defense +1", description: "Defeat 100 Forwird or Forwird Warriors and 100 Forwird Knights", reward: "", category: "Adventure -> Field -> Page 32" },
    { id: 73, name: "Invisible Attack", title: "Phantom", effect: "Strength +1, Exp bonus +1%", description: "Defeat 1'000 Phantoms in Desperation Abyss", reward: "", category: "Adventure -> Dungeon -> Page 2" },
    { id: 74, name: "Abyss Commander", title: "Queen", effect: "Strength +2, Health +2", description: "Complete Server of the Queen and For Knights in Hell Abyss\nServer of the Queen: Defeat 100 Servants of Isiloon in Hell Abyss\nFor Knights: Defeat Isiloon in Hell Abyss", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 4" },
    { id: 75, name: "Spider Massacre", title: "Hate Spider", effect: "Dexterity +1, Exp bonus +1%", description: "Defeat 1000 Tarantula in Delos Basement", reward: "", category: "Adventure -> Dungeon -> Page 5" },
    { id: 76, name: "Commander of the Base Castle", title: "Underworld", effect: "Health +1, Dexterity +3", description: "Complete Testing the King and Nightmare of Spiderman\nTesting the King: Defeat Krowaz in Red Blood in Delos Basement\nNightmare of Spiderman: Defeat Tarantula in Red Blood in Delos Basement", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 5" },
    { id: 77, name: "Draki", title: "Archeologist", effect: "Intelligence +10", description: "Complete Draki's Trace and Tracks in Ronarkland\nDraki's Tracks: Collect 100 Dragon's Dreadium Fossils\nDraki's Trace: Collect 100 Draki's Dragon Fossils", reward: "", category: "Adventure -> Field -> Page 33" },
    { id: 78, name: "Guardian", title: "Guardian", effect: "Strength +4", description: "Complete Guardian of the Guardian Tower I & II\nGuardian of the Guardian Tower I: Defeat 200 Lyots in Ronarkland\nGuardian of the Guardian Tower II: Defeat 200 Atrosses in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 34" },
    { id: 79, name: "Ronarkland Guardian", title: "Elder", effect: "Health +3, Intelligence +4", description: "Complete Ronarkland Elder I and II in Ronarkland\nRonarkland Elder I: Defeat 100 Enigmas and 100 Cruels in Ronarkland\nRonarkland Elder II: Defeat 100 Havocs and 100 Hell Fires in Ronarkland", reward: "", category: "Adventure -> Field -> Page 36" },
    { id: 80, name: "Working Expert", title: "Task Expert", effect: "Health +4, Intelligence +2", description: "Complete Work Procedure I and II in Ronarkland\nWork Procedure I: Defeat 1000 Enigmas or Cruels in Ronarkland\nWork Procedure II: Defeat 1000 Havoc or Hell Fires in Ronarkland", reward: "", category: "Adventure -> Field -> Page 36" },
    { id: 81, name: "Dragon Massacre", title: "Dragon Slayer", effect: "Flame bonus +9", description: "Defeat 100 Felankors in Ronarkland", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Field -> Page 36" },
    { id: 82, name: "Ruler of the Gate", title: "Most Speedy", effect: "Attack power +10, Defense +60", description: "Destroy 100 Chaos Stones in Ronarkland", reward: "", category: "Adventure -> Field -> Page 37" },
    { id: 83, name: "Abracadabra", title: "Like a Dog", effect: "Flame bonus +5", description: "Defeat 1000 Goloras in Ronarkland", reward: "", category: "Adventure -> Field -> Page 37" },
    { id: 84, name: "Sweeping Bandits", title: "Orc Slayer", effect: "Sword defense +2, Arrow defense +1", description: "Complete In Between the Arrow and Magic and In Between two Swords\nIn Between the Arrow and Magic: Defeat 100 Orc Bandit Archers and 100 Orc Bandit Officers (Archers) and 100 Orc Bandit Sorcerers and 100 Or Bandit Officers (Sorcerers)\nIn Between two Swords: Defeat 100 Orc Bandit Warriors and 100 Orc Bandit Officers (Warriors) and 100 Orc Bandit Leaders", reward: "", category: "Adventure -> Field -> Page 39" },
    { id: 85, name: "7 Sins", title: "Not a Sinner", effect: "Flame resistance +2, Ice resistance +1, Lighting resistance +2, Magic resistance +1, Spell resistance +1, Poison resistance +2", description: "Complete 4 Sins and 3 Sins in Ronarkland\n4 Sins: Defeat 100 Prides and 100 Gluttons and 100 Envy and 100 Greeds in Ronarkland\n3 Sins: Defeat 100 Sloths and 100 Lusts and 100 Wraths in Ronarkland", reward: "", category: "Adventure -> Field -> Page 41" },
    { id: 86, name: "Chaos Commander", title: "Chaos Domination", effect: "Ice bonus +3, Flame bonus +2, Electric bonus +3", description: "Complete Monster born in Chaos I and II in Ronarkland\nMonster born in Chaos I: Defeat 100x Jersey or Reepers and 100x Dulian or Samma in Ronarkland\nMonster born in Chaos II: Defeat 100x Javana or Barrkk and 100x Query or Raxton in Ronarkland", reward: "", category: "Adventure -> Field -> Page 42" },
    { id: 87, name: "Dragon Slayer", title: "Slayer", effect: "Jamadar defense +1, Health +2", description: "Defeat Red Dragon (Felankor) and Dark Dragon (Delos)", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Common -> Page 3" },
    { id: 88, name: "Juraid Knight", title: "Juraid Knight", effect: "Electric bonus +6", description: "Complete Juraid Monster III and Seed of Evil in Juraid\nJuraid Monster III: Defeat 100 Lich Kings and 100 Kocatris and 100 Lirimu and 100 Bone Dragons in Juraid\nSeed of Evil: Defeat 10 Deva in Juraid", reward: "", category: "Adventure -> Dungeon -> Page 7" },
    { id: 89, name: "New Owner of Krowaz Land", title: "Magican", effect: "Flame resistance +8", description: "Defeat Krowaz in Krowaz's Dominion", reward: "", category: "Adventure -> Field -> Page 43" },
    { id: 90, name: "Day to Catch Cows", title: "Ursa", effect: "Magic power +1, Exp bonus +1%", description: "Defeat 100 Minotaur in Krowaz's Dominion", reward: "", category: "Adventure -> Field -> Page 43" },
    { id: 91, name: "Treasure's all mine!", title: "Treasure Hunter", effect: "Dexterity +4", description: "Defeat 10 Treasure Boxes in Krowaz Dominion", reward: "Monster stone", category: "Adventure -> Field -> Page 44" },
    { id: 92, name: "Emperor of 1000 years", title: "Castle Destroyer", effect: "Electric bonus +7", description: "Do not get killed and defeat [Emperor]Mammoth the 3rd and [Machine Golem]Crasher Mimmick", reward: "", category: "Adventure -> Dungeon -> Page 9" },
    { id: 93, name: "Darkness, Snakes and Magic", title: "Kimera", effect: "Dexterity +7, Contribution (NP per kill) +1", description: "Do not get killed and defeat Purious", reward: "", category: "Adventure -> Dungeon -> Page 9" },
    { id: 94, name: "Blocking of Consciousness", title: "Saved from the Flame", effect: "Health +7, Contribution (NP per kill) +1", description: "Do not get killed and defeat [Emperor] Mammoth the 3rd and [Shackled Lord] Pluwitoon", reward: "", category: "Adventure -> Dungeon -> Page 10" },
    { id: 95, name: "Flame Destroyer", title: "Fire Destroyer", effect: "Strength +7, Contribution (NP per kill) +1", description: "Do not get killed and defeat [Emperor] Mammoth the 3rd and [Lord of Destruction]", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Dungeon -> Page 10" },
    { id: 96, name: "True Owner of the Castle", title: "Castle King", effect: "Health +3, Contribution (NP per kill) +1", description: "Complete Immportal of Under the Castle I and II\nImmportal of Under the Castle I: Do not get killed and defeat Purious\nImmportal of Under the Castle II: Do not get killed and defeat [Emperor]Mammoth the 3rd and [Machine Golem]Crasher Mimmick", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Dungeon -> Page 10" },
    { id: 97, name: "KNIGHT 11TH", title: "KNIGHT 11TH", effect: "Strength +1, Intelligence +2, Magic power +1, Dexterity +1", description: "Complete 11th Anniversary Quest of Julian", reward: "", category: "Normal -> Event -> Page 1" },
    { id: 98, name: "Enjoying Thanksgiving 2013", title: "2013 Thanksgiving", effect: "Health +5", description: "Deliver 50 Moon pieces to Magipie Mother for the year 2013", reward: "", category: "Normal -> Event -> Page 1" },
    { id: 99, name: "13Th Snow Knight", title: "13th Snow Knight", effect: "Health +3, Ice bonus +2, Ice resistance +2", description: "13Th Snow Knight", reward: "", category: "Normal -> Event -> Page 1" },
    { id: 100, name: "Relic Protector", title: "Relic Protector", effect: "Exp bonus +5%", description: "Relic Protector", reward: "", category: "Normal -> Event -> Page 1" },
    { id: 101, name: "Juraid Protector", title: "Juraid Protector", effect: "Defense +100", description: "Win 150 times at Juraid event", reward: "", category: "War -> Juraid -> Page 1" },
    { id: 102, name: "Knight Beginner", title: "Beginner", effect: "Defense +20, Health +3", description: "More than 1 year of Service during the Event Period", reward: "", category: "Normal -> Event -> Page 1" },
    { id: 103, name: "Knight Expert", title: "Expert", effect: "Defense +30, Health +4", description: "More than 4 years of Service during the Event Period", reward: "", category: "Normal -> Event -> Page 2" },
    { id: 104, name: "Knight Master", title: "Master", effect: "Defense +40, Health +5", description: "More than 8 years of Service during the Event Period", reward: "", category: "Normal -> Event -> Page 2" },
    { id: 105, name: "Enjoying Thanksgiving 2014", title: "2014 Thanksgiving", effect: "Defense +30", description: "Deliver 50 Moon pieces to Magipie Mother for the year 2014", reward: "", category: "Normal -> Event -> Page 2" },
    { id: 106, name: "14th Snow Knight", title: "14th Snow Knight", effect: "Defense +10, Health +4", description: "14th Snow Knight", reward: "", category: "Normal -> Event -> Page 2" },
    { id: 107, name: "Hellfire Controller", title: "Fire Dragon", effect: "Strength +5, Contribution (NP per kill) +1", description: "Accumulate 100 Feather Of Hellfire Dragon during anniversary event (every year, items to collect are different)", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 108, name: "Storm Controller", title: "Wind Dragon", effect: "Dexterity +5, Contribution (NP per kill) +1", description: "Accumulate 100 Feather Of Hellfire Dragon during anniversary event (every year, items to collect are different)", reward: "", category: "Normal -> Event -> Page 2" },
    { id: 109, name: "Terrain Controller", title: "Earth Dragon", effect: "Intelligence +5, Magic power +5, Contribution (NP per kill) +1", description: "Accumulate 100 Feather Of Hellfire Dragon during anniversary event (every year, items to collect are different)", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 110, name: "Hellfire Dragon Fighter", title: "Hellfire Dragon Fighter", effect: "Strength +3, Intelligence +3, Magic power +3, Dexterity +3", description: "Accumulate 1 Mark of Hellfire Dragon during 11th anniversary event", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 111, name: "Hellfire Dragon Slayer", title: "Hellfire Dragon Slayer", effect: "Strength +5, Intelligence +5, Magic power +5, Dexterity +5", description: "Accumulate 5 Mark of Hellfire Dragon during 11th anniversary event", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 112, name: "Hellfire Dragon Slayer Master", title: "Hellfire Dragon Slayer Master", effect: "Defense -20, Strength +10, Intelligence +10, Magic power +10, Dexterity +10", description: "Accumulate 10 Mark of Hellfire Dragon during 11th anniversary event", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 113, name: "Hellfire Dragon Slayer God", title: "Hellfire Dragon Slayer God", effect: "Defense -50, Strength +15, Intelligence +15, Magic power +15, Dexterity +15", description: "Accumulate 20 Mark of Hellfire Dragon during 11th anniversary event", reward: "", category: "Normal -> Event -> Page 3" },
    { id: 114, name: "15th Snow Knight", title: "15th SNow Knight", effect: "Defense +10, Health +4", description: "15th Snow Knight", reward: "", category: "Normal -> Event -> Page 4" },
    { id: 115, name: "Conqueror of Draki's Tower", title: "Conqueror of Draki's Tower", effect: "Attack power +20", description: "Defeat Draki El Rasaga", reward: "", category: "Adventure -> Dungeon -> Page 11" },
    { id: 116, name: "Berserker of Draki's Tower", title: "Berserker of Draki's Tower", effect: "Health +2, Exp bonus +5%", description: "Complete Draki's Tower in 20 minutes", reward: "", category: "Challenge -> Dungeon -> Page 1" },
    { id: 117, name: "Ruler of Draki's Tower", title: "Ruler of Draki's Tower", effect: "Defense +100", description: "Title Exchange Voucher will be given to 1st rank of Draki's Tower", reward: "", category: "Challenge -> Dungeon -> Page 1" },
    { id: 118, name: "Kill the enemy Vanguard!", title: "Master Bounty Hunter", effect: "Attack power +30", description: "Kill a total of 100 Vanguards", reward: "", category: "War -> Pioneer Area -> Page 4" },
    { id: 119, name: "RUN! RUN! RUN!", title: "Master Survivalist", effect: "Defense +90", description: "Survive as a Vanguard a total of 100 times", reward: "", category: "War -> Pioneer Area -> Page 4" },
    { id: 120, name: "Golden Knight of Snow", title: "Golden Knight of Snow", effect: "Defense +10, Health +4", description: "Deliver 2017 Snow Crzstals to NPC [Maggpie]", reward: "", category: "Normal -> Event -> Page 4" },
    { id: 121, name: "Lunar Warrrior", title: "Lunar Warrrior", effect: "Strength +1, Health +1, Intelligence +1, Magic power +1, Dexterity +1", description: "Deliver 1 [Grace of Moon God] to NPC [Julianne]", reward: "", category: "Normal -> Event -> Page 4" },
    { id: 122, name: "Lunar Hero", title: "Lunar Hero", effect: "Defense +10, Strength +1, Health +1, Intelligence +1, Magic power +1, Dexterity +1", description: "Deliver 5 [Grace of Moon God] to NPC [Julianne]", reward: "", category: "Normal -> Event -> Page 4" },
    { id: 123, name: "Lunar Advent", title: "Lunar Advent", effect: "Defense +10, Strength +5, Health +5", description: "Deliver 10 [Grace of Moon God] to NPC [Julianne]", reward: "", category: "Normal -> Event -> Page 4" },
    { id: 124, name: "Lunar Rebirth", title: "Lunar Rebirth", effect: "Defense +10, Health +5, Dexterity +5", description: "Deliver 10 [Grace of Moon God] to NPC [Julianne]", reward: "", category: "Normal -> Event -> Page 5" },
    { id: 125, name: "Lunar Messenger", title: "Lunar Messenger", effect: "Defense +10, Intelligence +5, Magic power +5, Ice bonus +2, Flame bonus +2, Electric bonus +2", description: "Deliver 10 [Grace of Moon God] to NPC [Julianne]", reward: "", category: "Normal -> Event -> Page 5" },
    { id: 126, name: "Knight Grand Master", title: "Grand Master", effect: "Attack power +3, Defense +90", description: "Old User Reward Title - 15 years", reward: "", category: "Normal -> Event -> Page 5" },
    { id: 127, name: "Solar Messenger", title: "Solar Messenger", effect: "Attack power +16, Defense +16", description: "Deliver 300 Soul Gems to Julia", reward: "", category: "Normal -> Event -> Page 5" },
    { id: 128, name: "I'm the King", title: "I'm the King", effect: "", description: "Become a King", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 1" },
    { id: 129, name: "Nation's Superior", title: "Nation's Superior", effect: "", description: "Achieve Contribution 5'000", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 1" },
    { id: 130, name: "Nation's Captain", title: "Nation's Captain", effect: "", description: "Achieve Contribution 500'000", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 2" },
    { id: 131, name: "Nation's Commodore", title: "Nation's Commodore", effect: "", description: "Achieve Contribution 50'000'000", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 3" },
    { id: 132, name: "Nation's Enemy", title: "Nation's Enemy", effect: "", description: "Achieve Contribution 2'000'000'000", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 4" },
    { id: 133, name: "[Level 20] Fast", title: "Level 20", effect: "", description: "Reach level 20", reward: "Monster stone", category: "Normal -> Character -> Page 4" },
    { id: 134, name: "[Level 30] To New Place", title: "Level 30", effect: "", description: "Reach level 30", reward: "Monster stone", category: "Normal -> Character -> Page 5" },
    { id: 135, name: "[Level 40] three Spirits", title: "Level 40", effect: "", description: "Reach level 40", reward: "Monster stone", category: "Normal -> Character -> Page 5" },
    { id: 136, name: "[Level 50] Enjoy the War", title: "Level 50", effect: "", description: "Reach level 50", reward: "Monster stone", category: "Normal -> Character -> Page 5" },
    { id: 137, name: "[Level 60] Exciting Place", title: "Level 60", effect: "", description: "Reach level 60", reward: "Monster stone", category: "Normal -> Character -> Page 5" },
    { id: 138, name: "[Level 70] With You and Me", title: "Level 70", effect: "", description: "Reach level 70", reward: "Monster stone", category: "Normal -> Character -> Page 5" },
    { id: 139, name: "[Level 80] To the Castle", title: "Level 80", effect: "", description: "Reach level 80", reward: "Monster stone", category: "Normal -> Character -> Page 6" },
    { id: 140, name: "[Level 83] Start, and Finish", title: "Level 83", effect: "", description: "Reach level 83", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Normal -> Character -> Page 6" },
    { id: 141, name: "Knight Sergeant", title: "Knight Sergeant", effect: "", description: "Achieve Knight Contribution Point of 500 (donated np in clan)", reward: "Monster stone", category: "Normal -> Clan -> Page 1" },
    { id: 142, name: "Knight Second Lieutenant", title: "Knight Second Lieutenant", effect: "", description: "Achieve Knight Contribution Point of 50'000 (donated np in clan)", reward: "Monster stone", category: "Normal -> Clan -> Page 2" },
    { id: 143, name: "Knight Commander", title: "Knight Commander", effect: "", description: "Achieve Knight Contribution Point of 5'000'000 (donated np in clan)", reward: "Monster stone", category: "Normal -> Clan -> Page 2" },
    { id: 144, name: "Knight Lieutenant General", title: "Knight Lieutenant General", effect: "", description: "Achieve Knight Contribution Point of 500'000'000 (donated np in clan)", reward: "Monster stone", category: "Normal -> Clan -> Page 3" },
    { id: 145, name: "Knight Enemy", title: "Knight Enemy", effect: "", description: "Achieve Knight Contribution Point of 2'000'000'000 (donated np in clan)", reward: "Monster stone", category: "Normal -> Clan -> Page 4" },
    { id: 146, name: "Merchant's Daughter", title: "Merchant's Daughter", effect: "", description: "Complete Quests for Bulk of Silk and Bandicoot Fang", reward: "Monster stone", category: "Quest -> Moradon -> Page 1" },
    { id: 147, name: "Chief Guard Patrick", title: "Chief Guard Patrick", effect: "", description: "Complete Worm Hunting, Bandicoot Hunting", reward: "Monster stone", category: "Quest -> Moradon -> Page 1" },
    { id: 148, name: "Getting Ready", title: "Getting Ready", effect: "", description: "Defeat 10 Enemy Users", reward: "Monster stone", category: "War -> Common -> Page 1" },
    { id: 149, name: "You are Done", title: "You are Done", effect: "", description: "Succeed in Revenge x10", reward: "Monster stone", category: "War -> Common -> Page 3" },
    { id: 150, name: "Everyone's Enemy!", title: "Everyone's Enemy!", effect: "", description: "Wn 10 times against another User at Moradon Duel", reward: "Monster stone", category: "War -> Moradon -> Page 1" },
    { id: 151, name: "Start of a Strategy", title: "Start of a Strategy", effect: "", description: "Win 10 times in Lunar War", reward: "Monster stone", category: "War -> Lunar -> Page 2" },
    { id: 152, name: "I've got the Know-how", title: "I've got the Know-how", effect: "", description: "Win 50 times in Lunar War", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "War -> Lunar -> Page 3" },
    { id: 153, name: "Can't stop now", title: "Can't stop now", effect: "", description: "20 or more kills in Chaos War", reward: "Monster stone", category: "War -> Chaos -> Page 2" },
    { id: 154, name: "Never Changing Castle", title: "Never Changing Castle", effect: "", description: "Cumulative Win x3 at Castle Siege", reward: "Monster stone", category: "War -> Castle Siege -> Page 1" },
    { id: 155, name: "Juraid Monster III", title: "Juraid Monster III", effect: "", description: "Complete Juraid Monster I and II in Juraid\nJuraid Monster I: Defeat 100 Lich Kings and 100 Kocatris in Juraid\nJuraid Monster II: Defeat 100 Lirimu and 100 Bone Dragons in Juraid", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 7" },
    { id: 156, name: "Oppressing the Mammoth III", title: "Oppressing the Mammoth III", effect: "", description: "Defeat 100 [Elite] Safahee Heavy Calvary in Under the Castle", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 7" },
    { id: 157, name: "Castle Soldiers I", title: "Castle Soldiers I", effect: "", description: "Defeat 100 [Elite] Kapiclue Royal Guard in Under the Castle", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 8" },
    { id: 158, name: "Castle Soldiers II", title: "Castle Soldiers II", effect: "", description: "Defeat 100 [Elite] Toorckmen in Under the Castle", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 8" },
    { id: 159, name: "Take it Easy I", title: "Take it Easy I", effect: "", description: "Defeat 100 Kapiclue Royal Guards in Under the Castle", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 8" },
    { id: 160, name: "Take it Easy II", title: "Take it Easy II", effect: "", description: "Defeat 100 Toorckmen", reward: "Monster stone", category: "Adventure -> Dungeon -> Page 8" },
    { id: 161, name: "Castle Owner", title: "Castle Owner", effect: "", description: "Complete Under the Castle I and II\nUnder the Castle I: Defeat [Machine Golem] Crashergimmic and [Abyssal Guardian] Purious\nUnder the Castle II: Defeat [Shackled Lord] Pluwitoon and [Destroyer of Flame] Pluwitoon", reward: "Battle Hero Wing Exchange Coupon (7 days)", category: "Adventure -> Dungeon -> Page 9" },
    { id: 162, name: "Chief Hunting II", title: "Chief Hunting II", effect: "", description: "Defeat [Chief] Scoride and [Chief] Byzombie", reward: "Monster stone", category: "Adventure -> Field -> Page 4" },
    { id: 163, name: "Powerless Scorpion", title: "Powerless Scorpion", effect: "", description: "Defeat Antares", reward: "Monster stone", category: "Adventure -> Field -> Page 8" },
    { id: 164, name: "David and Goliath", title: "David and Goliath", effect: "", description: "Defeat Samma in Eslant", reward: "Monster stone", category: "Adventure -> Field -> Page 27" },
    { id: 165, name: "Defeat Corrupted Prophet", title: "Defeat Corrupted Prophet", effect: "", description: "Defeat Deruvish Founder in Eslant", reward: "Monster stone", category: "Adventure -> Field -> Page 27" },
    { id: 166, name: "Day to catch Serpent", title: "Day to catch Serpent", effect: "", description: "Defeat Snake Queen in Eslant", reward: "Monster stone", category: "Adventure -> Field -> Page 27" },
    { id: 167, name: "Eslant King & Queen", title: "Eslant King & Queen", effect: "", description: "Defeat Troll King and Harpy Queen in Eslant", reward: "Monster stone", category: "Adventure -> Field -> Page 30" },
    { id: 168, name: "Rare Hunter", title: "Rare Hunter", effect: "", description: "Complete Rare Monster of the Base I and II in Ronarkland Base\nMonster of the Base I : Defeat Duke and Bach in Ronarkland Base\nMonster of the Base II: Defeat Bishop in Ronarkland Base", reward: "Monster stone", category: "Adventure -> Field -> Page 31" },
    { id: 169, name: "Ronarkland Elder I", title: "Ronarkland Elder I", effect: "", description: "Complete Chief of Dragon and Chief of Snake in Ronarkland\nChief of Dragon: Defeat 100 Enigmas in Ronarkland\nChief of Snake: Defeat 100 Cruels in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 35" },
    { id: 170, name: "Ronarkland Elder II", title: "Ronarkland Elder II", effect: "", description: "Complete Chief of Horse and Chief of Darkness in Ronarkland\nChief of Horse: Defeat 100 Havoc in Ronarkland\nChief of Darkness: Defeat 100 Hell Fire in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 36" },
    { id: 171, name: "Seal Breaker", title: "Seal Breaker", effect: "", description: "Destroy Chaos Stone in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 37" },
    { id: 172, name: "In Between the Arrow and Magic", title: "In Between the Arrow and Magic", effect: "", description: "Complete Defeat Orc Bandit I and II in Ronarkland\nOrc Bandit I: Defeat 100 Orc Bandit Archers and 100 Orc Bandit Officers (Archers)\nOrc Bandit II: Defeat 100 Ord Bandit Sorcerers and 100 Orc Bandit Officers (Sorcerers)", reward: "Monster stone", category: "Adventure -> Field -> Page 39" },
    { id: 173, name: "In Between two Swords", title: "In Between two Swords", effect: "", description: "Complete Defeat Orc Bandit III and Death of Orc Village in Ronarkland\nOrc Bandit III: Defeat 100 Orc Bandit Warriors and 100 Orc Bandit Officers (Warriors)\nDeath of Orc Village: Defeat 100 Orc Bandit Leaders in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 39" },
    { id: 174, name: "4 Sins", title: "4 Sins", effect: "", description: "Complete Shape of Sin I and II in Ronarkland\nShape of Sin I: Defeat 100 Prides and 100 Gluttons in Ronarkland\nShape of Sin II: Defeat 100 Envy and 100 Greeds in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 40" },
    { id: 175, name: "3 Sins", title: "3 Sins", effect: "", description: "Complete Shape of Sin III and IV in Ronarkland\nShape of Sin III: Defeat 100 Sloths and 100 Lusts in Ronarkland\nShape of Sin IV: Defeat 100 Wratches in Ronarkland", reward: "Monster stone", category: "Adventure -> Field -> Page 41" },
    { id: 176, name: "Defeating the Giant", title: "Defeating the Giant", effect: "", description: "Defeat Giga Hammer in Krowaz's Dominion", reward: "Monster stone", category: "Adventure -> Field -> Page 42" },
    { id: 177, name: "Treasure!", title: "Treasure!", effect: "", description: "Open Old Box in Krowaz's Dominion", reward: "Monster stone", category: "Adventure -> Field -> Page 43" }
];

  const filters = [
    'Tümü', 'War Wing', 'Monster Stone', 'attack', 'defense', 'exp',
    'dexterity', 'strength', 'intelligence', 'magic power'
  ];

  const filteredAchievements = selectedFilter === 'Tümü'
    ? achievementsData
    : achievementsData.filter(achieve => {
        if (selectedFilter === 'War Wing') {
          return achieve.reward && achieve.reward.includes('Battle Hero Wing');
        } else if (selectedFilter === 'Monster Stone') {
          return achieve.reward && achieve.reward.includes('Monster stone');
        } else {
          const effectLower = achieve.effect ? achieve.effect.toLowerCase() : '';

          if (selectedFilter === 'attack') {
            return effectLower.includes('attack') || effectLower.includes('attack power');
          } else if (selectedFilter === 'defense') {
            return effectLower.includes('defense') || effectLower.includes('defense');
          } else if (selectedFilter === 'exp') {
            return effectLower.includes('exp') || effectLower.includes('exp bonus');
          } else if (selectedFilter === 'dexterity') {
            return effectLower.includes('dexterity');
          } else if (selectedFilter === 'strength') {
            return effectLower.includes('strength');
          } else if (selectedFilter === 'intelligence') {
            return effectLower.includes('intelligence');
          } else if (selectedFilter === 'magic power') {
            return effectLower.includes('magic power');
          } else {
            return achieve.category && achieve.category.includes(selectedFilter);
          }
        }
      });

  const getCategoryDisplayName = (category) => {
    const names = {
      'Tümü': '📋 Tümü',
      'War Wing': '🪽 War Wing',
      'Monster Stone': '💎 Monster Stone',
      'attack': '⚔️ Attack',
      'defense': '🛡️ Defense',
      'exp': '⭐ EXP',
      'dexterity': '🎯 Dexterity',
      'strength': '💪 Strength',
      'intelligence': '🧠 Intelligence',
      'magic power': '🔮 Magic Power'
    };
    return names[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'War Wing': '#A78BFA',
      'Monster Stone': '#FF6B9D',
      'attack': '#FF6B6B',
      'defense': '#4ECDC4',
      'exp': '#FFD93D',
      'dexterity': '#6BCF7F',
      'strength': '#FF9F1C',
      'intelligence': '#A78BFA',
      'magic power': '#FF6B9D'
    };
    return colors[category] || '#FFD66B';
  };

  const getMainCategory = (categoryString) => {
    if (categoryString.includes('Warrior')) return 'Warrior';
    if (categoryString.includes('Mage')) return 'Mage';
    if (categoryString.includes('Rogue')) return 'Rogue';
    if (categoryString.includes('Priest')) return 'Priest';
    return 'Normal';
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>🏆 Achievements</Text>
        <Text style={styles.sectionDescription}>
          Knight Online başarımları ve ödülleri
        </Text>

        {/* Arama Çubuğu */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Başarım ara..."
            placeholderTextColor="#98A2B3"
            value={achievementSearch}
            onChangeText={setAchievementSearch}
          />
        </View>

        {/* Filtreleme Butonları */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive
              ]}>
                {getCategoryDisplayName(filter)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.card}>
          <Text style={styles.eventName}>
            {getCategoryDisplayName(selectedFilter)} ({filteredAchievements.length} başarım)
          </Text>

          {filteredAchievements.length === 0 ? (
            <Text style={styles.muted}>
              Bu filtreye uygun başarım bulunamadı.
            </Text>
          ) : (
            filteredAchievements.map((achieve) => (
              <View key={achieve.id} style={styles.achievementItem}>
                <View style={styles.achievementHeader}>
                  <Text style={styles.achievementName}>{achieve.name}</Text>
                  <View style={[
                    styles.categoryBadge,
                    { backgroundColor: getCategoryColor(getMainCategory(achieve.category)) }
                  ]}>
                    <Text style={styles.categoryText}>
                      {getCategoryDisplayName(getMainCategory(achieve.category))}
                    </Text>
                  </View>
                </View>
                <Text style={styles.achievementTitle}>{achieve.title}</Text>
                {achieve.effect && (
                  <Text style={styles.achievementEffect}>🎯 {achieve.effect}</Text>
                )}
                <Text style={styles.achievementDescription}>{achieve.description}</Text>
                {achieve.reward && (
                  <Text style={styles.achievementReward}>🏆 Ödül: {achieve.reward}</Text>
                )}
                <Text style={styles.achievementCategory}>📁 {achieve.category}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// YENİ MASTER BİLEŞENİ
const MasterScreen = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  const itemAciklamalari = [
    {
      item: 'Unstable Kenteraus Heart',
      aciklama: 'Centaur'
    },
    {
      item: 'Uruktrons Essence',
      aciklama: 'El Morad için Laiba Uruk Hai, Karus için Linate\'deki Uruk Hai\'lerde çıkar.'
    },
    {
      item: 'GaruKangos Essence', 
      aciklama: 'Raon Camp ve Doda Camp\'taki Kongau slotunda çıkar.'
    },
    {
      item: 'Trethonzs Essence',
      aciklama: 'Kalluga Valley\'de ağaç slotuna doğru giderken çıkar.'
    },
    {
      item: 'Alkeradauas Essence',
      aciklama: 'DTS ve DTC slotlarında bulunur. Görünümü de DTS\'dir.'
    },
    {
      item: 'Colmicolas Essence',
      aciklama: 'Cardinal\'in büyüğünden çıkmaktadır. Asga ve Bellua\'da scolar slotunda ve cardinal slotlarında bulabilirsiniz.'
    }
  ];

  const masterGorevleri = {
    warrior: [
      'Unstable Kenteraus Heart',
      'Uruktrons Essence',
      'Alkeradauas Essence'
    ],
    rogue: [
      'Unstable Kenteraus Heart',
      'GaruKangos Essence',
      'Trethonzs Essence'
    ],
    mage: [
      'Unstable Kenteraus Heart', 
      'Colmicolas Essence',
      'GaruKangos Essence'
    ],
    priest: [
      'Unstable Kenteraus Heart',
      'Colmicolas Essence',
      'Trethonzs Essence'
    ],
    kurian: [
      'Unstable Kenteraus Heart',
      'Uruktrons Essence',
      'Alkeradauas Essence'
    ]
  };

  // Görsel bileşeni
  const ClassImage = ({ className, onPress }) => {
    const getImageSource = () => {
      const images = {
        warrior: require('./assets/warrior.jpg'),
        rogue: require('./assets/rogue.jpg'),
        mage: require('./assets/mage.jpg'),
        priest: require('./assets/priest.jpg'),
        kurian: require('./assets/kurian.jpg'),
        master: require('./assets/master.jpg')
      };
      return images[className] || require('./assets/master.jpg');
    };

    const getClassName = () => {
      const names = {
        warrior: 'Savaşçı',
        rogue: 'Okçu',
        mage: 'Büyücü',
        priest: 'Rahip',
        kurian: 'Kuryan',
        master: 'Master Görevi'
      };
      return names[className] || className;
    };

    return (
      <TouchableOpacity onPress={onPress} style={styles.classImageContainer}>
        <Image 
          source={getImageSource()} 
          style={styles.classImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay}>
          <Text style={styles.imageText}>{getClassName()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>⚔️ Master Açma Görevi - 60 Level</Text>
        
        <View style={styles.imageContainer}>
          <ClassImage 
            className="master"
            onPress={() => setSelectedImage('master')}
          />
          <Text style={styles.imageText}>📸 Görsele tıkla büyüt</Text>
        </View>

        <Text style={styles.sectionTitle}>🎮 Sınıflara Özel Itemler</Text>

        {Object.entries(masterGorevleri).map(([className, items]) => (
          <View key={className}>
            <View style={styles.imageContainer}>
              <ClassImage 
                className={className}
                onPress={() => setSelectedImage(className)}
              />
            </View>
            <View style={styles.classSection}>
              <Text style={styles.classTitle}>
                {className === 'warrior' ? '⚔️ Warrior' : 
                 className === 'rogue' ? '🗡️ Rogue' :
                 className === 'mage' ? '🔮 Mage' :
                 className === 'priest' ? '💫 Priest' : '🛡️ Kurian'} için gereken itemler
              </Text>
              {items.map((item, index) => (
                <Text key={index} style={styles.itemText}>• {item}</Text>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>📖 Item Açıklamaları</Text>
        
        {itemAciklamalari.map((item, index) => (
          <View key={index} style={styles.aciklamaItem}>
            <Text style={styles.aciklamaItemTitle}>• {item.item}</Text>
            <Text style={styles.aciklamaItemText}>{item.aciklama}</Text>
          </View>
        ))}
      </View>

      {/* Modal for full screen image view */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalBackground}
            onPress={() => setSelectedImage(null)}
          >
            <View style={styles.fullScreenImageContainer}>
              <Image 
                source={
                  selectedImage === 'master' ? require('./assets/master.jpg') :
                  selectedImage === 'warrior' ? require('./assets/warrior.jpg') :
                  selectedImage === 'rogue' ? require('./assets/rogue.jpg') :
                  selectedImage === 'mage' ? require('./assets/mage.jpg') :
                  selectedImage === 'priest' ? require('./assets/priest.jpg') :
                  require('./assets/kurian.jpg')
                }
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
};

// Master Skill Bileşeni
const MasterSkillScreen = () => {
  const [selectedSkill, setSelectedSkill] = useState(null);

  const masterSkillVerileri = [
    { 
      seviye: "70", 
      gerekenToz: "5", 
      aciklama: "70. Seviye Master Skill açma görevi",
      detay: "70. seviye master skillini açmak için 5 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "72", 
      gerekenToz: "7", 
      aciklama: "72. Seviye Master Skill açma görevi",
      detay: "72. seviye master skillini açmak için 7 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "74", 
      gerekenToz: "9", 
      aciklama: "74. Seviye Master Skill açma görevi",
      detay: "74. seviye master skillini açmak için 9 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "75", 
      gerekenToz: "10", 
      aciklama: "75. Seviye Master Skill açma görevi",
      detay: "75. seviye master skillini açmak için 10 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC", 
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "76", 
      gerekenToz: "11", 
      aciklama: "76. Seviye Master Skill açma görevi",
      detay: "76. seviye master skillini açmak için 11 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "78", 
      gerekenToz: "12", 
      aciklama: "78. Seviye Master Skill açma görevi",
      detay: "78. seviye master skillini açmak için 12 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    },
    { 
      seviye: "80", 
      gerekenToz: "15", 
      aciklama: "80. Seviye Master Skill açma görevi",
      detay: "80. seviye master skillini açmak için 15 adet Spell Stone Powder gerekmektedir.",
      npc: "Moradon - [Master] NPC",
      location: "Moradon 726, 744 koordinatları arasında"
    }
  ];

  const sokmeSanslari = [
    { aksesuar: "Old Takı", olasilik1: "%20", miktar1: "1 Spell Stone Powder", olasilik2: "%40", miktar2: "2 Spell Stone Powder", olasilik3: "%20", miktar3: "3 Spell Stone Powder", olasilik4: "%15", miktar4: "4 Spell Stone Powder", olasilik5: "%5", miktar5: "5 Spell Stone Powder" },
    { aksesuar: "Düz Takı", olasilik1: "%9", miktar1: "1 Spell Stone Powder", olasilik2: "%20", miktar2: "2 Spell Stone Powder", olasilik3: "%40", miktar3: "3 Spell Stone Powder", olasilik4: "%20", miktar4: "4 Spell Stone Powder", olasilik5: "%9", miktar5: "5 Spell Stone Powder" }
  ];

  const MasterSkillItem = ({ seviye, gerekenToz, aciklama, onPress }) => (
    <TouchableOpacity style={styles.masterSkillItem} onPress={onPress}>
      <View style={styles.masterSkillHeader}>
        <View style={styles.levelBadge}>
          <Text style={styles.masterSkillLevel}>Lv. {seviye}</Text>
        </View>
        <View style={styles.tozContainer}>
          <Text style={styles.tozMiktar}>{gerekenToz}x</Text>
          <Text style={styles.tozText}>Spell Stone Powder</Text>
        </View>
      </View>
      <Text style={styles.masterSkillAciklama}>{aciklama}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>🔮 Master Skilleri</Text>
        <Text style={styles.sectionDescription}>
          Knight Online master skilleri ve açılma gereksinimleri
        </Text>

        <View style={styles.card}>
          <Text style={styles.eventName}>Master Skill Açma Görevleri</Text>
          
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              📢 <Text style={styles.boldText}>ÖNEMLİ BİLGİ:</Text> Artık pahalı eşyalara ihtiyacınız yok! 
              Görevler büyük ölçüde basitleştirildi.
            </Text>
          </View>

          <Text style={styles.boldText}>💎 Spell Stone Powder Nasıl Elde Edilir?</Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                <Text style={styles.boldText}>Eski veya normal aksesuarları</Text> toplayın
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Moradon'da <Text style={styles.boldText}>[Gizemli] Narki</Text> NPC'sine gidin (726, 744)
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Aksesuarları <Text style={styles.boldText}>sökerek</Text> Spell Stone Powder elde edin
              </Text>
            </View>
          </View>

          <Text style={styles.boldText}>📊 Sökme Şansı Tablosu</Text>
          
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, {flex: 2}]}>Aksesuar</Text>
              <Text style={[styles.tableHeaderText, {flex: 1}]}>1 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1}]}>2 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1}]}>3 Spell Stone Powder</Text>
            </View>
            
            {sokmeSanslari.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, {flex: 2, fontWeight: 'bold'}]}>{item.aksesuar}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik1}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik2}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik3}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.boldText}>📈 Seviyelere Göre Gereken Spell Stone Powder</Text>
          
          {masterSkillVerileri.map((skill, index) => (
            <MasterSkillItem
              key={index}
              seviye={skill.seviye}
              gerekenToz={skill.gerekenToz}
              aciklama={skill.aciklama}
              onPress={() => setSelectedSkill(skill)}
            />
          ))}

          <View style={{height: 50}} />
        </View>
      </View>

      {/* Skill Detay Modal */}
      <Modal
        visible={selectedSkill !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedSkill(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.skillModalContent}>
            <Text style={styles.skillModalTitle}>
              Lv. {selectedSkill?.seviye} Master Skill
            </Text>
            
            <View style={styles.skillDetailItem}>
              <Text style={styles.skillDetailLabel}>🔮 Gereken Spell Stone Powder:</Text>
              <Text style={styles.skillDetailValue}>{selectedSkill?.gerekenToz}x Spell Stone Powder</Text>
            </View>
            
            <View style={styles.skillDetailItem}>
              <Text style={styles.skillDetailLabel}>📖 Açıklama:</Text>
              <Text style={styles.skillDetailValue}>{selectedSkill?.detay}</Text>
            </View>
            
            <View style={styles.skillDetailItem}>
              <Text style={styles.skillDetailLabel}>👨‍💼 NPC:</Text>
              <Text style={styles.skillDetailValue}>{selectedSkill?.npc}</Text>
            </View>
            
            <View style={styles.skillDetailItem}>
              <Text style={styles.skillDetailLabel}>📍 Lokasyon:</Text>
              <Text style={styles.skillDetailValue}>{selectedSkill?.location}</Text>
            </View>

            <TouchableOpacity 
              style={styles.closeDetailButton}
              onPress={() => setSelectedSkill(null)}
            >
              <Text style={styles.closeDetailButtonText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// Görevler Bileşeni
const GorevlerScreen = () => {
  const [selectedLevelRange, setSelectedLevelRange] = useState('1-35');
  const [searchQuery, setSearchQuery] = useState('');

  // 1-35 Seviye Görevleri - DÜZENLENMİŞ
  const gorevler1_35 = [
    { seviye: "1.02", baslik: "Worm Hunt", npc: "[Guard] Patrick", aciklama: "5 Worm / Blood Worm öldürün", odul: "250 Exp, 2.000 Noah" },
    { seviye: "1.02", baslik: "Get rid of the mice", npc: "[Kurian] Potrang", aciklama: "5 Bandicoot / Scavenger Bandicoot öldürün", odul: "250 Exp, 2.000 Noah" },
    { seviye: "1.02", baslik: "Manufacture Clothing", npc: "[Kurian] Potrang", aciklama: "Potrang'a 2 Apple of Moradon teslim edin", odul: "250 Exp, 2.000 Noah" },
    { seviye: "1.02", baslik: "Obtaining food", npc: "[Kurian] Potrang", aciklama: "Potrang'a 2 Apple of Moradon teslim edin", odul: "250 Exp, 2.000 Noah" },
    { seviye: "2", baslik: "Silk Spool", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 2 Apple of Moradon teslim edin", odul: "250 Exp, 2.500 Noah" },
    { seviye: "3", baslik: "Bandicoot hunt", npc: "[Guard] Patrick", aciklama: "5 Bandicoot öldürün", odul: "375 Exp, 2.700 Noah" },
    { seviye: "4", baslik: "Kaishan's trust", npc: "Kaishan", aciklama: "Kaishan'a 20 Apple of Moradon teslim edin", odul: "15.000 Exp" },
    { seviye: "4", baslik: "Billbor's trust", npc: "Billbor", aciklama: "Billbor'a 1 Secret Account Book teslim edin (limandaki Looter'lardan düşmekte)", odul: "15.000 Exp" },
    { seviye: "4", baslik: "Gaining trust", npc: "[Kurian] Potrang", aciklama: "Token that represent Patrick's trust, Token that represent Billbor's trust, Token that represent Menissia's trust ve Token that represent Kaishan's trust eşyalarını Potrang'e teslim edin", odul: "15.000 Exp, 2.000 Noah" },
    { seviye: "4", baslik: "Bandicoot Tooth", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 2 Apple of Moradon teslim edin", odul: "850 Exp, 3.500 Noah" },
    { seviye: "5", baslik: "Monster Suppression Squad (I)", npc: "[Mercenary Captain] Cougar", aciklama: "Cougar'a, gireceğiniz zindandan 1 Proof of Orc Bandit Boss teslim edin", odul: "1,250 Exp, 2.000 Noah" },
    { seviye: "6", baslik: "Kecoon hunting", npc: "[Guard] Patrick", aciklama: "5 Kecoon öldürün", odul: "1,875 Exp, 2.000 Noah, 1 Red Pearl Ring(+5)" },
    { seviye: "7", baslik: "Making antifebriles paletts", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 2 Apple of Moradon teslim edin", odul: "3.500 Exp" },
    { seviye: "8", baslik: "Bulcan hunting", npc: "[Guard] Patrick", aciklama: "5 Bulcan öldürün", odul: "3.500 Exp" },
    { seviye: "9", baslik: "Upgrade to Strengthen weapons", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya Dagger(+2) teslim edin", odul: "1 Quest weapon" },
    { seviye: "9", baslik: "Wild Bulcan hunting", npc: "[Guard] Patrick", aciklama: "5 Wild Bulcan öldürün", odul: "4.500 Exp" },
    { seviye: "9.59", baslik: "Characteristic of weapon offering striking power", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya Poison'lı Dagger(+1) teslim edin", odul: "50.000 Noah" },
    { seviye: "10", baslik: "1st job change", npc: "Kaishan", aciklama: "Kaishan'ı ziyaret edip ona 3.000 Coin verin", odul: "1 1st job change" },
    { seviye: "10.29", baslik: "Pet", npc: "[Familliar Tamer] Kate", aciklama: "10 Worm, 10 Bandicoot, 10 Kekoon ve 10 Bulcan öldürün", odul: "" },
    { seviye: "10.59", baslik: "Kekoon Warrior hunting", npc: "[Guard] Patrick", aciklama: "5 Kekoon Warrior öldürün", odul: "6.250 Exp" },
    { seviye: "11", baslik: "Kecoon Armor", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya 2 Apple of Moradon teslim edin", odul: "6.250 Exp" },
    { seviye: "11.32", baslik: "Subdual of Gavolt", npc: "[Guard] Patrick", aciklama: "5 Gavolt öldürün", odul: "6.250 Exp" },
    { seviye: "12", baslik: "Hasten Potion", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 2 Apple of Moradon teslim edin", odul: "7.500 Exp, 1 Low level pads (+5)" },
    { seviye: "12", baslik: "Discipline", npc: "[Mercenary Captain] Cougar", aciklama: "", odul: "10.000 Exp" },
    { seviye: "13", baslik: "Kekoon Captain Hunt", npc: "[Guard] Patrick", aciklama: "5 Kekoon Captain öldürün", odul: "11,250 Exp" },
    { seviye: "14", baslik: "Subdual of Vulture", npc: "[Guard] Patrick", aciklama: "5 Bulture öldürün", odul: "13.750 Exp" },
    { seviye: "15", baslik: "Giant Bulcan Hunting", npc: "[Guard] Patrick", aciklama: "10 Giant Bulcan öldürün", odul: "15.000 Exp" },
    { seviye: "16", baslik: "Werewolf elimination", npc: "[Guard] Patrick", aciklama: "5 Werewolf öldürün", odul: "15.000 Exp" },
    { seviye: "16", baslik: "Low-Level weapon production", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya 3 Bulture Horn, 3 Iron Bar ve 1.000 teslim edin", odul: "1 Quest weapon" },
    { seviye: "17", baslik: "Subdual of Silan", npc: "[Guard] Patrick", aciklama: "5 Silan öldürün", odul: "17.500 Exp, 1 Low level helmet (+6)" },
    { seviye: "17", baslik: "Trade with Menissiah", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 5 Apple of Moradon teslim edin", odul: "3 Elemental scroll (Low class)" },
    { seviye: "17.38", baslik: "Silan's bone", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya 2 Apple of Moradon teslim edin", odul: "20.000 Exp, 100.000 Noah" },
    { seviye: "18", baslik: "Collecting Wolfman's fangs", npc: "[Blacksmith] Hepa", aciklama: "Hepa'ya 3 Apple of Moradon teslim edin", odul: "25.000 Exp" },
    { seviye: "18.45", baslik: "Fishing Float Material", npc: "[Entrepot Trader] Berret", aciklama: "Berret'e 3 Apple of Moradon teslim edin", odul: "30.000 Exp, 100.000 Noah, 1 Low level pants (+6)" },
    { seviye: "19", baslik: "Giant Gavolt hunting", npc: "[Guard] Patrick", aciklama: "10 Giant Gavolt öldürün", odul: "47.500 Exp" },
    { seviye: "20", baslik: "[Chaos] Emblem of Chaos I", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 1 Voucher of Chaos teslim edin", odul: "75.000 Exp, 100.000 Noah" },
    { seviye: "20", baslik: "Glyptodont hunt", npc: "[Guard] Patrick", aciklama: "1 Glyptodont öldürün", odul: "50.000 Exp, 30 Water of Grace, 30 Potion of Wisdom" },
    { seviye: "20.38", baslik: "Werewolf skin", npc: "[Guard] Patrick", aciklama: "Patrick'e 5 Apple of Moradon teslim edin", odul: "75.000 Exp" },
    { seviye: "21", baslik: "Gemstone of Courage", npc: "[Mercenary Captain] Cougar", aciklama: "Gireceğiniz zindandaki yaratıklardan 10x Gem of Bravery toplayın", odul: "150.000 Exp, 1 Low level pauldron (+6)" },
    { seviye: "22", baslik: "Gloomwing hunt", npc: "[Guard] Patrick", aciklama: "10 Gloomwing öldürün", odul: "125.000 Exp, 1 Red Pearl Ring(+6)" },
    { seviye: "23", baslik: "Orc Watcher hunting", npc: "[Guard] Patrick", aciklama: "10 Orc Watcher öldürün", odul: "210.000 Exp, 1 Quest item" },
    { seviye: "24", baslik: "Battle Armor 1", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Spoiler öldürün", odul: "75.000 Exp, 1 War boots" },
    { seviye: "24.32", baslik: "Folk Village Construction", npc: "[Mercenary Supply Officer] Osmond", aciklama: "Osmond'a 2 Apple of Moradon teslim edin", odul: "125.000 Exp, 50.000 Noah, 1 Red Pearl Ring(+6)" },
    { seviye: "25", baslik: "Battle Armor 2", npc: "[Mercenary Adjutant] Lazi", aciklama: "5 Scorpion öldürün", odul: "75.000 Exp, 1 War Gauntlets" },
    { seviye: "25.38", baslik: "Rest of Soul", npc: "Nameless Warrior", aciklama: "5 Rotten Eye öldürün", odul: "125.000 Exp, 50 Water of Grace, 40 Potion of Wisdom, 1 Pearl Earring(+6)" },
    { seviye: "26", baslik: "Battle Armor 3", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Lycan öldürün", odul: "112.500 Exp, 1 War Helmet" },
    { seviye: "26.37", baslik: "Unknown warrior's song", npc: "Nameless Warrior", aciklama: "Nameless Warrior'a 3 Apple of Moradon teslim edin", odul: "112.500 Exp, 150.000 Noah, 1 Pearl Earring(+6)" },
    { seviye: "27", baslik: "Battle Armor 4", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Lugaru öldürün", odul: "175.000 Exp, 1 War Pads" },
    { seviye: "28", baslik: "Osmoond's Request", npc: "[Mercenary Supply Officer] Osmond", aciklama: "Osmoond'a 1 Apple of Moradon teslim edin", odul: "3 Upgrade Scroll (middle class)" },
    { seviye: "28", baslik: "Battle Armor 5", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Dark Eye öldürün", odul: "150.000 Exp, 1 War Pauldron" },
    { seviye: "28.37", baslik: "Stop decrease in morale", npc: "[Mercenary Adjutant] Lazi", aciklama: "Lazi'ye 3 Apple of Moradon teslim edin", odul: "50.000 Exp, 1 Quest weapon" },
    { seviye: "29", baslik: "First preparation of war materials", npc: "[Mercenary Supply Officer] Osmond", aciklama: "Osmoond'a 2 Apple of Moradon teslim edin", odul: "150.000 Exp, 1 Topaz Pendant (+6)" },
    { seviye: "29.32", baslik: "Subdual of Keilan", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Keilan öldürün", odul: "150.000 Exp, 300.000 Noah" },
    { seviye: "30", baslik: "Full Plate Armor 1", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Skeleton öldürün", odul: "250.000 Exp, 1 Full Plate Boots (+5), 1 Royal Guardsman Boots" },
    { seviye: "30.27", baslik: "Second preparation of war materials", npc: "[Mercenary Supply Officer] Osmond", aciklama: "[Field Boss] Wolfraiger, [Field Boss] Omegatron, [Field Boss] Gavoltin ve [Field Boss] Scolaid'i öldürün", odul: "250.000 Exp, 200.000 Noah, 60 Water of Grace, 40 Potion of Wisdom" },
    { seviye: "30.54", baslik: "Third preparation of war materials", npc: "[Mercenary Supply Officer] Osmond", aciklama: "Osmoond'a 2 Apple of Moradon teslim edin", odul: "300.000 Exp, 1 Low fur belt (+6)" },
    { seviye: "31", baslik: "Full Plate Armor 2", npc: "[Mercenary Adjutant] Lazi", aciklama: "5 Paralyzer öldürün", odul: "375.000 Exp, 1 Full Plate Gauntlets (+5), 1 Royal Guardsman Gauntlets" },
    { seviye: "31.37", baslik: "Antidote", npc: "[Entrepot Trader] Berret", aciklama: "Berret'e 3 Apple of Moradon teslim edin", odul: "500.000 Exp" },
    { seviye: "32", baslik: "Full Plate Armor 3", npc: "[Mercenary Adjutant] Lazi", aciklama: "10 Dire Wolf öldürün", odul: "425.000 Exp, 1 Full Plate Helmet (+5), 1 Royal Guardsman Helmet" },
    { seviye: "32.3", baslik: "Wolf Products", npc: "[Entrepot Trader] Berret", aciklama: "Berret'e 4 Apple of Moradon teslim edin", odul: "550.000 Exp" },
    { seviye: "33", baslik: "Full Plate Armor 4", npc: "[Mercenary Adjutant] Lazi", aciklama: "5 Smilodon öldürün", odul: "500.000 Exp, 1 Full Plate Pads (+5), 1 Royal Guardsman Pads" },
    { seviye: "33.4", baslik: "Smirdons Meat", npc: "[Entrepot Trader] Berret", aciklama: "Berret'e 2 Apple of Moradon teslim edin", odul: "625.000 Exp" },
    { seviye: "34", baslik: "Full Plate Armor 5", npc: "[Mercenary Adjutant] Lazi", aciklama: "5 Wild Smilodon öldürün", odul: "550.000 Exp, 1 Full Plate Pauldron (+5), 1 Royal Guardsman Pauldron" },
    { seviye: "34.4", baslik: "Smirdons Hides", npc: "[Entrepot Trader] Berret", aciklama: "Berret'e 2 Apple of Moradon teslim edin", odul: "675.000 Exp" },
    { seviye: "35", baslik: "Vilbore's Gift", npc: "[Manager] Billbor", aciklama: "Oyuna başladığınızda çantanızda bir Promise of Training olacak. Bunu silmediyseniz Billbor'a teslim edin", odul: "3x Scroll of Armor 200, 3x Scroll of 1000 HP Up, 3x Speed-Up Potion, 3x Ascent Scroll" },
    { seviye: "35", baslik: "The Beginning of a New Adventure 1 (El Morad)", npc: "[Mercenary Captain] Cougar", aciklama: "Cougar'dan alacağınız El Morad Intro'yu, El Morad Castle'da bulunan [Captain] Folkwein'e teslim edin", odul: "100.000 Coin" },
    { seviye: "35", baslik: "The Beginning of a New Adventure 1 (Karus)", npc: "[Mercenary Captain] Cougar", aciklama: "Cougar'dan alacağınız Karus Intro'yu, Luferson Castle'da bulunan [Captain] Fargo'ya teslim edin", odul: "100.000 Coin" },
    { seviye: "35", baslik: "The dangerous escape", npc: "[Grand Elder] Atlas", aciklama: "30 Wolf Dog ve 30 Savage öldürün", odul: "300.000 Exp" },
    { seviye: "35", baslik: "The dangerous escape", npc: "[Grand Elder] Morbor", aciklama: "30 Wolf Dog ve 30 Savage öldürün", odul: "300.000 Exp" },
    { seviye: "35", baslik: "Food shortage 2", npc: "[Grand Elder] Atlas", aciklama: "Atlas'a 20 Shebiji Meat teslim edin", odul: "300.000 Exp" },
    { seviye: "35", baslik: "Food shortage 2", npc: "[Grand Elder] Morbor", aciklama: "Morbor'a 20 Shebiji Meat teslim edin", odul: "300.000 Exp" },
    { seviye: "35", baslik: "Shadow Seeker Hunt", npc: "[Guard] Zalk", aciklama: "15 Shadow Seeker öldürün", odul: "270.000 Exp, 1 Quest weapon" },
    { seviye: "35", baslik: "Shadow Seeker Hunt", npc: "[Guard] Malverick", aciklama: "15 Shadow Seeker öldürün", odul: "270.000 Exp, 1 Quest weapon" },
    { seviye: "35", baslik: "[Repeatable] Maria's concern", npc: "[Sorcerer] Maria", aciklama: "[Sorcerer] Maria'ya Tarantula's tooth teslim edin", odul: "10.000 Noah" },
    { seviye: "35", baslik: "[Repeatable] Room of Dark Dragon", npc: "[Sorcerer] Samathran", aciklama: "[Sorcerer] Samathran'a 5 Tarantula's teeth teslim edin", odul: "1 Castellan's key" },
    { seviye: "35", baslik: "Investigation Mission", npc: "[Priest] Sol", aciklama: "Draki's Tower'da Captured Girl ile konuşun", odul: "1.500.000 Exp, 70 Water of Grace" },
    { seviye: "35", baslik: "Investigation Mission", npc: "[Priest] Ann", aciklama: "Draki's Tower'da Captured Girl ile konuşun", odul: "1.500.000 Exp, 70 Water of Grace" },
    { seviye: "35", baslik: "Daughter's present", npc: "Sadi - El Morad", aciklama: "Sadi'ye 20 Wolf Dog Leathers teslim edin", odul: "300.000 Exp" },
    { seviye: "35", baslik: "Daughter's present", npc: "Sadi - Karus", aciklama: "Sadi'ye 20 Wolf Dog Leathers teslim edin", odul: "300.000 Exp" },
    { seviye: "35", baslik: "Rescuing Parents I", npc: "[Priest] Sol", aciklama: "Draki's Tower'da Captured Karus Warrior ile konuşun", odul: "1.000.000 Exp, 40 Potion of Wisdom" },
  ];

  // 35-59 Seviye Görevleri
  const gorevler35_59 = [
    { seviye: "35.33", baslik: "Animal Blood", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Animal Blood teslim edin", odul: "675.000 Exp" },
    { seviye: "35.33", baslik: "Animal Blood", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Animal Blood teslim edin", odul: "675.000 Exp" },
    { seviye: "36", baslik: "Defend the Gravesite", npc: "[Tomb Gatekeper] Slay", aciklama: "15 Rotten Eye öldürün", odul: "750.000 Exp, 1 Royal Knight Boots, 75 Water of Grace, 40 Potion of Wisdom" },
    { seviye: "36", baslik: "Defend the Gravesite", npc: "[Tomb Gatekeper] Bertem", aciklama: "15 Rotten Eye öldürün", odul: "750.000 Exp, 1 Royal Knight Boots, 75 Water of Grace, 40 Potion of Wisdom" },
    { seviye: "36.33", baslik: "Rotten Eye", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Rotten Eye teslim edin", odul: "750.000 Exp" },
    { seviye: "36.33", baslik: "Rotten Eye", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Rotten Eye teslim edin", odul: "750.000 Exp" },
    { seviye: "37", baslik: "Sabertooth Hunt", npc: "[Guard] Zalk", aciklama: "15 Sabertooth öldürün", odul: "825.000 Exp, 1 Royal Knight Gauntlets" },
    { seviye: "37", baslik: "Sabertooth Hunt", npc: "[Guard] Malverick", aciklama: "15 Sabertooth öldürün", odul: "825.000 Exp, 1 Royal Knight Gauntlets" },
    { seviye: "37", baslik: "Silver Hair I", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Silver Feather teslim edin", odul: "825.000 Exp" },
    { seviye: "37", baslik: "Silver Hair I", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Silver Feather teslim edin", odul: "825.000 Exp" },
    { seviye: "38", baslik: "Skeleton Warrior Hunt", npc: "[Guard] Zalk", aciklama: "15 Skeleton Warrior öldürün", odul: "925.000 Exp, 1 Royal Knight Helmet" },
    { seviye: "38", baslik: "Skeleton Warrior Hunt", npc: "[Guard] Malverick", aciklama: "15 Skeleton Warrior öldürün", odul: "925.000 Exp, 1 Royal Knight Helmet" },
    { seviye: "38.34", baslik: "Skull Collection", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Apple of Moradon teslim edin", odul: "925.000 Exp" },
    { seviye: "38.34", baslik: "Skull Collection", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Apple of Moradon teslim edin", odul: "925.000 Exp" },
    { seviye: "39", baslik: "Skeleton Knight Hunt", npc: "[Guard] Zalk", aciklama: "15 Skeleton Knight öldürün", odul: "1.000.000 Exp, 1 Royal Knight Pads" },
    { seviye: "39", baslik: "Skeleton Knight Hunt", npc: "[Guard] Malverick", aciklama: "15 Skeleton Knight öldürün", odul: "1.000.000 Exp, 1 Royal Knight Pads" },
    { seviye: "39.33", baslik: "Coarse Bone Powder", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Coarse Ground Bone teslim edin", odul: "1.000.000 Exp" },
    { seviye: "39.33", baslik: "Coarse Bone Powder", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Coarse Ground Bone teslim edin", odul: "1.000.000 Exp" },
    { seviye: "40", baslik: "Death Knight Hunt", npc: "[Guard] Zalk", aciklama: "20 Death Knight öldürün", odul: "1,875.000 Exp, 1 Royal Knight Pauldron, 85 Water of Grace, 50 Potion of Wisdom" },
    { seviye: "40", baslik: "Death Knight Hunt", npc: "[Guard] Malverick", aciklama: "20 Death Knight öldürün", odul: "1,875.000 Exp, 1 Royal Knight Pauldron, 85 Water of Grace, 50 Potion of Wisdom" },
    { seviye: "40", baslik: "[Chaos] Emblem of Chaos II", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 2 Voucher of Moradon teslim edin", odul: "2.000.000 Exp, 50 National Point" },
    { seviye: "40.31", baslik: "Offering", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 10 Apple of Moradon teslim edin", odul: "2.000.000 Exp, 100.000 Noah" },
    { seviye: "40.31", baslik: "Offering", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 10 Apple of Moradon teslim edin", odul: "2.000.000 Exp, 100.000 Noah" },
    { seviye: "41", baslik: "Eradcate Lard Orc", npc: "[Guard] Cheina", aciklama: "20 Lard Orc öldürün", odul: "850.000 Exp, 100.000 Noah, 1 Quest weapon" },
    { seviye: "41", baslik: "Eradcate Lard Orc", npc: "[Guard] Keife", aciklama: "20 Lard Orc öldürün", odul: "850.000 Exp, 100.000 Noah, 1 Quest weapon" },
    { seviye: "41.32", baslik: "Orc Talisman", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 7 Orc Talisman teslim edin", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "41.32", baslik: "Orc Talisman", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 7 Orc Talisman teslim edin", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "42", baslik: "Univited Guest at Gravesite", npc: "[Tomb Gatekeper] Slay", aciklama: "20 Battalion öldürün", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "42", baslik: "Univited Guest at Gravesite", npc: "[Tomb Gatekeper] Bertem", aciklama: "20 Battalion öldürün", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "42.32", baslik: "Covenant of Darkness", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 3 Oath of Darkness teslim edin", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "42.32", baslik: "Covenant of Darkness", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 3 Oath of Darkness teslim edin", odul: "2.250.000 Exp, 100.000 Noah" },
    { seviye: "43", baslik: "Megantelion Hunt", npc: "[Guard] Cheina", aciklama: "20 Megathereon öldürün", odul: "2,375.000 Exp, 100.000 Noah" },
    { seviye: "43", baslik: "Megantelion Hunt", npc: "[Guard] Keife", aciklama: "20 Megathereon öldürün", odul: "2,375.000 Exp, 100.000 Noah" },
    { seviye: "43.3", baslik: "Silver Hair II", npc: "[Moradon Merchant] Clark", aciklama: "Clark'a 7 Silver Feather teslim edin", odul: "2,375.000 Exp, 100.000 Noah" },
    { seviye: "43.3", baslik: "Silver Hair II", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer'a 7 Silver Feather teslim edin", odul: "2,375.000 Exp, 100.000 Noah" },
    { seviye: "44", baslik: "Ape Hunt", npc: "[Mercenary] Tales", aciklama: "20 Ape öldürün", odul: "2.500.000 Exp, 100.000 Noah" },
    { seviye: "44", baslik: "Ape Hunt", npc: "[Mercenary] Russel", aciklama: "20 Ape öldürün", odul: "2.500.000 Exp, 100.000 Noah" },
    { seviye: "44.28", baslik: "Scouting Report", npc: "[Captain] Falkwine", aciklama: "Falkwine'a 1 Reconnaissance Report ve 3 Reconnaissance Map teslim edin", odul: "2.500.000 Exp, 100.000 Noah" },
    { seviye: "44.28", baslik: "Scouting Report", npc: "[Captain] Fargo", aciklama: "Fargo'ya 1 Reconnaissance Report ve 3 Reconnaissance Map teslim edin", odul: "2.500.000 Exp, 100.000 Noah" },
    { seviye: "45", baslik: "The Beginning of a New Adventure 2 (Ardream)", npc: "[Captain] Folkwein", aciklama: "Folkwein'in vereceği Ardream Intro'yu Ardream'de bulunan [Search Captain] Laek'e teslim edin", odul: "100.000 Coin" },
    { seviye: "45", baslik: "The Beginning of a New Adventure 2 (Ardream)", npc: "[Captain] Fargo", aciklama: "Fargo'nun vereceği Ardream Intro'yu Ardream'de bulunan [Search Captain] Zamed'e teslim edin", odul: "100.000 Coin" },
    { seviye: "45", baslik: "Scuola Hunt", npc: "[Guard] Cheina", aciklama: "10 Scolar öldürün", odul: "3.750.000 Exp, 100.000 Noah" },
    { seviye: "45", baslik: "Scuola Hunt", npc: "[Guard] Keife", aciklama: "10 Scolar öldürün", odul: "3.750.000 Exp, 100.000 Noah" },
    { seviye: "45.28", baslik: "Kongaus Hunt", npc: "[Mercenary] Tales", aciklama: "20 Kongau öldürün", odul: "3.750.000 Exp, 100.000 Noah, 100 Water of Grace, 70 Potion of Wisdom" },
    { seviye: "45.28", baslik: "Kongaus Hunt", npc: "[Mercenary] Russel", aciklama: "20 Kongau öldürün", odul: "3.750.000 Exp, 100.000 Noah, 100 Water of Grace, 70 Potion of Wisdom" },
    { seviye: "46", baslik: "Burning Skeleton Hunt", npc: "[Mercenary] Tales", aciklama: "30 Burning Skeleton öldürün", odul: "2.500.000 Exp" },
    { seviye: "46", baslik: "Burning Skeleton Hunt", npc: "[Mercenary] Russel", aciklama: "20 Burning Skeleton öldürün", odul: "2.500.000 Exp, 100.000 Noah" },
    { seviye: "46.17", baslik: "Monster Suppression Squad (II)", npc: "[Captain] Falkwine", aciklama: "Falkwine'a 3 Certificate of Hunting ve 1 Grape Ripper's Certificate teslim edin", odul: "1.500.000 Exp, 100.000 Noah, 1 Quest weapon" },
    { seviye: "46.17", baslik: "Monster Suppression Squad (II)", npc: "[Captain] Fargo", aciklama: "Fargo'ya 3 Certificate of Hunting ve 1 Grape Ripper's Certificate teslim edin", odul: "1.500.000 Exp, 100.000 Noah, 1 Quest weapon" },
    { seviye: "46.43", baslik: "Barbeque Ingredient", npc: "[Imperial Palace Chef] Veros", aciklama: "Veros'a 2 Tyon Meat teslim edin", odul: "2.500.000 Exp, 100.000 Noah, 1 BBQ Dish" },
    { seviye: "46.43", baslik: "Barbeque Ingredient", npc: "[Imperial Palace Chef] Jakata", aciklama: "Jakata'ya 2 Tyon Meat teslim edin", odul: "2.500.000 Exp, 100.000 Noah, 1 BBQ Dish" },
    { seviye: "47", baslik: "Hornet Hunt", npc: "[Imperial Palace Guard] Telson", aciklama: "30 Hornet öldürün", odul: "4.000.000 Exp, 100.000 Noah" },
    { seviye: "47", baslik: "Hornet Hunt", npc: "[Imperial Palace Guard] Verca", aciklama: "30 Hornet öldürün", odul: "4.000.000 Exp, 100.000 Noah" },
    { seviye: "47.23", baslik: "Legendary Ring", npc: "[Guard] Cheina", aciklama: "40 Macairodus öldürün", odul: "1.900.000 Exp, 100.000 Noah, 1 Quest ring – grade 1" },
    { seviye: "47.23", baslik: "Legendary Ring", npc: "[Guard] Keife", aciklama: "40 Macairodus öldürün", odul: "1.900.000 Exp, 100.000 Noah, 1 Quest ring – grade 1" },
    { seviye: "48", baslik: "Ash Knight Hunt", npc: "[Mercenary] Tales", aciklama: "20 Ash Knight öldürün", odul: "4.250.000 Exp, 100.000 Noah" },
    { seviye: "48", baslik: "Ash Knight Hunt", npc: "[Mercenary] Russel", aciklama: "20 Ash Knight öldürün", odul: "4.250.000 Exp, 100.000 Noah" },
    { seviye: "49", baslik: "Haunga Hunt", npc: "[Mercenary] Tales", aciklama: "20 Haunga öldürün", odul: "4.500.000 Exp, 100.000 Noah" },
    { seviye: "49", baslik: "Haunga Hunt", npc: "[Mercenary] Russel", aciklama: "20 Haunga öldürün", odul: "4.500.000 Exp, 100.000 Noah" },
    { seviye: "50", baslik: "Lamia Hunt", npc: "[Guard] Beth", aciklama: "20 Lamia öldürün", odul: "12.500.000 Exp, 1 Troll Armor Gauntlets" },
    { seviye: "50", baslik: "Lamia Hunt", npc: "[Guard] Hashan", aciklama: "20 Lamia öldürün", odul: "12.500.000 Exp, 1 Troll Armor Gauntlets" },
    { seviye: "50.32", baslik: "Legendary Earring", npc: "[Mercenary] Tales", aciklama: "30 Sherrif öldürün", odul: "4.500.000 Exp, 1 Quest Earring – grade 1" },
    { seviye: "50.32", baslik: "Legendary Earring", npc: "[Mercenary] Russel", aciklama: "30 Sherrif öldürün", odul: "4.500.000 Exp, 1 Quest Earring – grade 1" },
    { seviye: "51", baslik: "Eradicate Uruk Hai", npc: "[Guard] Beth", aciklama: "20 Uruk Hai öldürün", odul: "13.750.000 Exp, 1 Troll Armor Boots" },
    { seviye: "51", baslik: "Eradicate Uruk Hai", npc: "[Guard] Hashan", aciklama: "20 Uruk Hai öldürün", odul: "13.750.000 Exp, 1 Troll Armor Boots" },
    { seviye: "51.32", baslik: "Legendary Belt", npc: "[Guard] Cheina", aciklama: "20 Blood Don öldürün", odul: "4.000.000 Exp, 1 Quest belt – grade 1" },
    { seviye: "51.32", baslik: "Legendary Belt", npc: "[Guard] Keife", aciklama: "20 Blood Don öldürün", odul: "4.000.000 Exp, 1 Quest belt – grade 1" },
    { seviye: "52", baslik: "Haunga Warrior Hunt", npc: "[Imperial Palace Guard] Telson", aciklama: "20 Haunga Warrior öldürün", odul: "11,250.000 Exp, 1 Troll Armor Helmet" },
    { seviye: "52", baslik: "Haunga Warrior Hunt", npc: "[Imperial Palace Guard] Verca", aciklama: "20 Haunga Warrior öldürün", odul: "11,250.000 Exp, 1 Troll Armor Helmet" },
    { seviye: "52.32", baslik: "Legendary Pendant", npc: "[Mercenary] Tales", aciklama: "30 Garuna öldürün", odul: "4.500.000 Exp, 1 Quest pendant – grade 1" },
    { seviye: "52.32", baslik: "Legendary Pendant", npc: "[Mercenary] Russel", aciklama: "30 Garuna öldürün", odul: "4.500.000 Exp, 1 Quest pendant – grade 1" },
    { seviye: "53", baslik: "Dragon Tooth Soldier Hunt", npc: "[Mercenary] Tales", aciklama: "20 Dragon Tooth Soldier öldürün", odul: "13.750.000 Exp, 1 Troll Armor Lower Garment" },
    { seviye: "53", baslik: "Dragon Tooth Soldier Hunt", npc: "[Mercenary] Russel", aciklama: "20 Dragon Tooth Soldier öldürün", odul: "13.750.000 Exp, 1 Troll Armor Lower Garment" },
    { seviye: "53.27", baslik: "Treant Hunt", npc: "[Guard] Beth", aciklama: "20 Treant öldürün", odul: "15.000.000 Exp, 5 Weapon Enchant Scroll, 5 Armor Enchant Scroll" },
    { seviye: "53.27", baslik: "Treant Hunt", npc: "[Guard] Hashan", aciklama: "20 Treant öldürün", odul: "15.000.000 Exp, 5 Weapon Enchant Scroll, 5 Armor Enchant Scroll" },
    { seviye: "54", baslik: "Ancient Hunt", npc: "[Guard] Beth", aciklama: "20 Ancient öldürün", odul: "16.250.000 Exp, 1 Troll Armor Upper Garment" },
    { seviye: "54", baslik: "Ancient Hunt", npc: "[Guard] Hashan", aciklama: "20 Ancient öldürün", odul: "16.250.000 Exp, 1 Troll Armor Upper Garment" },
    { seviye: "54.27", baslik: "Dragon Tooth Knight Hunt", npc: "[Mercenary] Tales", aciklama: "20 Dragon Tooth Skeleton öldürün", odul: "16.250.000 Exp" },
    { seviye: "54.27", baslik: "Dragon Tooth Knight Hunt", npc: "[Mercenary] Russel", aciklama: "20 Dragon Tooth Skeleton öldürün", odul: "16.250.000 Exp" },
    { seviye: "55", baslik: "Manticore Hunt", npc: "[Guard] Beth", aciklama: "20 Manticore öldürün", odul: "25.000.000 Exp" },
    { seviye: "55", baslik: "Manticore Hunt", npc: "[Guard] Hashan", aciklama: "20 Manticore öldürün", odul: "25.000.000 Exp" },
    { seviye: "56", baslik: "Uruk Blade Hunt", npc: "[Guard] Beth", aciklama: "20 Uruk Blade öldürün", odul: "25.000.000 Exp" },
    { seviye: "56", baslik: "Uruk Blade Hunt", npc: "[Guard] Hashan", aciklama: "20 Uruk Blade öldürün", odul: "25.000.000 Exp" },
    { seviye: "56.27", baslik: "Grell Hunt", npc: "[Guard] Cheina", aciklama: "20 Grell öldürün", odul: "30.000.000 Exp, 1 Green Treasure Chest" },
    { seviye: "56.27", baslik: "Grell Hunt", npc: "[Guard] Keife", aciklama: "20 Grell öldürün", odul: "30.000.000 Exp, 1 Green Treasure Chest" },
    { seviye: "57", baslik: "Phantom Hunt", npc: "[Imperial Palace Guard] Telson", aciklama: "20 Phantom öldürün", odul: "30.000.000 Exp, 5 Transformation Scroll" },
    { seviye: "57", baslik: "Phantom Hunt", npc: "[Imperial Palace Guard] Verca", aciklama: "20 Phantom öldürün", odul: "30.000.000 Exp, 5 Transformation Scroll" },
    { seviye: "57.29", baslik: "Hell Hound Hunt", npc: "[Guard] Cheina", aciklama: "20 Hellhound öldürün", odul: "30.000.000 Exp" },
    { seviye: "57.29", baslik: "Hell Hound Hunt", npc: "[Guard] Keife", aciklama: "20 Hellhound öldürün", odul: "30.000.000 Exp" },
    { seviye: "58", baslik: "Groom Hound Hunt", npc: "[Imperial Palace Guard] Telson", aciklama: "20 Groom Hound öldürün", odul: "35.000.000 Exp" },
    { seviye: "58", baslik: "Groom Hound Hunt", npc: "[Imperial Palace Guard] Verca", aciklama: "20 Groom Hound öldürün", odul: "35.000.000 Exp" },
    { seviye: "58.31", baslik: "Manticore Hunt (Dragon Tooth Commander)", npc: "[Guard] Cheina", aciklama: "20 Dragon Tooth Commander öldürün", odul: "32.500.000 Exp" },
    { seviye: "58.31", baslik: "Manticore Hunt (Dragon Tooth Commander)", npc: "[Guard] Keife", aciklama: "20 Dragon Tooth Commander öldürün", odul: "32.500.000 Exp" },
    { seviye: "59", baslik: "Preemptive Strike", npc: "[Mercenary] Tales", aciklama: "Master tüplerinizin düştüğü [Field Boss]'ların iki türünden 10'ar tane öldürün", odul: "25.000.000 Exp" },
    { seviye: "59", baslik: "Preemptive Strike", npc: "[Mercenary] Russel", aciklama: "Master tüplerinizin düştüğü [Field Boss]'ların iki türünden 10'ar tane öldürün", odul: "25.000.000 Exp" },
  ];

  // 60-70 Seviye Görevleri - YENİ EKLENDİ
  const gorevler60_70 = [
    { seviye: "60", baslik: "Guardian of 7 Keys", npc: "[Captain] Falkwine", aciklama: "Anahtar görevini tamamlayın. Detaylı rehbere buradan ulaşabilirsiniz.", odul: "38.047.370 Exp" },
    { seviye: "60", baslik: "Guardian of 7 Keys", npc: "[Captain] Fargo", aciklama: "Anahtar görevini tamamlayın. Detaylı rehbere buradan ulaşabilirsiniz.", odul: "38.047.370 Exp" },
    { seviye: "60", baslik: "Knock, and the door will open I", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 5 Ore magic power extract teslim edin", odul: "12.500.000 Exp, 100.000 Noah" },
    { seviye: "60", baslik: "Dominated warriors (I)", npc: "[Ascetic] Tabeth", aciklama: "20 Dragon Tooth Commander öldürün.", odul: "21.500.000 Exp" },
    { seviye: "60", baslik: "Dominated warriors (I)", npc: "[Ascetic] Veda", aciklama: "20 Dragon Tooth Commander öldürün.", odul: "21.500.000 Exp" },
    { seviye: "60", baslik: "Dominated warriors (II)", npc: "[Ascetic] Tabeth", aciklama: "20 Dragon Tooth Commander öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Dominated warriors (II)", npc: "[Ascetic] Veda", aciklama: "20 Dragon Tooth Commander öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Identify of the strange weeping (1)", npc: "[Ascetic] Tabeth", aciklama: "20 Harpy öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Identify of the strange weeping (1)", npc: "[Ascetic] Veda", aciklama: "20 Harpy öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Identify of the strange weeping (2)", npc: "[Ascetic] Tabeth", aciklama: "20 Harpy öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Identify of the strange weeping (2)", npc: "[Ascetic] Veda", aciklama: "20 Harpy öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Acolytes' counter attack (1)", npc: "[Ascetic] Tabeth", aciklama: "20 Apostle öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Acolytes' counter attack (1)", npc: "[Ascetic] Veda", aciklama: "20 Apostle öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Acolytes' counter attack (2)", npc: "[Ascetic] Tabeth", aciklama: "20 Apostle öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "Acolytes' counter attack (2)", npc: "[Ascetic] Veda", aciklama: "20 Apostle öldürün.", odul: "21.250.000 Exp" },
    { seviye: "60", baslik: "[Chaos] Emblem of Chaos III", npc: "[Wealthy Merchant's Daughter] Menissiah", aciklama: "Menissiah'a 10 Voucher of Chaos teslim edin.", odul: "1 Old Takı, 3,000.000 Exp, 100 National Point" },
    { seviye: "60", baslik: "Noises that don't let us sleep", npc: "[Ascetic] Tabeth", aciklama: "Tabeth'e 10 Feather of Harpie teslim edin.", odul: "22.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "Noises that don't let us sleep", npc: "[Ascetic] Veda", aciklama: "Veda'ya 10 Feather of Harpie teslim edin.", odul: "22.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "Commending the fallen warriors", npc: "[Ascetic] Tabeth", aciklama: "Tabeth'e 10 Medal for the Leader teslim edin.", odul: "22.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "Commending the fallen warriors", npc: "[Ascetic] Veda", aciklama: "Veda'ya 10 Medal for the Leader teslim edin.", odul: "22.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Two Faces of Monks I", npc: "[Eslant Sage] Agata", aciklama: "20 Brahman öldürün.", odul: "1.375.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Two Faces of Monks I", npc: "[Eslant Sage] Pablo", aciklama: "20 Brahman öldürün.", odul: "1.375.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Two Faces of Monks II", npc: "[Eslant Sage] Agata", aciklama: "20 Paramun öldürün.", odul: "1.375.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Two Faces of Monks II", npc: "[Eslant Sage] Pablo", aciklama: "20 Paramun öldürün.", odul: "1.375.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] The Ominous Force", npc: "[Eslant Sage] Agata", aciklama: "20 Troll Shaman öldürün.", odul: "2.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] The Ominous Force", npc: "[Eslant Sage] Pablo", aciklama: "20 Troll Shaman öldürün.", odul: "2.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Rage of the Piercing Cold", npc: "[Eslant Sage] Agata", aciklama: "20 Apostle of Piercing Cold öldürün.", odul: "1.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Rage of the Piercing Cold", npc: "[Eslant Sage] Pablo", aciklama: "20 Apostle of Piercing Cold öldürün.", odul: "1.500.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Madness", npc: "[Eslant Sage] Agata", aciklama: "20 Troll Warrior öldürün.", odul: "1.000.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Repeatable] Madness", npc: "[Eslant Sage] Pablo", aciklama: "20 Troll Warrior öldürün.", odul: "1.000.000 Exp (premium kullanıcıları için iki katıdır)" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Destruction)", npc: "[Reserve Knight] Lily", aciklama: "50 Dark Stone öldürün.", odul: "5.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Destruction)", npc: "[Reserve Knight] Hill", aciklama: "50 Dark Stone öldürün.", odul: "5.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Lust)", npc: "[Reserve Knight] Lily", aciklama: "50 Booro öldürün.", odul: "5.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Lust)", npc: "[Reserve Knight] Hill", aciklama: "50 Booro öldürün.", odul: "5.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Nightmare)", npc: "[Reserve Knight] Lily", aciklama: "50 Titan öldürün.", odul: "7.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Nightmare)", npc: "[Reserve Knight] Hill", aciklama: "50 Titan öldürün.", odul: "7.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Chaos)", npc: "[Reserve Knight] Lily", aciklama: "50 Balrog öldürün.", odul: "7.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Demonic Legion of Eslant (Chaos)", npc: "[Reserve Knight] Hill", aciklama: "50 Balrog öldürün.", odul: "7.000.000 Exp" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Dark Mitrhril Piece", npc: "[Reserve Knight] Lily", aciklama: "[Quest] Lard Orc, [Quest] Uruk Tron, [Quest] Stone Golem ve [Quest] Troll Berserker'ı öldürün.", odul: "10.000.000 Exp, 1 Dark Mithril Fragment" },
    { seviye: "60", baslik: "[Daily/Party/Repeatable] Dark Mitrhril Piece", npc: "[Reserve Knight] Hill", aciklama: "[Quest] Uruk Hai, [Quest] Apostle, [Quest] Stone Golem ve [Quest] Troll Berserker'ı öldürün.", odul: "10.000.000 Exp, 1 Dark Mithril Fragment" },
    { seviye: "60", baslik: "[Repeatable] Dark Mithril Piece exchange", npc: "[Reserve Knight] Lily", aciklama: "Exchange Dark Mithril Fragments", odul: "1 Quest silahı ya da 7th set armor parçası" },
    { seviye: "60", baslik: "[Repeatable] Dark Mithril Piece exchange", npc: "[Reserve Knight] Hill", aciklama: "Exchange Dark Mithril Fragments", odul: "1 Quest silahı ya da 7th set armor parçası" },
    { seviye: "60", baslik: "[Descendant of Hero] Festival Preparation", npc: "[Moradon Merchant] Clark", aciklama: "Clark ile konuşun.", odul: "Descendant of Hero – bölüm 1" },
    { seviye: "60", baslik: "[Descendant of Hero] Festival Preparation", npc: "[Moradon Merchant] Shymer", aciklama: "Shymer ile konuşun.", odul: "Descendant of Hero – bölüm 1" },
    { seviye: "60", baslik: "The 3 Demons and God Weapons", npc: "Earth", aciklama: "Talk with Earth to activate more quests", odul: "212.500 Exp, Eslant Kurian – bölüm 1" },
    { seviye: "60", baslik: "The 3 Demons and God Weapons", npc: "Mars", aciklama: "Talk with Mars to activate more quests", odul: "212.500 Exp, Eslant Kurian – bölüm 1" },
    { seviye: "60", baslik: "Subjugation Squad of the Goblin Village", npc: "[Goblin Punitive Force] Wells", aciklama: "Talk to [Goblin Punitive Force] Wells to activate quest series Goblin 1 and Goblin 2", odul: "Goblin 1 and Goblin 2 – bölüm 1" },
    { seviye: "60", baslik: "Subjugation Squad of the Goblin Village", npc: "[Goblin Punitive Force] Raul", aciklama: "Talk to [Goblin Punitive Force] Raul to activate quest series Goblin 1 and Goblin 2", odul: "Goblin 1 and Goblin 2 – bölüm 1" },
    // ... (60-70 arası diğer görevler buraya eklenecek)
    { seviye: "70", baslik: "[Lemegeton] Devil 11 Duke Gusion", npc: "[Order of the Sorcery] Bros", aciklama: "Kill Gusion", odul: "32.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos" },
  ];

  // 71-83 Seviye Görevleri - YENİ EKLENDİ
  const gorevler71_83 = [
    { seviye: "71", baslik: "[Lemegeton] Count of a Fool", npc: "[Order of the Sorcery] Sais", aciklama: "Kill 50 Bifloans and 1 Efos", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Helmet – grade 3, Lemegeton – bölüm 12" },
    { seviye: "71", baslik: "[Lemegeton] Count of a Fool", npc: "[Order of the Sorcery] Bros", aciklama: "Kill 50 Bifloans and 1 Efos", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Helmet – grade 3, Lemegeton – bölüm 12" },
    { seviye: "71", baslik: "[Lemegeton] The Third Underworld", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [22 magical spirit] Efos sealed scroll and [46 magical spirit] Orias sealed scroll to Sais", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 13" },
    { seviye: "71", baslik: "[Lemegeton] The Third Underworld", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [22 magical spirit] Efos sealed scroll and [46 magical spirit] Orias sealed scroll to Bros", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 13" },
    { seviye: "71", baslik: "[Lemegeton] Count of Storm and Thunderbolt", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [71 magical spirit] Dantalion sealed scroll, [58 magical spirit] Ami sealed scroll and [34 magical spirit] Purpur sealed scroll to Sais", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Earring – grade 2, Lemegeton – bölüm 14" },
    { seviye: "71", baslik: "[Lemegeton] Count of Storm and Thunderbolt", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [71 magical spirit] Dantalion sealed scroll, [58 magical spirit] Ami sealed scroll and [34 magical spirit] Purpur sealed scroll to Bros", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Earring – grade 2, Lemegeton – bölüm 14" },
    { seviye: "71", baslik: "[Lemegeton] Devil 10 President Buer", npc: "[Order of the Sorcery] Sais", aciklama: "Kill Buer", odul: "37.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 15" },
    { seviye: "71", baslik: "[Lemegeton] Devil 10 President Buer", npc: "[Order of the Sorcery] Bros", aciklama: "Kill Buer", odul: "37.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 15" },
    { seviye: "71", baslik: "[Lemegeton] Sovereign of 66 Legions", npc: "[Order of the Sorcery] Sais", aciklama: "Kill 50 Ose and 1 Gaap", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Pads – grade 3, Lemegeton – bölüm 16" },
    { seviye: "71", baslik: "[Lemegeton] Sovereign of 66 Legions", npc: "[Order of the Sorcery] Bros", aciklama: "Kill 50 Ose and 1 Gaap", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Pads – grade 3, Lemegeton – bölüm 16" },
    { seviye: "71", baslik: "[Lemegeton] The other door", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [33 magical spirit] Gaf sealed scroll and [57 magical spirit] Ose sealed scroll to Sais", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 17" },
    { seviye: "71", baslik: "[Lemegeton] The other door", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [33 magical spirit] Gaf sealed scroll and [57 magical spirit] Ose sealed scroll to Bros", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 17" },
    { seviye: "71", baslik: "[Lemegeton] President of the 36 Legions", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [65 magical spirit] Andrealfus sealed scroll, [45 magical spirit] Vinne sealed scroll and [21 magical spirit] Moraks sealed scroll to Sais", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Earring – grade 2, Lemegeton – bölüm 18" },
    { seviye: "71", baslik: "[Lemegeton] President of the 36 Legions", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [65 magical spirit] Andrealfus sealed scroll, [45 magical spirit] Vinne sealed scroll and [21 magical spirit] Moraks sealed scroll to Bros", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Earring – grade 2, Lemegeton – bölüm 18" },
    { seviye: "71", baslik: "[Lemegeton] Devil 9 Satan Paimo", npc: "[Order of the Sorcery] Sais", aciklama: "Kill Paimon", odul: "42.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 19" },
    { seviye: "71", baslik: "[Lemegeton] Devil 9 Satan Paimo", npc: "[Order of the Sorcery] Bros", aciklama: "Kill Paimon", odul: "42.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 19" },
    { seviye: "72", baslik: "[Lemegeton] King of the Hidden Treasures", npc: "[Order of the Sorcery] Sais", aciklama: "Kill 50 Shax and 1 Furson", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Pauldron – grade 3, Lemegeton – bölüm 20" },
    { seviye: "72", baslik: "[Lemegeton] King of the Hidden Treasures", npc: "[Order of the Sorcery] Bros", aciklama: "Kill 50 Shax and 1 Furson", odul: "7.500.000 Exp, 30.000 Noah, 1 Quest Chitin Shell Pauldron – grade 3, Lemegeton – bölüm 20" },
    { seviye: "72", baslik: "[Lemegeton] Endless Path", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [20 magical spirit] Purson sealed scroll and [44 magical spirit] Sharks sealed scroll to Sais", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 21" },
    { seviye: "72", baslik: "[Lemegeton] Endless Path", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [20 magical spirit] Purson sealed scroll and [44 magical spirit] Sharks sealed scroll to Bros", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 21" },
    { seviye: "72", baslik: "[Lemegeton] Cherubim of Sin", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [70 magical spirit] Sele sealed scroll, [56 magical spirit] Gomori sealed scroll and [32 magical spirit] Asmodeus sealed scroll to Sais", odul: "8.750.000 Exp, 30.000 Noah, 1 Quest pendant – grade 2, Lemegeton – bölüm 22" },
    { seviye: "72", baslik: "[Lemegeton] Cherubim of Sin", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [70 magical spirit] Sele sealed scroll, [56 magical spirit] Gomori sealed scroll and [32 magical spirit] Asmodeus sealed scroll to Bros", odul: "8.750.000 Exp, 30.000 Noah, 1 Quest pendant – grade 2, Lemegeton – bölüm 22" },
    { seviye: "72", baslik: "[Lemegeton] Devil 8 Count Barbatos", npc: "[Order of the Sorcery] Sais", aciklama: "Kill Barbatos", odul: "47.500.000 Exp, 100.000 Noah, 2 Certificate of Victory, Lemegeton – bölüm 23" },
    { seviye: "72", baslik: "[Lemegeton] Devil 8 Count Barbatos", npc: "[Order of the Sorcery] Bros", aciklama: "Kill Barbatos", odul: "47.500.000 Exp, 100.000 Noah, 2 Certificate of Victory, Lemegeton – bölüm 23" },
    { seviye: "72", baslik: "[Lemegeton] President of Explorer", npc: "[Order of the Sorcery] Sais", aciklama: "Kill 50 Orobas and 1 Foras", odul: "8.750.000 Exp, 30.000 Noah, 1 Quest belt – grade 2, Lemegeton – bölüm 24" },
    { seviye: "72", baslik: "[Lemegeton] President of Explorer", npc: "[Order of the Sorcery] Bros", aciklama: "Kill 50 Orobas and 1 Foras", odul: "8.750.000 Exp, 30.000 Noah, 1 Quest belt – grade 2, Lemegeton – bölüm 24" },
    { seviye: "72", baslik: "[Lemegeton] To the Bottom of the Abyss", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [31 magical spirit] Foras sealed scroll and [55 magical spirit] Orobas sealed scroll to Sais", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 25" },
    { seviye: "72", baslik: "[Lemegeton] To the Bottom of the Abyss", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [31 magical spirit] Foras sealed scroll and [55 magical spirit] Orobas sealed scroll to Bros", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 25" },
    { seviye: "72", baslik: "[Lemegeton] Duke of Silver Armor", npc: "[Order of the Sorcery] Sais", aciklama: "Deliver [64 magical spirit] Floresslah sealed scroll, [43 magical spirit] Savnark sealed scroll and [19 magical spirit] Saleos sealed scroll to Sais", odul: "8.750.000 Exp, 30.000 Noah, 50 National Point, Lemegeton – bölüm 26" },
    { seviye: "72", baslik: "[Lemegeton] Duke of Silver Armor", npc: "[Order of the Sorcery] Bros", aciklama: "Deliver [64 magical spirit] Floresslah sealed scroll, [43 magical spirit] Savnark sealed scroll and [19 magical spirit] Saleos sealed scroll to Bros", odul: "8.750.000 Exp, 30.000 Noah, 50 National Point, Lemegeton – bölüm 26" },
    { seviye: "72", baslik: "[Lemegeton] Devil 7 Marquis Amon", npc: "[Order of the Sorcery] Sais", aciklama: "Amon'u öldürün.", odul: "47.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 27" },
    { seviye: "72", baslik: "[Lemegeton] Devil 7 Marquis Amon", npc: "[Order of the Sorcery] Bros", aciklama: "Amon'u öldürün.", odul: "47.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 27" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of Hell", npc: "[Order of the Sorcery] Sais", aciklama: "50 Vepar ve 1 Bathin öldürün.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 28" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of Hell", npc: "[Order of the Sorcery] Bros", aciklama: "50 Vepar ve 1 Bathin öldürün.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 28" },
    { seviye: "73", baslik: "[Lemegeton] Entrance of Hell", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [18 magical spirit] Badin sealed scroll ve [42 magical spirit] Befal sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 29" },
    { seviye: "73", baslik: "[Lemegeton] Entrance of Hell", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [18 magical spirit] Badin sealed scroll ve [42 magical spirit] Befal sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 29" },
    { seviye: "73", baslik: "[Lemegeton] Gigantic Sea Monster Marquis", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [69 magical spirit] Dekarbia sealed scroll, [54 magical spirit] Murmur sealed scroll ve [30 magical spirit] Foluneous sealed scroll eşyalarını teslim edin.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 30" },
    { seviye: "73", baslik: "[Lemegeton] Gigantic Sea Monster Marquis", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [69 magical spirit] Dekarbia sealed scroll, [54 magical spirit] Murmur sealed scroll ve [30 magical spirit] Foluneous sealed scroll eşyalarını teslim edin.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 30" },
    { seviye: "73", baslik: "[Lemegeton] Devil 6 Count Valefor", npc: "[Order of the Sorcery] Sais", aciklama: "Valefar'ı öldürün.", odul: "52.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 31" },
    { seviye: "73", baslik: "[Lemegeton] Devil 6 Count Valefor", npc: "[Order of the Sorcery] Bros", aciklama: "Valefar'ı öldürün.", odul: "52.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 31" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of Devildom", npc: "[Order of the Sorcery] Sais", aciklama: "50 Caim ve 1 Astaroth öldürün.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 32" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of Devildom", npc: "[Order of the Sorcery] Bros", aciklama: "50 Caim ve 1 Astaroth öldürün.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 32" },
    { seviye: "73", baslik: "[Lemegeton] Gate of Devildom", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [29 magical spirit] Astarot sealed scroll ve [53 magical spirit] Kaim sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 33" },
    { seviye: "73", baslik: "[Lemegeton] Gate of Devildom", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [29 magical spirit] Astarot sealed scroll ve [53 magical spirit] Kaim sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 33" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of 26 Legions", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [63 magical spirit] Andras sealed scroll, [41 magical spirit] Fokalro sealed scroll ve [17 magical spirit] Botis sealed scroll eşyalarını teslim edin.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 34" },
    { seviye: "73", baslik: "[Lemegeton] Archduke of 26 Legions", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [63 magical spirit] Andras sealed scroll, [41 magical spirit] Fokalro sealed scroll ve [17 magical spirit] Botis sealed scroll eşyalarını teslim edin.", odul: "8.750.000 Exp, 30.000 Noah, Lemegeton – bölüm 34" },
    { seviye: "73", baslik: "[Lemegeton] Devil 5 President Marbas", npc: "[Order of the Sorcery] Sais", aciklama: "Marbas'ı öldürün.", odul: "57.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 35" },
    { seviye: "73", baslik: "[Lemegeton] Devil 5 President Marbas", npc: "[Order of the Sorcery] Bros", aciklama: "Marbas'ı öldürün.", odul: "57.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 35" },
    { seviye: "74", baslik: "Patriarch's Followers", npc: "[Outpost Captain] Della", aciklama: "60 Keramash, 60 Medichmash ve 80 Nigmash öldürün.", odul: "250.000.000 Exp" },
    { seviye: "74", baslik: "Patriarch's Followers", npc: "[Outpost Captain] Elrod", aciklama: "60 Keramash, 60 Medichmash ve 80 Nigmash öldürün.", odul: "250.000.000 Exp" },
    { seviye: "74", baslik: "[Lemegeton] Red Duke", npc: "[Order of the Sorcery] Sais", aciklama: "50 Raum ve 1 Zepar öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 36" },
    { seviye: "74", baslik: "[Lemegeton] Red Duke", npc: "[Order of the Sorcery] Bros", aciklama: "50 Raum ve 1 Zepar öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 36" },
    { seviye: "74", baslik: "[Lemegeton] At the End of Hell", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [16 magical spirit] Jepar sealed scroll and [40 magical spirit] Laum sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 37" },
    { seviye: "74", baslik: "[Lemegeton] At the End of Hell", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [16 magical spirit] Jepar sealed scroll and [40 magical spirit] Laum sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 37" },
    { seviye: "74", baslik: "[Lemegeton] King of Cruelty", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [68 magical spirit] Vallial sealed scroll, [52 magical spirit] Alroken sealed scroll and [28 magical spirit] Berrid sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 38" },
    { seviye: "74", baslik: "[Lemegeton] King of Cruelty", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [68 magical spirit] Vallial sealed scroll, [52 magical spirit] Alroken sealed scroll and [28 magical spirit] Berrid sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 38" },
    { seviye: "74", baslik: "[Lemegeton] Devil 4 Great Marquis Gamygyn", npc: "[Order of the Sorcery] Sais", aciklama: "Gamigin'i öldürün.", odul: "62.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 39" },
    { seviye: "74", baslik: "[Lemegeton] Devil 4 Great Marquis Gamygyn", npc: "[Order of the Sorcery] Bros", aciklama: "Gamigin'i öldürün.", odul: "62.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 39" },
    { seviye: "74", baslik: "[Lemegeton] Earl of Red Mist", npc: "[Order of the Sorcery] Sais", aciklama: "50 Balam ve 1 Ronove öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 40" },
    { seviye: "74", baslik: "[Lemegeton] Earl of Red Mist", npc: "[Order of the Sorcery] Bros", aciklama: "50 Balam ve 1 Ronove öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 40" },
    { seviye: "74", baslik: "[Lemegeton] Space of Depravity", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [27 magical spirit] Ronebe sealed scroll ve [51 magical spirit] Balam sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 41" },
    { seviye: "74", baslik: "[Lemegeton] Space of Depravity", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [27 magical spirit] Ronebe sealed scroll ve [51 magical spirit] Balam sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 41" },
    { seviye: "74", baslik: "[Lemegeton] Duke of True Chivalry", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [62 magical spirit] Barak sealed scroll, [39 magical spirit] Marpath sealed scroll ve [15 magical spirit] Eligolle sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 42" },
    { seviye: "74", baslik: "[Lemegeton] Duke of True Chivalry", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [62 magical spirit] Barak sealed scroll, [39 magical spirit] Marpath sealed scroll ve [15 magical spirit] Eligolle sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 42" },
    { seviye: "74", baslik: "[Lemegeton] Devil 3 Prince Vassaago", npc: "[Order of the Sorcery] Sais", aciklama: "Bithagos'u öldürün.", odul: "67.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 43" },
    { seviye: "74", baslik: "[Lemegeton] Devil 3 Prince Vassaago", npc: "[Order of the Sorcery] Bros", aciklama: "Bithagos'u öldürün.", odul: "67.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 43" },
    { seviye: "75", baslik: "Dragon hunt", npc: "[Mercenary Captain] Cougar", aciklama: "Felankor'u öldürün.", odul: "1 Exceptional silah +5" },
    { seviye: "75", baslik: "King of Kings", npc: "[Twilight Observer] Balmanfae", aciklama: "[Twilight Observer] Balmanfae'ye 1 Dented ironmass, 1 Petrified weapon shrap, 1 Iron powder of chain ve 1 Plwitoon's tear teslim edin.", odul: "25.000.000 Exp" },
    { seviye: "75", baslik: "The wings of the falling I", npc: "[Twilight Observer] Balmanfae", aciklama: "[Twilight Observer] Balmanfae'ye Padama's broken feathers teslim edin.", odul: "2.500.000 Exp, 1 Padama's feather" },
    { seviye: "75", baslik: "The wings of the falling II", npc: "[Twilight Observer] Balmanfae", aciklama: "[Twilight Observer] Balmanfae'ye 5 Evelys's ripped leathers teslim edin.", odul: "2.500.000 Exp, 1 Evelys's leather" },
    { seviye: "75", baslik: "Report", npc: "[Twilight Knight Guard] Martin", aciklama: "[Twilight Knight Guard] Martin inside Under the Castle'da [Twilight Knight Guard] Martin ile konuşun.", odul: "100 National Point, 1 Ascent Scroll (+20% exp for 1 hour)" },
    { seviye: "75", baslik: "[Twilight Knights] Fire support", npc: "[Twilight Observer] Eyre – El Morad", aciklama: "Deliver your support Application to the [Twilight Knight Guard] Martin", odul: "1 Pray for hit emblem for one week" },
    { seviye: "75", baslik: "[Twilight Knights] Fire support", npc: "[Twilight Observer] Eyre – Karus", aciklama: "Deliver your support Application to the [Twilight Knight Guard] Martin", odul: "1 Pray for hit emblem for one week" },
    { seviye: "75", baslik: "[Lemegeton] Marquis of Archer", npc: "[Order of the Sorcery] Sais", aciklama: "50 Halphas ve 1 Leraje öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 44" },
    { seviye: "75", baslik: "[Lemegeton] Marquis of Archer", npc: "[Order of the Sorcery] Bros", aciklama: "50 Halphas ve 1 Leraje öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 44" },
    { seviye: "75", baslik: "[Lemegeton] Bottom of Despair", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [14 magical spirit] Lerajie sealed scroll ve [38 magical spirit] Halpas sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 45" },
    { seviye: "75", baslik: "[Lemegeton] Bottom of Despair", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [14 magical spirit] Lerajie sealed scroll ve [38 magical spirit] Halpas sealed scroll eşyalarını teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 45" },
    { seviye: "75", baslik: "[Lemegeton] Duke of the Dead", npc: "[Order of the Sorcery] Sais", aciklama: "Sais'e [67 magical spirit] Xiahs sealed scroll, [50 magical spirit] Frukas sealed scroll ve [26 magical spirit] Bruneth sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 46" },
    { seviye: "75", baslik: "[Lemegeton] Duke of the Dead", npc: "[Order of the Sorcery] Bros", aciklama: "Bros'a [67 magical spirit] Xiahs sealed scroll, [50 magical spirit] Frukas sealed scroll ve [26 magical spirit] Bruneth sealed scroll eşyalarını teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 46" },
    { seviye: "75", baslik: "[Lemegeton] Devil 2 Archduke Agares", npc: "[Order of the Sorcery] Sais", aciklama: "Agares'i öldürün.", odul: "72.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 47" },
    { seviye: "75", baslik: "[Lemegeton] Devil 2 Archduke Agares", npc: "[Order of the Sorcery] Bros", aciklama: "Agares'i öldürün.", odul: "72.500.000 Exp, 100.000 Noah, 100 National Point, 2 Certificate of Victory, Lemegeton – bölüm 47" },
    { seviye: "75", baslik: "[Lemegeton] President of Slayer", npc: "[Order of the Sorcery] Sais", aciklama: "50 Crocell ve 1 Goloras öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 48" },
    { seviye: "75", baslik: "[Lemegeton] President of Slayer", npc: "[Order of the Sorcery] Bros", aciklama: "50 Crocell ve 1 Goloras öldürün.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 48" },
    { seviye: "75", baslik: "[Lemegeton] The Last Hell", npc: "[Order of the Sorcery] Sais", aciklama: "[25 magical spirit] Glashalabolas sealed scroll ve [49 magical spirit] Prokel sealed scroll'u Sais'e teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 49" },
    { seviye: "75", baslik: "[Lemegeton] The Last Hell", npc: "[Order of the Sorcery] Bros", aciklama: "[25 magical spirit] Glashalabolas sealed scroll ve [49 magical spirit] Prokel sealed scroll'u Bros'a teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 49" },
    { seviye: "75", baslik: "[Lemegeton] King of Madness", npc: "[Order of the Sorcery] Sais", aciklama: "[61 magical spirit] Jagan sealed scroll, [37 magical spirit] Finix sealed scroll ve [13 magical spirit] Bellred sealed scroll'u Sais'e teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 50" },
    { seviye: "75", baslik: "[Lemegeton] King of Madness", npc: "[Order of the Sorcery] Bros", aciklama: "[61 magical spirit] Jagan sealed scroll, [37 magical spirit] Finix sealed scroll ve [13 magical spirit] Bellred sealed scroll'u Bros'a teslim edin.", odul: "10.000.000 Exp, 30.000 Noah, Lemegeton – bölüm 50" },
    { seviye: "75", baslik: "[Lemegeton] Devil 1 Great Devil", npc: "[Order of the Sorcery] Sais", aciklama: "Baal'ı öldürün.", odul: "77.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 51" },
    { seviye: "75", baslik: "[Lemegeton] Devil 1 Great Devil", npc: "[Order of the Sorcery] Bros", aciklama: "Baal'ı öldürün.", odul: "77.500.000 Exp, 100.000 Noah, 50 National Point, 1 Voucher of Chaos, Lemegeton – bölüm 51" },
    { seviye: "75", baslik: "[Lemegeton] Isolation method", npc: "[Order of the Sorcery] Sais", aciklama: "Eslant'ta Pelore'la konuşun.", odul: "Lemegeton – bölüm 52" },
    { seviye: "75", baslik: "[Lemegeton] Isolation method", npc: "[Order of the Sorcery] Bros", aciklama: "Eslant'ta Malraseu'yla konuşun.", odul: "Lemegeton – bölüm 52" },
    { seviye: "75", baslik: "[Lemegeton] Scroll of Seal", npc: "[Order of the Sorcery Leader] Pelore", aciklama: "Hidden sealed scroll, Lock cannot be open ve Benshar's spell water'ı Pelore'a teslim edin.", odul: "500.000 Exp, 50.000 Noah, Lemegeton – bölüm 53" },
    { seviye: "75", baslik: "[Lemegeton] Scroll of Seal", npc: "[Order of the Sorcery Leader] Malraseu", aciklama: "Hidden sealed scroll, Lock cannot be open ve Benshar's spell water'ı Malraseu'ya teslim edin.", odul: "500.000 Exp, 50.000 Noah, Lemegeton – bölüm 53" },
    { seviye: "75", baslik: "[Lemegeton] Deprived Ring", npc: "[Order of the Sorcery Leader] Pelore", aciklama: "Completed sealed scroll'u Ronark Land'de Sais'e teslim edin.", odul: "125.000 Exp, 10.000 Noah, Lemegeton – bölüm 54" },
    { seviye: "75", baslik: "[Lemegeton] Deprived Ring", npc: "[Order of the Sorcery Leader] Malraseu", aciklama: "Completed sealed scroll'u Ronark Land'de Bros'a teslim edin.", odul: "125.000 Exp, 10.000 Noah, Lemegeton – bölüm 54" },
    { seviye: "75", baslik: "[Lemegeton] Chasing the Devil", npc: "[Order of the Sorcery] Sais", aciklama: "Sais ile konuşun.", odul: "Lemegeton – bölüm 55" },
    { seviye: "75", baslik: "[Lemegeton] Chasing the Devil", npc: "[Order of the Sorcery] Bros", aciklama: "Bros ile konuşun.", odul: "Lemegeton – bölüm 55" },
    { seviye: "75", baslik: "[Lemegeton] Demon's Leader Asmodeus", npc: "[Order of the Sorcery] Sais", aciklama: "Awaken Asmodeus'u öldürün.", odul: "82.500.000 Exp, 1.000.000 Noah, 100 National Point, 2 Voucher of Chaos, Lemegeton – bölüm 56" },
    { seviye: "75", baslik: "[Lemegeton] Demon's Leader Asmodeus", npc: "[Order of the Sorcery] Bros", aciklama: "Awaken Asmodeus'u öldürün.", odul: "82.500.000 Exp, 1.000.000 Noah, 100 National Point, 2 Voucher of Chaos, Lemegeton – bölüm 56" },
    { seviye: "75", baslik: "[Lemegeton] Lemegeton, Scroll which sealed Devil", npc: "[Order of the Sorcery] Sais", aciklama: "Sealed scroll Remegedon'u Pelore'a teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 57" },
    { seviye: "75", baslik: "[Lemegeton] Lemegeton, Scroll which sealed Devil", npc: "[Order of the Sorcery] Bros", aciklama: "Sealed scroll Remegedon'u Malraseu'ya teslim edin.", odul: "250.000 Exp, 30.000 Noah, Lemegeton – bölüm 57" },
    { seviye: "77", baslik: "Aposlte of Flames hunt (1)", npc: "[Ascetic] Tabeth", aciklama: "40 Apostle of Flame öldürün.", odul: "50.000.000 Exp" },
    { seviye: "77", baslik: "Aposlte of Flames hunt (1)", npc: "[Ascetic] Veda", aciklama: "40 Apostle of Flame öldürün.", odul: "50.000.000 Exp" },
    { seviye: "77", baslik: "Aposlte of Flames hunt (2)", npc: "[Ascetic] Tabeth", aciklama: "40 Apostle of Flame öldürün.", odul: "50.000.000 Exp" },
    { seviye: "77", baslik: "Aposlte of Flames hunt (2)", npc: "[Ascetic] Veda", aciklama: "40 Apostle of Flame öldürün.", odul: "50.000.000 Exp" },
    { seviye: "78", baslik: "Unfinished hunt II (1)", npc: "[Ascetic] Tabeth", aciklama: "40 Troll Berserker öldürün.", odul: "68.750.000 Exp" },
    { seviye: "78", baslik: "Unfinished hunt II (1)", npc: "[Ascetic] Veda", aciklama: "40 Troll Berserker öldürün.", odul: "68.750.000 Exp" },
    { seviye: "78", baslik: "Unfinished hunt II (2)", npc: "[Ascetic] Tabeth", aciklama: "40 Troll Berserker öldürün.", odul: "68.750.000 Exp" },
    { seviye: "78", baslik: "Unfinished hunt II (2)", npc: "[Ascetic] Veda", aciklama: "40 Troll Berserker öldürün.", odul: "68.750.000 Exp" },
    { seviye: "79", baslik: "Unfinished hunt III (1)", npc: "[Ascetic] Tabeth", aciklama: "40 Troll Captain öldürün.", odul: "68.750.000 Exp" },
    { seviye: "79", baslik: "Unfinished hunt III (1)", npc: "[Ascetic] Veda", aciklama: "40 Troll Captain öldürün.", odul: "68.750.000 Exp" },
    { seviye: "79", baslik: "Unfinished hunt III (2)", npc: "[Ascetic] Tabeth", aciklama: "40 Troll Captain öldürün.", odul: "68.750.000 Exp" },
    { seviye: "79", baslik: "Unfinished hunt III (2)", npc: "[Ascetic] Veda", aciklama: "40 Troll Captain öldürün.", odul: "68.750.000 Exp" },
    { seviye: "80", baslik: "Nightmare (1)", npc: "[Ascetic] Tabeth", aciklama: "80 Booro öldürün.", odul: "83.750.000 Exp" },
    { seviye: "80", baslik: "Nightmare (1)", npc: "[Ascetic] Veda", aciklama: "80 Booro öldürün.", odul: "83.750.000 Exp" },
    { seviye: "80", baslik: "Nightmare (2)", npc: "[Ascetic] Tabeth", aciklama: "80 Booro öldürün.", odul: "83.750.000 Exp" },
    { seviye: "80", baslik: "Nightmare (2)", npc: "[Ascetic] Veda", aciklama: "80 Booro öldürün.", odul: "83.750.000 Exp" },
    { seviye: "80", baslik: "Danger from Monster II", npc: "[Outpost Captain] Della", aciklama: "Enigma ve Cruel öldürün.", odul: "1 Personal item" },
    { seviye: "80", baslik: "Danger from Monster II", npc: "[Outpost Captain] Elrod", aciklama: "Havoc ve Hellfire öldürün.", odul: "1 Personal item" },
    { seviye: "81.05", baslik: "Past Mistake (1)", npc: "[Ascetic] Tabeth", aciklama: "80 Dark Stone öldürün.", odul: "83.750.000 Exp" },
    { seviye: "81.05", baslik: "Past Mistake (1)", npc: "[Ascetic] Veda", aciklama: "80 Dark Stone öldürün.", odul: "83.750.000 Exp" },
    { seviye: "81.05", baslik: "Past Mistake (2)", npc: "[Ascetic] Tabeth", aciklama: "80 Dark Stone öldürün.", odul: "83.750.000 Exp" },
    { seviye: "81.05", baslik: "Past Mistake (2)", npc: "[Ascetic] Veda", aciklama: "80 Dark Stone öldürün.", odul: "83.750.000 Exp" },
    { seviye: "82", baslik: "Fallen Spirit of Flame (1)", npc: "[Ascetic] Tabeth", aciklama: "80 Balrog öldürün.", odul: "102.500.000 Exp" },
    { seviye: "82", baslik: "Fallen Spirit of Flame (1)", npc: "[Ascetic] Veda", aciklama: "80 Balrog öldürün.", odul: "102.500.000 Exp" },
    { seviye: "82", baslik: "Fallen Spirit of Flame (2)", npc: "[Ascetic] Tabeth", aciklama: "80 Balrog öldürün.", odul: "102.500.000 Exp" },
    { seviye: "82", baslik: "Fallen Spirit of Flame (2)", npc: "[Ascetic] Veda", aciklama: "80 Balrog öldürün.", odul: "102.500.000 Exp" },
    { seviye: "83", baslik: "[Daily/Repeatable] Ones Who Failed Rebirth", npc: "[Soul Healer] Dason – El Morad", aciklama: "3 Spirit of Hero öldürün.", odul: "" },
    { seviye: "83", baslik: "[Daily/Repeatable] Ones Who Failed Rebirth", npc: "[Soul Healer] Dason – Karus", aciklama: "3 Spirit of Hero öldürün.", odul: "" },
  ];

  const tumGorevler = [...gorevler1_35, ...gorevler35_59, ...gorevler60_70, ...gorevler71_83];

  const getFilteredGorevler = () => {
    switch(selectedLevelRange) {
      case '1-35': return gorevler1_35;
      case '35-59': return gorevler35_59;
      case '60-70': return gorevler60_70;
      case '71-83': return gorevler71_83;
      case 'all': return tumGorevler;
      default: return gorevler1_35;
    }
  };

  const getSearchedGorevler = () => {
    const filtered = getFilteredGorevler();
    if (!searchQuery.trim()) return filtered;
    
    const query = searchQuery.toLowerCase().trim();
    return filtered.filter(gorev => 
      gorev.baslik.toLowerCase().includes(query) ||
      gorev.npc.toLowerCase().includes(query) ||
      gorev.aciklama.toLowerCase().includes(query) ||
      gorev.seviye.toLowerCase().includes(query)
    );
  };

  const filteredGorevler = getSearchedGorevler();

  const GorevItem = ({ seviye, baslik, npc, aciklama, odul }) => (
    <View style={styles.gorevItem}>
      <View style={styles.gorevHeader}>
        <View style={styles.levelBadge}>
          <Text style={styles.gorevSeviye}>Lv. {seviye}</Text>
        </View>
        <Text style={styles.gorevBaslik}>{baslik}</Text>
      </View>
      <Text style={styles.gorevNpc}>NPC: {npc}</Text>
      <Text style={styles.gorevAciklama}>{aciklama}</Text>
      {odul && <Text style={styles.gorevOdul}>🎁 {odul}</Text>}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>📋 Knight Online Görevleri</Text>
        
        {/* Seviye Filtreleme Butonları */}
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Seviye Aralığı: {selectedLevelRange}</Text>
          <Text style={styles.gorevSayisi}>Toplam {getSearchedGorevler().length} görev</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.levelButtonsContainer}
          contentContainerStyle={styles.levelButtonsContent}
        >
          {['1-35', '35-59', '60-70', '71-83', 'all'].map((range) => (
            <TouchableOpacity 
              key={range}
              style={[
                styles.levelButton, 
                selectedLevelRange === range && styles.levelButtonActive
              ]}
              onPress={() => setSelectedLevelRange(range)}
            >
              <Text style={[
                styles.levelButtonText, 
                selectedLevelRange === range && styles.levelButtonTextActive
              ]}>
                {range === 'all' ? 'Tümü' : range}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Arama Çubuğu */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Görev ara..."
            placeholderTextColor="#98A2B3"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Görev Listesi */}
        <View style={styles.gorevListContainer}>
          <ScrollView 
            style={styles.gorevListesi}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.gorevListContent}
          >
            {getSearchedGorevler().map((gorev, index) => (
              <View key={index} style={styles.gorevItem}>
                <View style={styles.gorevHeader}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.gorevSeviye}>Lv. {gorev.seviye}</Text>
                  </View>
                  <Text style={styles.gorevBaslik}>{gorev.baslik}</Text>
                </View>
                <Text style={styles.gorevNpc}>NPC: {gorev.npc}</Text>
                <Text style={styles.gorevAciklama}>{gorev.aciklama}</Text>
                {gorev.odul && <Text style={styles.gorevOdul}>🎁 {gorev.odul}</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

// Merchant Alt Sekmeleri
const MerchantScreen = ({ activeSubTab, setActiveSubTab }) => {
  const merchantSubTabs = [
    { id: 'pazar', icon: '💰', label: 'Pazar' },
    { id: 'goldbar', icon: '💎', label: 'Goldbar' },
  ];

  const [fullWebKey, setFullWebKey] = useState(null);

  const openWeb = (key) => setFullWebKey(key);
  const closeWeb = () => setFullWebKey(null);

  const WebViewTab = ({ url, title, onBack }) => {
    const [loading, setLoading] = useState(true);

    return (
      <View style={styles.webViewContainer}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>⬅️ Geri</Text>
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>{title}</Text>
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          )}
        </View>
        <WebView
          source={{ uri: url }}
          style={styles.webView}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          scalesPageToFit={true}
        />
      </View>
    );
  };

  if (fullWebKey) {
    switch(fullWebKey) {
      case 'pazar':
        return (
          <WebViewTab 
            url="https://www.uskopazar.com"
            title="💰 UskoPazar - Knight Online Pazar"
            onBack={closeWeb}
          />
        );
      case 'goldbar':
        return (
          <WebViewTab 
            url="https://www.enucuzgb.com"
            title="💎 EnUcuzGB - Goldbar Fiyatları"
            onBack={closeWeb}
          />
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>💰 Merchant</Text>
        
        {/* GÜNCELLENMİŞ ALT SEKMELER - Master gibi */}
        <View style={styles.enhancedSubTabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.enhancedSubTabContent}
          >
            {merchantSubTabs.map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                style={[
                  styles.enhancedSubTabButton,
                  activeSubTab === tab.id && styles.enhancedSubTabButtonActive
                ]}
                onPress={() => setActiveSubTab(tab.id)}
              >
                <Text style={[
                  styles.enhancedSubTabIcon,
                  activeSubTab === tab.id && styles.enhancedSubTabIconActive
                ]}>
                  {tab.icon}
                </Text>
                <Text style={[
                  styles.enhancedSubTabText,
                  activeSubTab === tab.id && styles.enhancedSubTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* İçerik */}
        <View style={styles.card}>
          {activeSubTab === 'pazar' && (
            <>
              <Text style={styles.eventName}>💰 Pazar</Text>
              <Text style={styles.muted}>
                Knight Online item pazarına tam ekran erişmek için butona tıklayın.
              </Text>
              <TouchableOpacity 
                style={styles.fullScreenButton}
                onPress={() => openWeb('pazar')}
              >
                <Text style={styles.fullScreenButtonText}>Tam Ekran Aç</Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'goldbar' && (
            <>
              <Text style={styles.eventName}>💎 Goldbar</Text>
              <Text style={styles.muted}>
                Goldbar fiyatlarını görüntülemek için tam ekran butonuna tıklayın.
              </Text>
              <TouchableOpacity 
                style={styles.fullScreenButton}
                onPress={() => openWeb('goldbar')}
              >
                <Text style={styles.fullScreenButtonText}>Tam Ekran Aç</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

// Karakter Alt Sekmeleri
const KarakterScreen = ({ activeSubTab, setActiveSubTab }) => {
  const karakterSubTabs = [
    { id: 'basitAtakHesaplama', icon: '⚔️', label: 'Basit Atak' },
    { id: 'skillHesaplama', icon: '🔮', label: 'Skill Hesapla' },
    { id: 'charDiz', icon: '👤', label: 'Char Diz' },
  ];

  const [fullWebKey, setFullWebKey] = useState(null);

  const openWeb = (key) => setFullWebKey(key);
  const closeWeb = () => setFullWebKey(null);

  const WebViewTab = ({ url, title, onBack }) => {
    const [loading, setLoading] = useState(true);

    return (
      <View style={styles.webViewContainer}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>⬅️ Geri</Text>
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>{title}</Text>
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          )}
        </View>
        <WebView
          source={{ uri: url }}
          style={styles.webView}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setLoading(false)}
          scalesPageToFit={true}
        />
      </View>
    );
  };

  if (fullWebKey) {
    switch(fullWebKey) {
      case 'basitAtakHesaplama':
        return (
          <WebViewTab 
            url="https://www.kobugda.com/Calculator"
            title="⚔️ Basit Atak Hesaplama"
            onBack={closeWeb}
          />
        );
      case 'skillHesaplama':
        return (
          <WebViewTab 
            url="https://www.kobugda.com/SkillCalculator"
            title="🔮 Skill Hesaplama"
            onBack={closeWeb}
          />
        );
      case 'charDiz':
        return (
          <WebViewTab 
            url="https://www.kobugda.com/Calculator/Calculator"
            title="👤 Char Diz"
            onBack={closeWeb}
          />
        );
      default:
        return null;
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>👤 Karakter</Text>
        
        {/* GÜNCELLENMİŞ ALT SEKMELER - Master gibi */}
        <View style={styles.enhancedSubTabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.enhancedSubTabContent}
          >
            {karakterSubTabs.map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                style={[
                  styles.enhancedSubTabButton,
                  activeSubTab === tab.id && styles.enhancedSubTabButtonActive
                ]}
                onPress={() => setActiveSubTab(tab.id)}
              >
                <Text style={[
                  styles.enhancedSubTabIcon,
                  activeSubTab === tab.id && styles.enhancedSubTabIconActive
                ]}>
                  {tab.icon}
                </Text>
                <Text style={[
                  styles.enhancedSubTabText,
                  activeSubTab === tab.id && styles.enhancedSubTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* İçerik */}
        <View style={styles.card}>
          {activeSubTab === 'basitAtakHesaplama' && (
            <>
              <Text style={styles.eventName}>⚔️ Basit Atak Hesaplama</Text>
              <Text style={styles.muted}>
                Karakterinizin basit atak değerlerini hesaplamak için tam ekran butonuna tıklayın.
              </Text>
              <TouchableOpacity 
                style={styles.fullScreenButton}
                onPress={() => openWeb('basitAtakHesaplama')}
              >
                <Text style={styles.fullScreenButtonText}>Tam Ekran Aç</Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'skillHesaplama' && (
            <>
              <Text style={styles.eventName}>🔮 Skill Hesaplama</Text>
              <Text style={styles.muted}>
                Skill puanlarınızı hesaplamak ve dağıtmak için tam ekran butonuna tıklayın.
              </Text>
              <TouchableOpacity 
                style={styles.fullScreenButton}
                onPress={() => openWeb('skillHesaplama')}
              >
                <Text style={styles.fullScreenButtonText}>Tam Ekran Aç</Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'charDiz' && (
            <>
              <Text style={styles.eventName}>👤 Char Diz</Text>
              <Text style={styles.muted}>
                Karakterinizi optimize etmek için char diz aracını kullanın.
              </Text>
              <TouchableOpacity 
                style={styles.fullScreenButton}
                onPress={() => openWeb('charDiz')}
              >
                <Text style={styles.fullScreenButtonText}>Tam Ekran Aç</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

// YENİ REHBER BİLEŞENİ - TAMAMEN YENİLENDİ
const RehberScreen = ({ activeSubTab, setActiveSubTab }) => {
  const rehberSubTabs = [
    { id: 'master', icon: '⚔️', label: 'Master' },
    { id: 'masterSkill', icon: '🔮', label: 'Master Skill' },
    { id: 'skillstat', icon: '📊', label: 'Skill-Stat' },
    { id: 'gorevler', icon: '📋', label: 'Görevler' },
    { id: 'achievements', icon: '🏆', label: 'Achievements' },
  ];

  // İçeriği doğrudan render et
  const renderContent = () => {
    switch(activeSubTab) {
      case 'master': return <MasterScreen />;
      case 'masterSkill': return <MasterSkillScreen />;
      case 'skillstat': return <SkillStatResetScreen />;
      case 'gorevler': return <GorevlerScreen />;
      case 'achievements': return <AchievementsScreen />;
      default: return <MasterScreen />;
    }
  };

  return (
    <View style={{flex: 1}}>
      {/* Geliştirilmiş Alt Sekme Menüsü */}
      <View style={styles.enhancedSubTabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.enhancedSubTabContent}
        >
          {rehberSubTabs.map((tab) => (
            <TouchableOpacity 
              key={tab.id}
              style={[
                styles.enhancedSubTabButton,
                activeSubTab === tab.id && styles.enhancedSubTabButtonActive
              ]}
              onPress={() => setActiveSubTab(tab.id)}
            >
              <Text style={[
                styles.enhancedSubTabIcon,
                activeSubTab === tab.id && styles.enhancedSubTabIconActive
              ]}>
                {tab.icon}
              </Text>
              <Text style={[
                styles.enhancedSubTabText,
                activeSubTab === tab.id && styles.enhancedSubTabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* İçerik */}
      <View style={{flex: 1}}>
        {renderContent()}
      </View>
    </View>
  );
};

// Ana Uygulama Bileşeni
function MainApp() {
  const auth = useAuth();
  const {
    user,
    showDisclaimer,
    acceptDisclaimer,
    disclaimerAccepted,
    isLoading,
    appStatus,
    checkAppStatus,
    registerPushToken
  } = auth;

  const [splashVisible, setSplashVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('anasayfa');
  const [activeMerchantSubTab, setActiveMerchantSubTab] = useState('pazar');
  const [activeKarakterSubTab, setActiveKarakterSubTab] = useState('basitAtakHesaplama');
  const [activeRehberSubTab, setActiveRehberSubTab] = useState('master');
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Düzeltilmiş alarm sistemini kullan
  const { alarms, alarmType, toggleAlarm } = useAlarmSystem();

  // Knight Online Etkinlikleri - GÜNCELLENMİŞ
  const etkinlikler = [
    {
      id: 'bdw',
      name: 'BDW - Border Defense War',
      times: ['13:00', '19:00', '02:00'],
      description: 'Sınır Savunma Savaşı'
    },
    {
      id: 'chaos',
      name: 'Chaos',
      times: ['00:00', '12:00'],
      description: 'Kaos Savaşı'
    },
    {
      id: 'juraid',
      name: 'Juraid Mountain (JR)',
      times: ['07:40', '22:40'],
      description: 'Juraid Dağı Etkinliği'
    },
    {
      id: 'bifrost',
      name: 'Bifrost',
      times: ['14:00', '21:00', '02:00'],
      description: 'Bifrost Savaşı'
    },
    {
      id: 'krowaz',
      name: 'Krowaz',
      times: ['10:00', '21:00'],
      description: 'Krowaz Etkinliği'
    },
    {
      id: 'lunar',
      name: 'Lunar War',
      times: ['14:00', '20:00'],
      description: 'Ay Savaşı (Pazartesi & Cumartesi)',
      days: ['Pazartesi', 'Cumartesi']
    },
    {
      id: 'csw',
      name: 'Castle Siege War (CSW)',
      times: ['20:30'],
      description: 'Kale Kuşatma Savaşı (Pazar)',
      days: ['Pazar']
    },
    {
      id: 'utc',
      name: 'Under the Castle (UTC)',
      times: ['21:00'],
      description: 'Kale Altı Savaşı (Sadece Cuma)',
      days: ['Cuma']
    },
    {
      id: 'ultima',
      name: 'Ultima',
      times: ['10:00', '21:30'],
      description: 'Ultima Etkinliği'
    },
    {
      id: 'steam_bdw',
      name: 'SteamKO BDW',
      times: ['01:00', '07:00', '12:00', '16:00', '20:00'],
      description: 'SteamKO Border Defense War'
    },
    {
      id: 'steam_chaos',
      name: 'SteamKO Chaos',
      times: ['10:00', '14:00', '22:00'],
      description: 'SteamKO Chaos Savaşı'
    },
    {
      id: 'steam_jr',
      name: 'SteamKO JR',
      times: ['02:40', '13:40'],
      description: 'SteamKO Juraid Mountain'
    },
    {
      id: 'steam_ft',
      name: 'SteamKO Forgotten Temple (FT)',
      times: ['08:00', '23:00'],
      description: 'SteamKO Unutulmuş Tapınak'
    },
    // YENİ EKLENEN ALARMLAR
    {
      id: 'felankor_esland',
      name: 'Felankor - Esland Boss',
      times: ['09:00', '17:00', '23:30'],
      description: 'Felankor ve Esland Boss Spawn'
    },
    {
      id: 'draki_kulesi',
      name: 'Draki Kulesi',
      times: ['01:00', '04:00'],
      description: 'Draki giriş hakkı ve görev sıfırlama'
    },
    {
      id: 'knight_royale',
      name: 'Knight Royale',
      times: ['16:00', '21:30'],
      description: 'Knight Royale Etkinliği'
    },
    {
      id: 'full_moon_rift',
      name: 'Full Moon Rift',
      times: ['04:00'],
      description: 'Full Moon Rift giriş hakkı sıfırlama'
    },
    {
      id: 'twisted_moradon',
      name: 'Twisted Moradon (Zombi)',
      times: ['16:00', '21:30'],
      description: 'Twisted Moradon Zombi Etkinliği'
    },
    {
      id: 'manesin_arenasi',
      name: 'Manesin Arenası',
      times: ['16:00', '21:30'],
      description: 'Manesin Arenası Etkinliği'
    },
  ];

  // Push bildirimlerini ayarla
  useEffect(() => {
    const setupPushNotifications = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus === 'granted') {
          const token = (await Notifications.getExpoPushTokenAsync()).data;
          await registerPushToken(token);
          console.log('Push notification token kaydedildi:', token);
        }
      } catch (error) {
        console.log('Push notification ayarlanırken hata:', error);
      }
    };

    setupPushNotifications();
  }, []);

  // Uygulama durumunu periyodik olarak kontrol et
  useEffect(() => {
    const interval = setInterval(() => {
      checkAppStatus();
    }, 30 * 60 * 1000); // 30 dakikada bir

    return () => clearInterval(interval);
  }, []);

  // Uygulama bakım modunda mı kontrol et
  useEffect(() => {
    if (appStatus.maintenance) {
      Alert.alert(
        'Bakım Modu',
        'Uygulama şu anda bakım modundadır. Lütfen daha sonra tekrar deneyin.',
        [{ text: 'Tamam' }]
      );
    }
    
    if (appStatus.status === 'banned') {
      Alert.alert(
        'Uygulama Engellendi',
        'Bu uygulama kullanımdan kaldırılmıştır.',
        [{ text: 'Tamam', onPress: () => {} }]
      );
    }
  }, [appStatus]);

  // Alarm ekranı
  const AlarmScreen = () => {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.tabContent}>
          <Text style={styles.homeTitle}>⏰ Knight Online Etkinlikleri</Text>
          <Text style={styles.alarmInfo}>
            🔔 Alarmlar etkinlikten 5 dakika önce ve tam zamanında bildirim gönderir.
          </Text>

          <View style={styles.card}>
            {etkinlikler.map((etkinlik) => (
              <View key={etkinlik.id} style={styles.etkinlikItem}>
                <View style={styles.etkinlikHeader}>
                  <View style={styles.etkinlikInfo}>
                    <Text style={styles.etkinlikName}>{etkinlik.name}</Text>
                    <Text style={styles.etkinlikDescription}>{etkinlik.description}</Text>
                    {etkinlik.days && (
                      <Text style={styles.etkinlikDays}>📅 {etkinlik.days.join(', ')}</Text>
                    )}
                  </View>
                  <Switch
                    value={alarms[etkinlik.id]?.active || false}
                    onValueChange={() => toggleAlarm(etkinlik.id, etkinlik)}
                    trackColor={{ false: '#475467', true: '#FFD66B' }}
                    thumbColor={alarms[etkinlik.id]?.active ? '#0B0B0B' : '#f4f3f4'}
                  />
                </View>
                <Text style={styles.etkinlikTime}>🕐 Saatler: {etkinlik.times.join(' - ')}</Text>
                <Text style={[
                  styles.alarmStatus,
                  { color: alarms[etkinlik.id]?.active ? '#FFD66B' : '#8E97A8' }
                ]}>
                  {alarms[etkinlik.id]?.active ?
                    `✅ Alarm Aktif (5dk önce & tam zamanında)` :
                    '❌ Alarm Kapalı'
                  }
                </Text>
                {alarms[etkinlik.id]?.active && (
                  <Text style={styles.alarmDetail}>
                    ⚙️ Son ayarlanma: {new Date(alarms[etkinlik.id]?.lastScheduled).toLocaleString('tr-TR')}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  // Ana sayfa içeriği
  const AnasayfaScreen = () => {
    const aktifAlarmlar = etkinlikler.filter(etkinlik => alarms[etkinlik.id]?.active);

    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.tabContent}>
          <Text style={styles.homeTitle}>🏠 Hoş Geldiniz, {user?.username || 'Kullanıcı'}!</Text>

          {/* Uygulama Durumu */}
          {appStatus.maintenance && (
            <View style={[styles.infoBox, { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderLeftColor: '#FF6B6B' }]}>
              <Text style={[styles.infoText, { color: '#FF6B6B' }]}>
                ⚠️ Uygulama bakım modunda. Bazı özellikler kısıtlanmış olabilir.
              </Text>
            </View>
          )}

          {/* Alarm Tipi Bilgisi */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              🔔 Alarm durumu: <Text style={{fontWeight: 'bold', color: '#FFD66B'}}>
                Bildirim gönderilir
              </Text>
            </Text>
            <Text style={[styles.infoText, {fontSize: 12, marginTop: 5}]}>
              Etkinliklerden 5 dakika önce ve tam zamanında bildirim alırsınız
            </Text>
          </View>

          {/* WhatsApp Çekiliş Kutusu */}
          <CekilisKutusu />

          {/* Dinamik Güncelleme Notları */}
          <GuncellemeNotlariKutusu />

          {/* Sadece Aktif Alarmlar Bölümü */}
          {aktifAlarmlar.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.eventName}>⏰ Aktif Alarmlarım</Text>
              {aktifAlarmlar.map((etkinlik) => (
                <View key={etkinlik.id} style={styles.etkinlikItem}>
                  <View style={styles.etkinlikHeader}>
                    <View style={styles.etkinlikInfo}>
                      <Text style={styles.etkinlikName}>{etkinlik.name}</Text>
                      <Text style={styles.etkinlikDescription}>{etkinlik.description}</Text>
                      {etkinlik.days && (
                        <Text style={styles.etkinlikDays}>📅 {etkinlik.days.join(', ')}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.etkinlikTime}>🕐 Saatler: {etkinlik.times.join(' - ')}</Text>
                  <Text style={[styles.alarmStatus, { color: '#FFD66B' }]}>
                    ✅ Alarm Aktif (5dk önce & tam zamanında)
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Diğer içerikler */}
          <View style={styles.card}>
            <Text style={styles.eventName}>🎯 Knight Rehber'e Hoş Geldiniz</Text>
            <Text style={styles.muted}>
              Knight Online için kapsamlı rehber uygulaması. Etkinlik alarmları, merchant fiyatları, skill hesaplamaları ve daha fazlası!
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // Sekmeler
  const allTabs = [
    { id: 'anasayfa', icon: '🏠', label: 'Anasayfa' },
    { id: 'alarm', icon: '⏰', label: 'Alarm' },
    { id: 'merchant', icon: '💰', label: 'Merchant' },
    { id: 'karakter', icon: '👤', label: 'Karakter' },
    { id: 'rehber', icon: '📚', label: 'Rehber' },
    { id: 'nostalji', icon: '📸', label: 'Nostalji' },
  ];

  // Splash screen efekti
  useEffect(() => {
    if (splashVisible) {
      const timer = setTimeout(() => {
        setSplashVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [splashVisible]);

  // Bildirim kanalını kur
  useEffect(() => {
    setupNotificationChannel();
  }, []);

  if (splashVisible) {
    return <SplashScreen />;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#07070C", justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFD66B', fontSize: 18 }}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  // Uygulama banlıysa
  if (appStatus.status === 'banned') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#07070C", justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#FF6B6B', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
          ⚠️ Uygulama Engellendi
        </Text>
        <Text style={{ color: '#8E97A8', fontSize: 16, textAlign: 'center' }}>
          Bu uygulama kullanımdan kaldırılmıştır.
        </Text>
      </SafeAreaView>
    );
  }

  // SORUMLULUK REDDİ MODAL'INI İLK AÇILIŞTA GÖSTER
  if (showDisclaimer && !disclaimerAccepted) {
    return (
      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={acceptDisclaimer}
      />
    );
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'anasayfa':
        return <AnasayfaScreen />;
      case 'alarm':
        return <AlarmScreen />;
      case 'merchant':
        return <MerchantScreen 
          activeSubTab={activeMerchantSubTab} 
          setActiveSubTab={setActiveMerchantSubTab} 
        />;
      case 'karakter':
        return <KarakterScreen 
          activeSubTab={activeKarakterSubTab} 
          setActiveSubTab={setActiveKarakterSubTab} 
        />;
      case 'rehber':
        return <RehberScreen 
          activeSubTab={activeRehberSubTab} 
          setActiveSubTab={setActiveRehberSubTab} 
        />;
      case 'nostalji':
        return <KnightNostaljiScreen />;
      default:
        return <AnasayfaScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#07070C" barStyle="light-content" />

      {/* Header */}
      <Header onOpenSettings={() => setSettingsVisible(true)} />

      {/* Main Content */}
      <View style={styles.content}>
        {renderContent()}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {allTabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.navItem,
              activeTab === tab.id && styles.navItemActive
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[
              styles.navIcon,
              activeTab === tab.id && styles.navIconActive
            ]}>
              {tab.icon}
            </Text>
            <Text style={[
              styles.navLabel,
              activeTab === tab.id && styles.navLabelActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modals */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070C',
  },
  content: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#07070C',
  },
  tabContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0B0B0B',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D24',
  },
  title: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsWrap: {
    padding: 8,
  },
  settingsCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1D24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsEmoji: {
    fontSize: 18,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0B0B0B',
    borderTopWidth: 1,
    borderTopColor: '#1A1D24',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#FFD66B',
  },
  navIcon: {
    fontSize: 20,
    color: '#8E97A8',
    marginBottom: 4,
  },
  navIconActive: {
    color: '#FFD66B',
  },
  navLabel: {
    fontSize: 12,
    color: '#8E97A8',
  },
  navLabelActive: {
    color: '#FFD66B',
    fontWeight: '600',
  },
  homeTitle: {
    color: '#FFD66B',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#8E97A8',
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  // Geliştirilmiş Alt Sekme Stilleri
  enhancedSubTabContainer: {
    backgroundColor: '#0B0B0B',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D24',
    paddingVertical: 8,
  },
  enhancedSubTabContent: {
    paddingHorizontal: 8,
  },
  enhancedSubTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    minWidth: 100,
    justifyContent: 'center',
  },
  enhancedSubTabButtonActive: {
    backgroundColor: '#FFD66B',
  },
  enhancedSubTabIcon: {
    fontSize: 16,
    color: '#8E97A8',
    marginRight: 6,
  },
  enhancedSubTabIconActive: {
    color: '#0B0B0B',
  },
  enhancedSubTabText: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '600',
  },
  enhancedSubTabTextActive: {
    color: '#0B0B0B',
    fontWeight: 'bold',
  },
  // Çekiliş Kutusu Stilleri
  cekilisCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FFD66B',
  },
  cekilisTitle: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  cekilisDescription: {
    color: '#8E97A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  whatsappButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cekilisInfo: {
    backgroundColor: 'rgba(37, 211, 102, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#25D366',
  },
  cekilisInfoText: {
    color: '#8E97A8',
    fontSize: 12,
    marginBottom: 4,
  },
  // Güncelleme Notları Stilleri
  guncellemeCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  guncellemeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guncellemeTitle: {
    color: '#FFD66B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    fontSize: 20,
    color: '#FFD66B',
    padding: 5,
  },
  guncellemeItem: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  guncellemeTarih: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: '600',
  },
  guncellemeOnem: {
    fontSize: 14,
  },
  guncellemeOnemYuksek: {
    color: '#FF6B6B',
  },
  guncellemeBaslik: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  guncellemeOzet: {
    color: '#8E97A8',
    fontSize: 12,
    lineHeight: 16,
  },
  lastUpdateText: {
    color: '#8E97A8',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  eventName: {
    color: '#FFD66B',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  muted: {
    color: '#8E97A8',
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 214, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD66B',
    marginBottom: 16,
  },
  infoText: {
    color: '#FFD66B',
    fontSize: 14,
  },
  etkinlikItem: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  etkinlikHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  etkinlikInfo: {
    flex: 1,
  },
  etkinlikName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  etkinlikDescription: {
    color: '#8E97A8',
    fontSize: 12,
  },
  etkinlikDays: {
    color: '#FFD66B',
    fontSize: 11,
    marginTop: 2,
  },
  etkinlikTime: {
    color: '#8E97A8',
    fontSize: 14,
    marginBottom: 4,
  },
  alarmStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  alarmDetail: {
    color: '#8E97A8',
    fontSize: 10,
    marginTop: 2,
  },
  alarmInfo: {
    color: '#8E97A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 214, 107, 0.1)',
    borderRadius: 8,
  },
  // Nostalji Header
  nostaljiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: '600',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2D3748',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  profileName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#8E97A8',
    fontSize: 14,
    marginBottom: 8,
  },
  premiumBadge: {
    backgroundColor: '#FFD66B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  premiumBadgeText: {
    color: '#0B0B0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  small: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: '#8E97A8',
    fontSize: 12,
  },
  alarmTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 4,
  },
  alarmTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  alarmTypeButtonActive: {
    backgroundColor: '#FFD66B',
  },
  alarmTypeText: {
    fontSize: 12,
    color: '#8E97A8',
  },
  alarmTypeTextActive: {
    color: '#0B0B0B',
    fontWeight: 'bold',
  },
  disclaimerSetting: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  disclaimerSettingText: {
    color: '#FFD66B',
    fontSize: 14,
  },
  textArea: {
    backgroundColor: '#2D3748',
    borderRadius: 12,
    padding: 16,
    color: 'white',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#475467',
  },
  quickContactButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  contactButton: {
    flex: 1,
    backgroundColor: '#2D3748',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  sendBtn: {
    flex: 1,
    backgroundColor: '#FFD66B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  sendBtnText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '600',
  },
  // Table Styles
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderText: {
    color: '#FFD66B',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  tableRowEven: {
    backgroundColor: '#1A1D24',
  },
  tableRowOdd: {
    backgroundColor: '#2D3748',
  },
  tableCell: {
    color: 'white',
    fontSize: 12,
    textAlign: 'center',
  },
  resetInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 214, 107, 0.1)',
    borderRadius: 8,
  },
  resetInfoTitle: {
    color: '#FFD66B',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resetInfoText: {
    color: '#8E97A8',
    fontSize: 12,
    marginBottom: 4,
  },
  // Achievement Styles
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2D3748',
    marginHorizontal: 4,
  },
  filterButtonActive: {
    backgroundColor: '#FFD66B',
  },
  filterButtonText: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#0B0B0B',
  },
  achievementItem: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  achievementName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  achievementTitle: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementEffect: {
    color: '#8E97A8',
    fontSize: 12,
    marginBottom: 4,
  },
  achievementDescription: {
    color: '#8E97A8',
    fontSize: 11,
    marginBottom: 4,
    lineHeight: 16,
  },
  achievementReward: {
    color: '#FFD66B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  achievementCategory: {
    color: '#8E97A8',
    fontSize: 10,
    fontStyle: 'italic',
  },
  // Master Styles
  classSection: {
    backgroundColor: '#1A1D24',
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  classTitle: {
    color: '#FFD66B',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  itemText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
    marginLeft: 10,
    lineHeight: 20,
  },
  aciklamaItem: {
    backgroundColor: '#1A1D24',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  aciklamaItemTitle: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  aciklamaItemText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  classImageContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFD66B',
  },
  classImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  imageText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  fullScreenImageContainer: {
    width: '95%',
    height: '80%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1D24',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Master Skill Styles
  masterSkillItem: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  masterSkillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  masterSkillLevel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tozContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 15,
  },
  tozMiktar: {
    color: '#FDB022',
    fontSize: 15,
    fontWeight: 'bold',
    marginRight: 6,
  },
  tozText: {
    color: '#12B76A',
    fontSize: 13,
    fontWeight: 'bold',
  },
  masterSkillAciklama: {
    color: '#8E97A8',
    fontSize: 12,
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#FFD66B',
  },
  stepContainer: {
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1D24',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  stepNumber: {
    backgroundColor: '#FFD66B',
    color: '#0B0B0B',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: 'bold',
    marginRight: 12,
  },
  stepText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  tableContainer: {
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  skillModalContent: {
    backgroundColor: '#1A1D24',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FFD66B',
  },
  skillModalTitle: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  skillDetailItem: {
    marginBottom: 12,
  },
  skillDetailLabel: {
    color: '#FFD66B',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  skillDetailValue: {
    color: 'white',
    fontSize: 14,
  },
  closeDetailButton: {
    backgroundColor: '#FFD66B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeDetailButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Nostalji Styles
  nostaljiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nostaljiImageContainer: {
    width: '48%',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2D3748',
  },
  nostaljiImage: {
    width: '100%',
    height: 120,
  },
  nostaljiImageInfo: {
    padding: 8,
  },
  nostaljiImageTitle: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  navButtonLeft: {
    position: 'absolute',
    left: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonRight: {
    position: 'absolute',
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonText: {
    color: 'white',
    fontSize: 30,
    fontWeight: 'bold',
  },
  fullScreenImageTouchable: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    paddingBottom: 40,
  },
  fullImageTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  imageCounter: {
    color: '#8E97A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  nostaljiWatermark: {
    color: '#FFD66B',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // WebView Styles
  webViewContainer: {
    flex: 1,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#1A1D24',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  webViewTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 5,
  },
  loadingText: {
    color: '#FFD66B',
    fontSize: 12,
  },
  webView: {
    flex: 1,
  },
  fullScreenButton: {
    backgroundColor: '#FFD66B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  fullScreenButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Sub Tab Styles
  subTabMenu: {
    marginBottom: 16,
  },
  subTabMenuContent: {
    paddingHorizontal: 4,
  },
  subTabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2D3748',
    marginHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeSubTab: {
    backgroundColor: '#FFD66B',
  },
  subTabIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#8E97A8',
  },
  activeSubTabIcon: {
    color: '#0B0B0B',
  },
  subTabText: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '500',
  },
  activeSubTabText: {
    color: '#0B0B0B',
  },
  // Görevler Styles
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gorevSayisi: {
    color: '#8E97A8',
    fontSize: 14,
  },
  levelButtonsContainer: {
    marginBottom: 16,
  },
  levelButton: {
    backgroundColor: '#2D3748',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  levelButtonActive: {
    backgroundColor: '#FFD66B',
  },
  levelButtonText: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '500',
  },
  levelButtonTextActive: {
    color: '#0B0B0B',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#2D3748',
    color: 'white',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#475467',
  },
  gorevListesi: {
    flex: 1,
  },
  gorevItem: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  gorevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gorevSeviye: {
    color: '#0B0B0B',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gorevBaslik: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },
  gorevNpc: {
    color: '#FFD66B',
    fontSize: 12,
    marginBottom: 4,
  },
  gorevAciklama: {
    color: '#8E97A8',
    fontSize: 12,
    marginBottom: 4,
  },
  gorevOdul: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '500',
  },
  // Disclaimer Styles
  disclaimerContainer: {
    flex: 1,
    backgroundColor: 'rgba(7, 7, 12, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  disclaimerContent: {
    backgroundColor: '#1A1D24',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFD66B',
    width: '100%',
    maxHeight: '80%',
  },
  disclaimerTitle: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  disclaimerScroll: {
    maxHeight: 300,
    marginBottom: 16,
  },
  disclaimerText: {
    color: '#8E97A8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'justify',
  },
  disclaimerButton: {
    backgroundColor: '#FFD66B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disclaimerButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // ... diğer stiller

  screen: {
    flex: 1,
    backgroundColor: '#0F1117',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },

  // Görevler için özel stiller
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterTitle: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gorevSayisi: {
    color: '#8E97A8',
    fontSize: 14,
  },
  levelButtonsContainer: {
    maxHeight: 50,
    marginBottom: 12,
  },
  levelButtonsContent: {
    paddingHorizontal: 4,
  },
  levelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1A1D26',
    borderRadius: 20,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  levelButtonActive: {
    backgroundColor: '#FFD66B',
    borderColor: '#FFD66B',
  },
  levelButtonText: {
    color: '#8E97A8',
    fontSize: 14,
    fontWeight: '600',
  },
  levelButtonTextActive: {
    color: '#0B0B0B',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#1A1D26',
    borderWidth: 1,
    borderColor: '#2D3748',
    borderRadius: 12,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  gorevListContainer: {
    flex: 1,
  },
  gorevListesi: {
    flex: 1,
  },
  gorevListContent: {
    paddingBottom: 20,
  },
  gorevItem: {
    backgroundColor: '#1A1D26',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  gorevHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadge: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  gorevSeviye: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  gorevBaslik: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  gorevNpc: {
    color: '#8E97A8',
    fontSize: 14,
    marginBottom: 4,
  },
  gorevAciklama: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  gorevOdul: {
    color: '#6BCF7F',
    fontSize: 14,
    fontWeight: '600',
  },
  

  // YENİ EKLENECEK STİLLER - GÜNCELLENMİŞ ALT SEKMELER İÇİN
  enhancedSubTabContainer: {
    backgroundColor: '#1D2939',
    borderBottomWidth: 1,
    borderBottomColor: '#344054',
    paddingVertical: 8,
  },
  enhancedSubTabContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  enhancedSubTabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#344054',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 4,
    minWidth: 100,
    justifyContent: 'center',
  },
  enhancedSubTabButtonActive: {
    backgroundColor: '#FFD66B',
  },
  enhancedSubTabIcon: {
    fontSize: 16,
    marginRight: 6,
    color: '#98A2B3',
  },
  enhancedSubTabIconActive: {
    color: '#0B0B0B',
  },
  enhancedSubTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#98A2B3',
  },
  enhancedSubTabTextActive: {
    color: '#0B0B0B',
  },

  // WebView için stiller
  webViewContainer: {
    flex: 1,
    backgroundColor: '#07070C',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1D2939',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#344054',
  },
  webViewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginLeft: -40, // Geri butonunu dengelemek için
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    right: 16,
  },
  loadingText: {
    color: '#98A2B3',
    fontSize: 12,
  },

  // Tam ekran butonu
  fullScreenButton: {
    backgroundColor: '#FFD66B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  fullScreenButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: '600',
  },
});



export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}