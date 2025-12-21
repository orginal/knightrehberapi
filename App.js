
import React, { useState, useEffect, useContext, createContext, useRef, useMemo, useCallback } from 'react';
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
  Linking,
  AppState
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import AlarmScreen from './src/screens/AlarmScreen';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Bildirim handler - bildirim geldiğinde bir sonraki gün için yeniden zamanla
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { data } = notification.request.content;
    
    // ✅ DÜZELTME: Handler her zaman bildirimi göstersin, sadece alarm bildirimlerini yeniden zamanla
    // Handler hemen dönmeli, async işlemler arka planda yapılmalı
    
    // ✅ DEĞİŞİKLİK: Artık sadece 5 dakika öncesi bildirimi var (tam saatte bildirim yok)
    // Eğer 5 dakika öncesi alarm bildirimi ise, bir sonraki gün için yeniden zamanla
    // Async işlemleri arka planda yap, handler'ı hemen döndür
    if (data && data.alarmId && data.time && data.type === 'alarm_5min_before') {
      // Async işlemleri arka planda yapmak için setTimeout kullan (0ms - hemen arka planda)
      setTimeout(async () => {
        try {
          const { EVENTS_DATA } = require('./src/data/events');
          const { Platform } = require('react-native');
          const alarm = EVENTS_DATA.find(a => a.id === data.alarmId);
          
          if (alarm) {
            // Bir sonraki gün için hesapla - doğru zaman hesaplaması
            const now = new Date();
            const [hours, minutes] = data.time.split(':').map(Number);
            
            // Bugün için hedef zamanı oluştur
            const targetDate = new Date(now);
            targetDate.setHours(hours, minutes, 0, 0);
            targetDate.setMilliseconds(0);
            
            // Eğer hedef zaman geçmişse, bir sonraki güne al
            if (targetDate <= now) {
              targetDate.setDate(targetDate.getDate() + 1);
            }
            
            // Gün kontrolü - belirli günlerde çalışacaksa
            if (alarm.days && alarm.days.length > 0) {
              const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
              let targetDay = targetDate.getDay();
              let targetDayName = DAYS_TR[targetDay];
              
              // Eğer hedef gün uygun değilse, bir sonraki uygun günü bul
              if (!alarm.days.includes(targetDayName)) {
                // Maksimum 7 gün ileriye bak (bir hafta)
                for (let i = 1; i <= 7; i++) {
                  targetDate.setDate(targetDate.getDate() + 1);
                  targetDay = targetDate.getDay();
                  targetDayName = DAYS_TR[targetDay];
                  
                  if (alarm.days.includes(targetDayName)) {
                    // Uygun günü bulduk, saati ayarla
                    targetDate.setHours(hours, minutes, 0, 0);
                    targetDate.setMilliseconds(0);
                    break;
                  }
                }
              }
            }
            
            // Son kontrol: Eğer hala geçmiş bir zamansa, bir gün daha ekle
            if (targetDate <= now) {
              targetDate.setDate(targetDate.getDate() + 1);
              targetDate.setHours(hours, minutes, 0, 0);
              targetDate.setMilliseconds(0);
            }
            
            try {
              // ✅ DEĞİŞİKLİK: 5 dakika öncesi bildirim olarak yeniden zamanla (tam saatte bildirim YOK)
              // Bildirim metninde "5 dakika kaldı" yazacak ve 5 dakika öncesinde gönderilecek
              const targetDate5Min = new Date(targetDate);
              targetDate5Min.setMinutes(targetDate5Min.getMinutes() - 5); // 5 dakika öncesi
              targetDate5Min.setMilliseconds(0);
              
              // Eğer 5 dakika öncesi geçmiş bir zamansa, bir sonraki gün için hesapla
              if (targetDate5Min <= now) {
                targetDate5Min.setDate(targetDate5Min.getDate() + 1);
                targetDate5Min.setHours(hours, minutes, 0, 0);
                targetDate5Min.setMinutes(targetDate5Min.getMinutes() - 5);
                targetDate5Min.setMilliseconds(0);
              }
              
              const notificationId5Min = `${data.alarmId}_${data.time}_5min_before`;
              
              // Önce aynı identifier'a sahip bildirimi iptal et (varsa)
              try {
                await Notifications.cancelScheduledNotificationAsync(notificationId5Min);
              } catch (cancelError) {
                // Bildirim yoksa hata vermez, devam et
              }
              
              // ✅ BİLDİRİM GÜVENLİĞİ: MAX priority - düşük pil modunda da çalışır
              if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                  name: 'Alarm Bildirimleri',
                  importance: Notifications.AndroidImportance.MAX, // MAX priority
                  vibrationPattern: [0, 250, 250, 250],
                  lightColor: '#FFD66B',
                  sound: true,
                  enableLights: true,
                  enableVibrate: true,
                  showBadge: true,
                });
              }
              
              // ✅ BİLDİRİM GÜVENLİĞİ: 5 dakika öncesi bildirimi MAX priority ile yeniden zamanla
              // NOT: Yerel bildirimler internet gerektirmez. Android'in Battery Optimization ayarları
              // bildirimleri geciktirebilir, bu yüzden MAX priority kullanıyoruz.
              await Notifications.scheduleNotificationAsync({
                identifier: notificationId5Min,
                content: {
                  title: `⏰ ${data.eventName || alarm.name}`,
                  body: `🕐 ${data.eventName || alarm.name} başlamasına 5 dakika kaldı`,
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.MAX, // MAX priority - internet olmadan da çalışır
                  data: { 
                    alarmId: data.alarmId, 
                    time: data.time,
                    eventName: data.eventName || alarm.name,
                    description: `${data.eventName || alarm.name} başlamasına 5 dakika kaldı`,
                    type: 'alarm_5min_before'
                  },
                  ...(Platform.OS === 'android' && { 
                    channelId: 'default',
                    sticky: true, // Kullanıcı kapatana kadar kalır - internet gerektirmez
                  }),
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: targetDate5Min, // 5 dakika öncesinde gönderilecek
                  // Yerel bildirimler internet bağlantısı gerektirmez
                },
              });
              
              console.log(`🔄 5 dakika öncesi bildirim yeniden zamanlandı: ${data.alarmId} - ${data.time} (${targetDate5Min.toISOString()})`);
            } catch (error) {
              console.error('❌ Bildirim yeniden zamanlama hatası:', error);
            }
          }
        } catch (error) {
          console.error('❌ Bildirim handler hatası:', error);
        }
      });
    }
    
    // Handler'ı hemen döndür - bildirim hemen gösterilsin
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

// Saati parçalara ayırma
const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
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
  const [appState, setAppState] = useState(AppState.currentState);
  

  // Etkinlik listesi
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


  // İlk kurulum kontrolü - telefon saatiyle eşleşme
  const checkFirstTimeSetup = async () => {
    try {
      const firstTimeSetup = await AsyncStorage.getItem('firstTimeSetup');
      if (!firstTimeSetup) {
        // İlk kurulum - telefon saatiyle eşleşme kontrolü
        const now = new Date();
        await AsyncStorage.setItem('firstTimeSetup', JSON.stringify({
          completed: true,
          setupTime: now.toISOString(),
          deviceTime: now.getTime()
        }));
        return true; // İlk kurulum
      }
      return false; // Daha önce kurulum yapılmış
    } catch (error) {
      console.log('İlk kurulum kontrolü hatası:', error);
      return false;
    }
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
          username: 'Kullanıcı',
          phone: '',
          createdAt: new Date(),
          favorites: [],
          premium: false,
        };
        
        setUser(guestUser);
        await saveUserToStorage(guestUser);
        
        setDisclaimerAccepted(savedDisclaimer);
        setShowDisclaimer(!savedDisclaimer);

        // İlk kurulum kontrolü - telefon saatiyle eşleşme
        const isFirstTime = await checkFirstTimeSetup();
        if (isFirstTime) {
          console.log('✅ İlk kurulum tamamlandı - telefon saatiyle eşleşme kontrolü yapıldı');
        }

        // Alarm sistemi başlatma
        if (Platform.OS !== 'web') {
          try {
            // İlk kurulum kontrolü - SADECE İLK KURULUMDA telefon saatiyle eşleştir
            const isFirstLaunch = await AsyncStorage.getItem('isFirstLaunch');
            
            if (isFirstLaunch === null) {
              // SADECE İLK KURULUMDA: Telefonun saat ve gün bilgisini kaydet
              const now = new Date();
              const phoneHour = now.getHours();
              const phoneMinute = now.getMinutes();
              const phoneDay = now.getDay(); // 0=Pazar, 1=Pazartesi, ...
              
              const deviceTimeInfo = {
                timestamp: now.getTime(),
                localHours: phoneHour,
                localMinutes: phoneMinute,
                localDay: phoneDay,
                timezoneOffset: now.getTimezoneOffset(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                dateString: now.toLocaleString('tr-TR', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                dayName: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][phoneDay]
              };
              await AsyncStorage.setItem('deviceTimeInfo', JSON.stringify(deviceTimeInfo));
              await AsyncStorage.setItem('isFirstLaunch', 'false');
              
              console.log('📱 İLK KURULUM - Telefon saati ve günü kaydedildi:');
              console.log(`   📅 Gün: ${deviceTimeInfo.dayName} (${phoneDay})`);
              console.log(`   🕐 Saat: ${phoneHour}:${phoneMinute.toString().padStart(2, '0')}`);
              console.log(`   🌍 Timezone: ${deviceTimeInfo.timezone}`);
              console.log('✅ İlk kurulum tamamlandı - telefon saati ve günüyle eşleştirildi');
            } else {
              console.log('📱 Uygulama açıldı (ilk kurulum değil, eşleştirme yapılmadı)');
            }

          } catch (error) {
            console.error('Alarm setup error:', error);
          }

          // Push Notification token kayıt
          try {
            console.log('📱 Push notification setup başlatılıyor...');
            
            // Android için bildirim kanalı oluştur (APK için gerekli)
            if (Platform.OS === 'android') {
              try {
                await Notifications.setNotificationChannelAsync('default', {
                  name: 'Varsayılan',
                  importance: Notifications.AndroidImportance.MAX,
                  vibrationPattern: [0, 250, 250, 250],
                  lightColor: '#FFD66B',
                  sound: 'default',
                });
                console.log('✅ Android bildirim kanalı oluşturuldu');
              } catch (channelError) {
                console.error('❌ Bildirim kanalı oluşturma hatası:', channelError);
              }
            }
            
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            console.log('📱 Mevcut bildirim izni durumu:', existingStatus);
            
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
              console.log('📱 Bildirim izni isteniyor...');
              const { status } = await Notifications.requestPermissionsAsync();
              finalStatus = status;
              console.log('📱 Bildirim izni sonucu:', status);
            }
            
            if (finalStatus === 'granted') {
              console.log('✅ Bildirim izni verildi, token alınıyor...');
              
              try {
                // Token options - Standalone APK'lar için experienceId ZORUNLU
                // projectId: ceylan26 hesabına ait yeni projectId
                const tokenOptions = {
                  projectId: '01db3b91-a023-4742-a675-e40753963569'
                };
                
                // Standalone APK'lar için experienceId HER ZAMAN ekle
                // Expo Go'da da zarar vermez, ama standalone APK'da olmadan çalışmaz
                if (Platform.OS === 'android') {
                  tokenOptions.experienceId = '@ceylan26/knight-rehber';
                  console.log('📱 Android cihaz - experienceId eklendi:', tokenOptions.experienceId);
                }
                
                // Debug bilgileri
                console.log('📱 Token options:', JSON.stringify(tokenOptions));
                console.log('📱 App ownership:', Constants.appOwnership);
                console.log('📱 Execution environment:', Constants.executionEnvironment);
                console.log('📱 Platform:', Platform.OS);
                console.log('📱 App version:', Constants.expoConfig?.version || 'unknown');
                
                const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
                const pushToken = tokenData.data;
                console.log('✅ Expo Push Token alındı:', pushToken);
                console.log('📱 Token uzunluğu:', pushToken.length);
                console.log('📱 Token formatı:', pushToken.startsWith('ExponentPushToken[') ? 'Doğru' : 'Hatalı');

                // Token'ı backend'e gönder
                try {
                  console.log('📤 Token backend\'e gönderiliyor...');
                  console.log('📤 Token değeri:', pushToken);
                  console.log('📤 Backend URL:', 'https://knightrehberapi.vercel.app/api/push/register');
                  
                  const response = await fetch('https://knightrehberapi.vercel.app/api/push/register', {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify({ token: pushToken })
                  });
                  
                  console.log('📤 Backend response status:', response.status);
                  console.log('📤 Backend response ok:', response.ok);
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ Backend hata yanıtı:', errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                  }
                  
                  const result = await response.json();
                  console.log('📤 Backend yanıtı (JSON):', JSON.stringify(result, null, 2));
                  
                  if (result.success) {
                    console.log('✅ Push token backend\'e kaydedildi. Toplam token:', result.totalTokens || 'bilinmiyor');
                  } else {
                    console.error('❌ Push token kayıt hatası:', result.error);
                  }
                } catch (error) {
                  console.error('❌ Push token gönderme hatası:', error);
                  console.error('❌ Hata tipi:', error.constructor.name);
                  console.error('❌ Hata mesajı:', error.message);
                  console.error('❌ Hata stack:', error.stack);
                  // Hata olsa bile uygulamayı devam ettir
                }
              } catch (tokenError) {
                console.error('❌ Expo Push Token alma hatası:', tokenError);
                console.error('❌ Hata detayı:', tokenError.message);
              }
            } else {
              console.log('⚠️ Bildirim izni verilmedi, token alınamadı');
            }
          } catch (error) {
            console.error('❌ Push notification setup error:', error);
            console.error('❌ Hata tipi:', error.constructor.name);
            console.error('❌ Hata mesajı:', error.message);
            console.error('❌ Hata stack:', error.stack);
            // Hata olsa bile uygulamayı devam ettir
          }
        }

      } catch (error) {
        console.log('❌ Uygulama başlatılırken hata:', error);
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
      isLoading,
      etkinlikler,
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
const Header = ({ onOpenSettings, showBackButton, onBackPress, title }) => {
  return (
    <View style={styles.header}>
      {showBackButton ? (
        <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
          <Text style={styles.backButtonText}>⬅ Geri</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerPlaceholder} />
      )}
      
      {title && <Text style={styles.title}>{title}</Text>}
      
      <TouchableOpacity style={styles.settingsWrap} onPress={onOpenSettings}>
        <View style={styles.settingsCircle}>
          <Text style={styles.settingsEmoji}>⚙️</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

// Reklam Banner Bileşeni - Tüm banner'ları alt alta gösterir
const ReklamBanner = ({ position = 'home' }) => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    fetchBanners();
    setImageErrors({}); // Position değiştiğinde error durumunu sıfırla
  }, [position]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      setImageErrors({});
      const response = await fetch(`${API_BASE_URL}/reklam-banner/${position}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Banner data:', position, data);
        // API {banners: [...]} formatında döndürüyor
        if (data && data.banners && Array.isArray(data.banners) && data.banners.length > 0) {
          // imageUrl'i olan banner'ları filtrele
          const validBanners = data.banners.filter(b => b.imageUrl && b.imageUrl.trim() !== '');
          setBanners(validBanners);
        } else {
          setBanners([]);
        }
      } else {
        console.log('Banner response not ok:', response.status);
        setBanners([]);
      }
    } catch (error) {
      console.error('Banner yükleme hatası:', error);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBannerClick = (clickUrl) => {
    if (clickUrl) {
      Linking.openURL(clickUrl).catch(err => 
        Alert.alert('Hata', 'Link açılamadı.')
      );
    }
  };

  const handleImageError = (error, bannerId, imageUrl) => {
    console.error('Banner görsel yüklenemedi:', {
      bannerId,
      imageUrl,
      error: error?.nativeEvent?.error || error,
      userAgent: 'Expo Go'
    });
    setImageErrors(prev => ({ ...prev, [bannerId]: true }));
  };

  if (loading) {
    return null; // Yüklenirken hiçbir şey gösterme
  }

  // Banner yoksa placeholder göster
  if (banners.length === 0) {
    return (
      <View style={styles.reklamPlaceholder}>
        <Text style={styles.reklamPlaceholderIcon}>📢</Text>
        <Text style={styles.reklamPlaceholderText}>Bu alan reklam için ayrılmıştır</Text>
        <Text style={styles.reklamPlaceholderSubtext}>Reklam vermek için bize ulaşın</Text>
      </View>
    );
  }

  // Tüm banner'ları alt alta göster - View wrapper ile scroll sorununu çöz
  return (
    <View style={styles.reklamBannerWrapper}>
      {banners.map((banner) => {
        // Bu banner'ın görseli hata verdi mi kontrol et
        if (imageErrors[banner.id]) {
          return null; // Hata veren banner'ı gösterme
        }

        return (
          <TouchableOpacity 
            key={banner.id}
            style={styles.reklamBannerContainer} 
            onPress={() => handleBannerClick(banner.clickUrl)}
            activeOpacity={0.8}
          >
            <Image
              source={{
                uri: banner.imageUrl,
                cache: 'reload'
              }}
              style={styles.reklamBannerImage}
              resizeMode="contain"
              onError={(error) => handleImageError(error, banner.id, banner.imageUrl)}
              onLoadStart={() => console.log('Banner yükleniyor:', banner.imageUrl)}
              onLoadEnd={() => console.log('Banner yüklendi:', banner.imageUrl)}
            />
          </TouchableOpacity>
        );
      })}
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

// WebView Screen Component
const WebViewScreen = ({ url, onBack, title }) => {
  return (
    <View style={styles.screen}>
      <Header 
        showBackButton={true} 
        onBackPress={onBack}
        title={title}
        onOpenSettings={() => {}}
      />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
};

// Settings Modal
const SettingsModal = ({ visible, onClose }) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [activeTab, setActiveTab] = useState('ayarlar');

  const sendFeedback = () => {
    if (!text.trim()) return Alert.alert("Boş", "Mesaj yazmalısınız.");
    
    Linking.openURL(`mailto:advertknightrehber@gmail.com?subject=Knight Rehber Geri Bildirim&body=${encodeURIComponent(text)}`).catch(err => 
      Alert.alert('Hata', 'E-posta uygulaması açılamadı.')
    );
    
    Alert.alert("Teşekkürler", "Öneriniz gönderildi!");
    setText("");
    onClose();
  };

  const openEmail = (subject = '', body = '') => {
    const email = 'advertknightrehber@gmail.com';
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

          {/* Sekme Butonları */}
          <View style={styles.settingsTabs}>
            <TouchableOpacity 
              style={[styles.settingsTab, activeTab === 'ayarlar' && styles.settingsTabActive]}
              onPress={() => setActiveTab('ayarlar')}
            >
              <Text style={[styles.settingsTabText, activeTab === 'ayarlar' && styles.settingsTabTextActive]}>
                ⚙️ Ayarlar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.settingsTab, activeTab === 'geri-bildirim' && styles.settingsTabActive]}
              onPress={() => setActiveTab('geri-bildirim')}
            >
              <Text style={[styles.settingsTabText, activeTab === 'geri-bildirim' && styles.settingsTabTextActive]}>
                💡 Geri Bildirim
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'ayarlar' && (
            <>
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <View style={styles.avatarImage}>
                  <Text style={styles.avatarEmoji}>👤</Text>
                </View>
                <Text style={styles.profileName}>Knight Rehber</Text>
                <Text style={styles.profileEmail}>Bize destek olmak için bizi tavsiye edin!</Text>

                {user?.premium && (
                  <View style={styles.premiumBadge}>
                    <Text style={styles.premiumBadgeText}>⭐ PREMIUM</Text>
                  </View>
                )}
              </View>


              <Text style={[styles.small, { marginTop: 18 }]}>YASAL VE GİZLİLİK</Text>
              
              <TouchableOpacity
                style={styles.disclaimerSetting}
                onPress={() => {
                  Alert.alert(
                    '🔒 Gizlilik Politikası',
                    'Gizlilik politikamızı görüntülemek için GitHub sayfasını açmak ister misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      { 
                        text: 'Aç', 
                        onPress: () => Linking.openURL('https://github.com/orginal/knightrehberapi/blob/main/PRIVACY_POLICY.md').catch(err => 
                          Alert.alert('Hata', 'Link açılamadı. Lütfen daha sonra tekrar deneyin veya e-posta ile iletişime geçin: advertknightrehber@gmail.com')
                        )
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.disclaimerSettingText}>🔒 Gizlilik Politikası</Text>
              </TouchableOpacity>
              
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
            </>
          )}

          {activeTab === 'geri-bildirim' && (
            <>
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Text style={styles.profileName}>💡 Geri Bildirim</Text>
                <Text style={styles.profileEmail}>Öneri ve görüşlerinizi bizimle paylaşın</Text>
              </View>

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
              <TouchableOpacity
                style={styles.contactButtonFull}
                onPress={() => openEmail('Şikayet/Öneri', 'Merhaba, Knight Rehber uygulaması hakkında şikayet/önerim var:')}
              >
                <Text style={styles.contactButtonText}>💡 Şikayet/Öneri Gönder</Text>
              </TouchableOpacity>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.sendBtn} onPress={sendFeedback}>
                  <Text style={styles.sendBtnText}>Gönder</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

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
        <View style={{ paddingTop: 70 }} />
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

// Rebirth Sistemi Bileşeni
const RebirthSystemScreen = () => {
  const rebirthExpData = [
    { level: '83/0', exp: 8705986960 },
    { level: '83/1', exp: 9576585656 },
    { level: '83/2', exp: 10534244222 },
    { level: '83/3', exp: 11587668644 },
    { level: '83/4', exp: 12746435508 },
    { level: '83/5', exp: 14021079059 },
    { level: '83/6', exp: 15423186965 },
    { level: '83/7', exp: 16965505661 },
    { level: '83/8', exp: 18662056227 },
    { level: '83/9', exp: 20528261850 },
    { level: '83/10', exp: 22581088035 },
    { level: '83/11', exp: 24839196839 },
    { level: '83/12', exp: 27323116523 },
    { level: '83/13', exp: 30055428175 },
    { level: '83/14', exp: 33060970992 },
    { level: '83/15', exp: 36367068091 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>🔄 Rebirth Sistemi 83/1-15</Text>
        <Text style={styles.sectionDescription}>
          Rebirth seviye sistemi sayesinde artık karakter seviyelerimiz 83/15 LV'a kadar geliştirilebilir.
        </Text>

        <View style={styles.card}>
          <Text style={styles.eventName}>📌 Önemli Not</Text>
          <Text style={styles.muted}>
            Agartha Pandora Zero ve Felis sunucularında son 83/10'dur
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.eventName}>✨ Avantajları</Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                Seviye atladığımız her rebirth işleminde bütün görevlerimiz sıfırlanıyor Exp ve 70-80 Quest'ler dahil.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Her Rebirth seviyesinde 2 Stat Point veriyor ve 83/15 LV geldiğimizde toplamda 30 stat point kazandırmış oluyoruz ve bu stat pointleri 255 + olarak verebiliyoruz. Örn. Warrior Job için 255 STR +30 STR verebiliriz bu sayede U bastığımızda STR : 255+30 olarak gözükür.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                83/1 Rebirth Bastıktan sonra karakterimizin başında rebirth sembolü çıkıyor ve kalıcıdır.
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                83/6 Rebirth Seviyesine ulaştığınızda karakterinizin üstündeki sembol değişmektedir.
              </Text>
            </View>

            <View style={styles.step}>
              <Text style={styles.stepNumber}>5</Text>
              <Text style={styles.stepText}>
                83/11 Rebirth Seviyesine ulaştığınızda karakterinizin üstündeki sembol değişmektedir.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eventName}>📊 Rebirth Seviyeleri Tecrübe Miktarları</Text>
          
          {/* Tablo Başlığı */}
          <View style={styles.expTableHeader}>
            <Text style={[styles.expTableHeaderText, { flex: 1 }]}>Seviye</Text>
            <Text style={[styles.expTableHeaderText, { flex: 2 }]}>Exp Miktarı</Text>
          </View>

          {/* Tablo İçeriği */}
          {rebirthExpData.map((item, index) => (
            <View key={index} style={[
              styles.expTableRow,
              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
            ]}>
              <Text style={[styles.expTableCell, { flex: 1, fontWeight: 'bold' }]}>
                {item.level}
              </Text>
              <Text style={[styles.expTableCell, { flex: 2 }]}>
                {item.exp.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.eventName}>📋 İstenilen Şartlar - Rebirth 1-10 Seviyesi İçin</Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                83 %100 olmak (Not: (U) Karakter İnfo'da Exp Barın tamamen eşit olması gerekiyor)
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                100.000.000 Noah Oyun parası
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                10.000 Ulusal Puan Olması gerekiyor (10k Np)
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 10k NP yok ise 300.000.000 Noah (3gb) para ile bu adımı geçebiliyorsunuz.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eventName}>📋 İstenilen Şartlar - Rebirth 11-15 Seviyesi İçin</Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                83/10 %100 olmak (Not: (U) Karakter İnfo'da Exp Barın tamamen eşit olması gerekiyor)
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                200.000.000 Noah Oyun parası
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Ronark Land haritasının merkezinde 200 Karşı Irktan oyuncu kesme görevinin tamamlanması
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 200 Kill görevini yapmak istemiyorsanız, 500.000.000 Noah (5gb) para ile bu adımı geçebiliyorsunuz.
            </Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ⚠️ Not: Üstünüzde Mutlaka boş yer olması gerekiyor eğer invertory'niz full ise hesabınız bug'ta kalır ve rebirth basamazsınız.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eventName}>📝 Rebirth Yapma Adımları</Text>
          
          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepText}>
                İlk olarak Maradon'daki [Tarot Reader] Mekin'e gidiyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepText}>
                Reincarnation' Seçiyoruz
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepText}>
                Proof of Credentials : Power'ı Seçiyoruz ve Görevi Alıyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
              <Text style={styles.stepText}>
                Tekrar Proof of Experience : Power'a gelip görevi teslim ediyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>5</Text>
              <Text style={styles.stepText}>
                Credentials : Proof of Goods Seçiyoruz ve Görevi alıyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>6</Text>
              <Text style={styles.stepText}>
                Tekrar Credentials:Proof of Goods'a gelip görevi teslim ediyoruz ( 1 GB paramızı alıcak )
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>7</Text>
              <Text style={styles.stepText}>
                Credentials : Proof of Fame'a geliyoruz ve Görevi alıyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>8</Text>
              <Text style={styles.stepText}>
                Tekrar Credentials : Proof of Fame'a gelip görevi teslim ediyoruz. ( 10k Ulusal Puan NP Alıcak bizden )
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              ✅ Bu İşlemlerden sonra Bize " Qualification of Rebirth " Esyasını bize vericek.
            </Text>
          </View>

          <View style={styles.stepContainer}>
            <View style={styles.step}>
              <Text style={styles.stepNumber}>9</Text>
              <Text style={styles.stepText}>
                Reincarnation'a girip Reincarnation'u seçiyoruz ve çıkan " For Example,for the country! " seçiyoruz.
              </Text>
            </View>
            
            <View style={styles.step}>
              <Text style={styles.stepNumber}>10</Text>
              <Text style={styles.stepText}>
                Stat Pointleri vereceğimiz Pencere açılıyor.Ordan istediğimize verip " Rebirth after Applying " seçiyoruz.
              </Text>
            </View>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Not: Kullanılan Stat pointleri moradon'da bulunan [Grand Merchant] Kaishan npc üzerinden 1gb karşılığı sıfırlayabilirsiniz.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

// Farm Geliri Hesapla Bileşeni
const FarmGeliriScreen = () => {
  const [mode, setMode] = useState('1hour'); // '1hour' veya 'unlimited'
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [initialCoins, setInitialCoins] = useState('');
  const [initialPot, setInitialPot] = useState('');
  const [initialMana, setInitialMana] = useState('');
  const [initialWolf, setInitialWolf] = useState('');
  const [initialKitap, setInitialKitap] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [finalCoins, setFinalCoins] = useState('');
  const [finalPot, setFinalPot] = useState('');
  const [finalMana, setFinalMana] = useState('');
  const [finalWolf, setFinalWolf] = useState('');
  const [finalKitap, setFinalKitap] = useState('');
  const [busCount, setBusCount] = useState('');
  const [besCount, setBesCount] = useState('');
  const [calculationResult, setCalculationResult] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoText, setInfoText] = useState('');
  
  const intervalRef = useRef(null);
  const notificationIdRef = useRef(null);
  const notificationIntervalRef = useRef(null);

  // Farm durumunu kaydet
  const saveFarmState = async (state) => {
    try {
      await AsyncStorage.setItem('farmState', JSON.stringify(state));
    } catch (error) {
      console.error('Farm durumu kaydedilemedi:', error);
    }
  };

  // Farm durumunu yükle
  const loadFarmState = async () => {
    try {
      const savedState = await AsyncStorage.getItem('farmState');
      if (savedState) {
        const state = JSON.parse(savedState);
        const savedStartTime = new Date(state.startTime);
        const now = new Date();
        const elapsed = Math.floor((now - savedStartTime) / 1000);
        
        // Eğer 1 saatlik modda ve süre dolmuşsa
        if (state.mode === '1hour' && elapsed >= 3600) {
          // Durumu temizle
          await AsyncStorage.removeItem('farmState');
          return null;
        }
        
        return state;
      }
    } catch (error) {
      console.error('Farm durumu yüklenemedi:', error);
    }
    return null;
  };

  // Farm durumunu temizle
  const clearFarmState = async () => {
    try {
      await AsyncStorage.removeItem('farmState');
    } catch (error) {
      console.error('Farm durumu temizlenemedi:', error);
    }
  };

  // Uygulama açıldığında kaydedilmiş durumu yükle
  useEffect(() => {
    const restoreFarmState = async () => {
      const savedState = await loadFarmState();
      if (savedState) {
        setMode(savedState.mode);
        setInitialCoins(savedState.initialCoins || '');
        setInitialPot(savedState.initialPot || '');
        setInitialMana(savedState.initialMana || '');
        setInitialWolf(savedState.initialWolf || '');
        setInitialKitap(savedState.initialKitap || '');
        
        const savedStartTime = new Date(savedState.startTime);
        setStartTime(savedStartTime);
        setIsRunning(true);
        
        // Geçen süreyi hesapla
        const now = new Date();
        const elapsed = Math.floor((now - savedStartTime) / 1000);
        
        if (savedState.mode === '1hour') {
          // Geri sayım: 3600'den başlayıp 0'a iner
          const remaining = Math.max(0, 3600 - elapsed);
          setElapsedTime(remaining);
        } else {
          // İleri sayım: 0'dan başlayıp artar
          setElapsedTime(elapsed);
        }
      }
    };
    
    restoreFarmState();
  }, []);

  // Fiyatlar
  const PRICES = {
    pot: 3200,
    mana: 5400,
    wolf: 480,
    kitap: 2400,
    bus: 2200000,
    bes: 1000000,
  };

  // Farm bitti bildirimi
  const sendNotification = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        // ✅ FARM BİLDİRİMİ: Farm bildirimleri için ayrı channel kullan
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('farm', {
            name: 'Farm Bildirimleri',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFD66B',
            sound: true,
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
          });
        }
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Farm Bitti',
            body: 'Farm süreniz doldu! Sonuçları girebilirsiniz.',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { type: 'farm_finished' }, // Farm bildirimi olduğunu belirt
          },
          ...(Platform.OS === 'android' && { 
            channelId: 'farm', // Farm bildirimleri için ayrı channel
          }),
          trigger: null, // Hemen gönder
        });
      }
    } catch (error) {
      console.error('Bildirim hatası:', error);
    }
  }, []);

  // Durdur
  const handleStop = useCallback(async () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Bildirimi temizle
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
    // Durumu temizle
    await clearFarmState();
    setShowResultModal(true);
  }, []);

  // Farm başladı bildirimi
  const sendStartNotification = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') {
        // ✅ FARM BİLDİRİMİ: Farm bildirimleri için ayrı channel kullan
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('farm', {
            name: 'Farm Bildirimleri',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FFD66B',
            sound: true,
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
          });
        }
        
        await Notifications.scheduleNotificationAsync({
          content: {
            title: mode === '1hour' ? '🚀 Farm Başladı (1 Saatlik)' : '🚀 Farm Başladı (Süresiz)',
            body: mode === '1hour' ? 'Farm başladı! 60 dakika sonra bildirim alacaksınız.' : 'Farm başladı! İstediğiniz zaman durdurabilirsiniz.',
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX,
            data: { type: 'farm_started' }, // Farm bildirimi olduğunu belirt
          },
          ...(Platform.OS === 'android' && { 
            channelId: 'farm', // Farm bildirimleri için ayrı channel
          }),
          trigger: null,
        });
      }
    } catch (error) {
      console.error('Bildirim hatası:', error);
    }
  }, [mode]);

  // Sayaç güncellemesi
  useEffect(() => {
    if (isRunning && startTime) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - startTime) / 1000);
        
        if (mode === '1hour') {
          // Geri sayım: 3600'den başlayıp 0'a iner
          const remaining = Math.max(0, 3600 - elapsed);
          setElapsedTime(remaining);
          
          // Süre dolduysa
          if (remaining === 0) {
            handleStop();
            sendNotification();
          }
        } else {
          // İleri sayım: 0'dan başlayıp artar
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, startTime, mode, handleStop, sendNotification]);

  // Zamanı formatla
  const formatTime = (seconds) => {
    if (mode === '1hour') {
      // Geri sayım formatı
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else {
      // İleri sayım formatı
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  };

  // Başlat
  const handleStart = async () => {
    // Boş değerleri kontrol et (0 kabul edilir)
    const safeParseInt = (value) => {
      if (!value || value.trim() === '') return 0;
      const parsed = parseInt(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Başlangıç değerlerinin en az birinin girilmiş olması gerekiyor
    const hasAnyValue = safeParseInt(initialCoins) > 0 || 
                       safeParseInt(initialPot) > 0 || 
                       safeParseInt(initialMana) > 0 || 
                       safeParseInt(initialWolf) > 0 || 
                       safeParseInt(initialKitap) > 0;

    if (!hasAnyValue) {
      Alert.alert('Uyarı', 'Lütfen en az bir başlangıç değeri giriniz!');
      return;
    }

    const startTimeNow = new Date();
    setIsRunning(true);
    setStartTime(startTimeNow);
    
    if (mode === '1hour') {
      setElapsedTime(3600); // 60 dakika = 3600 saniye
    } else {
      setElapsedTime(0); // Süresiz modda 0'dan başla
    }
    
    setShowResultModal(false);
    setCalculationResult(null);

    // Durumu kaydet
    await saveFarmState({
      mode,
      startTime: startTimeNow.toISOString(),
      initialCoins,
      initialPot,
      initialMana,
      initialWolf,
      initialKitap,
    });

    // Farm başladı bildirimi gönder
    sendStartNotification();
  };

  // Sıfırla
  const handleReset = async () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
    // Durumu temizle
    await clearFarmState();
    setStartTime(null);
    setElapsedTime(0);
    setInitialCoins('');
    setInitialPot('');
    setInitialMana('');
    setInitialWolf('');
    setInitialKitap('');
    setShowResultModal(false);
    setFinalCoins('');
    setFinalPot('');
    setFinalMana('');
    setFinalWolf('');
    setFinalKitap('');
    setBusCount('');
    setBesCount('');
    setCalculationResult(null);
  };

  // Hesapla
  const handleCalculate = () => {
    // Boş değerleri 0 olarak kabul et
    const safeParseInt = (value) => {
      if (!value || value.trim() === '') return 0;
      const parsed = parseInt(value);
      return isNaN(parsed) ? 0 : parsed;
    };

    // Kullanılan miktarlar
    const usedPot = safeParseInt(initialPot) - safeParseInt(finalPot);
    const usedMana = safeParseInt(initialMana) - safeParseInt(finalMana);
    const usedWolf = safeParseInt(initialWolf) - safeParseInt(finalWolf);
    const usedKitap = safeParseInt(initialKitap) - safeParseInt(finalKitap);

    // Masraflar
    const potCost = usedPot * PRICES.pot;
    const manaCost = usedMana * PRICES.mana;
    const wolfCost = usedWolf * PRICES.wolf;
    const kitapCost = usedKitap * PRICES.kitap;
    const totalCost = potCost + manaCost + wolfCost + kitapCost;

    // Gelirler
    const busValue = safeParseInt(busCount) * PRICES.bus;
    const besValue = safeParseInt(besCount) * PRICES.bes;
    const finalCoinsValue = safeParseInt(finalCoins);
    const totalIncome = finalCoinsValue + busValue + besValue;

    // Kar/Zarar
    const initialCoinsValue = safeParseInt(initialCoins);
    const netProfit = totalIncome - initialCoinsValue - totalCost;

    setCalculationResult({
      totalCost,
      totalIncome,
      netProfit,
      usedPot,
      usedMana,
      usedWolf,
      usedKitap,
      potCost,
      manaCost,
      wolfCost,
      kitapCost,
      busValue,
      besValue,
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>💰 Farm Geliri Hesapla</Text>

        {/* Başlangıç Değerleri */}
        <View style={styles.card}>
          <Text style={styles.eventName}>📥 Başlangıç Değerleri</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Başlangıç Coins</Text>
            <TextInput
              style={styles.input}
              value={initialCoins}
              onChangeText={setInitialCoins}
              placeholder="Farma başlarken üstünüzdeki coins"
              placeholderTextColor="#8E97A8"
              keyboardType="numeric"
              editable={!isRunning}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.inputLabel}>Başlangıç Pot Sayısı</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => {
                  setInfoText('Pot: 3200 coins');
                  setShowInfoModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.infoButtonText}>?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={initialPot}
              onChangeText={setInitialPot}
              placeholder="Pot sayısı"
              placeholderTextColor="#8E97A8"
              keyboardType="numeric"
              editable={!isRunning}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.inputLabel}>Başlangıç Mana</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => {
                  setInfoText('Mana: 5400 coins');
                  setShowInfoModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.infoButtonText}>?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={initialMana}
              onChangeText={setInitialMana}
              placeholder="Mana sayısı"
              placeholderTextColor="#8E97A8"
              keyboardType="numeric"
              editable={!isRunning}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.inputLabel}>Başlangıç Wolf Sayısı</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => {
                  setInfoText('Wolf: 480 coins (2 dakika kullanımı)');
                  setShowInfoModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.infoButtonText}>?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={initialWolf}
              onChangeText={setInitialWolf}
              placeholder="Wolf sayısı"
              placeholderTextColor="#8E97A8"
              keyboardType="numeric"
              editable={!isRunning}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelWithInfo}>
              <Text style={styles.inputLabel}>Başlangıç Kitap Sayısı</Text>
              <TouchableOpacity 
                style={styles.infoButton}
                onPress={() => {
                  setInfoText('Kitap: 2400 coins (100 saniye kullanımı)');
                  setShowInfoModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Text style={styles.infoButtonText}>?</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              value={initialKitap}
              onChangeText={setInitialKitap}
              placeholder="Kitap sayısı"
              placeholderTextColor="#8E97A8"
              keyboardType="numeric"
              editable={!isRunning}
            />
          </View>
        </View>

        {/* Mod Seçimi ve Sayaç */}
        <View style={styles.card}>
          <Text style={styles.eventName}>⏱️ Farm Süresi</Text>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === '1hour' && styles.modeButtonActive]}
              onPress={() => !isRunning && setMode('1hour')}
            >
              <Text style={[styles.modeButtonText, mode === '1hour' && styles.modeButtonTextActive]}>
                1 Saatlik
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'unlimited' && styles.modeButtonActive]}
              onPress={() => !isRunning && setMode('unlimited')}
            >
              <Text style={[styles.modeButtonText, mode === 'unlimited' && styles.modeButtonTextActive]}>
                Süresiz
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sayaç */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
            <Text style={styles.timerLabel}>
              {mode === '1hour' ? '1 Saatlik Farm (Geri Sayım)' : 'Süresiz Farm (İleri Sayım)'}
            </Text>
          </View>

          {/* Kontrol Butonları */}
          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, styles.startButton, isRunning && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={isRunning}
            >
              <Text style={styles.controlButtonText}>▶️ Başla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton, !isRunning && styles.buttonDisabled]}
              onPress={handleStop}
              disabled={!isRunning}
            >
              <Text style={styles.controlButtonText}>⏸️ Durdur</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.controlButton, styles.resetButton]}
              onPress={handleReset}
            >
              <Text style={styles.controlButtonText}>🔄 Sıfırla</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sonuç Modal */}
        <Modal
          visible={showResultModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowResultModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>📊 Farm Sonuçları</Text>
              <Text style={styles.modalSubtitle}>
                Geçen Süre: {formatTime(elapsedTime)}
              </Text>

              <ScrollView style={styles.modalScroll}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Bitiş Coins</Text>
                  <TextInput
                    style={styles.input}
                    value={finalCoins}
                    onChangeText={setFinalCoins}
                    placeholder="Kalan coins"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Bitiş Pot Sayısı</Text>
                  <TextInput
                    style={styles.input}
                    value={finalPot}
                    onChangeText={setFinalPot}
                    placeholder="Kalan pot sayısı"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Bitiş Mana</Text>
                  <TextInput
                    style={styles.input}
                    value={finalMana}
                    onChangeText={setFinalMana}
                    placeholder="Kalan mana"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Bitiş Wolf Sayısı</Text>
                  <TextInput
                    style={styles.input}
                    value={finalWolf}
                    onChangeText={setFinalWolf}
                    placeholder="Kalan wolf sayısı"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Bitiş Kitap Sayısı</Text>
                  <TextInput
                    style={styles.input}
                    value={finalKitap}
                    onChangeText={setFinalKitap}
                    placeholder="Kalan kitap sayısı"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.inputLabel}>Bus Sayısı</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => {
                        setInfoText('Bus: 2.200.000 coins');
                        setShowInfoModal(true);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.infoButtonText}>?</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={busCount}
                    onChangeText={setBusCount}
                    placeholder="Bus sayısı"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <View style={styles.labelWithInfo}>
                    <Text style={styles.inputLabel}>Bes Sayısı</Text>
                    <TouchableOpacity 
                      style={styles.infoButton}
                      onPress={() => {
                        setInfoText('Bes: 1.000.000 coins');
                        setShowInfoModal(true);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.infoButtonText}>?</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={besCount}
                    onChangeText={setBesCount}
                    placeholder="Bes sayısı"
                    placeholderTextColor="#8E97A8"
                    keyboardType="numeric"
                  />
                </View>

                {calculationResult && (
                  <View style={styles.resultContainer}>
                    <Text style={styles.resultTitle}>💰 Hesaplama Sonuçları</Text>
                    
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Kullanılan Pot:</Text>
                      <Text style={styles.resultValue}>{calculationResult.usedPot} adet</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Pot Masrafı:</Text>
                      <Text style={styles.resultValue}>{calculationResult.potCost.toLocaleString()} coins</Text>
                    </View>

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Kullanılan Mana:</Text>
                      <Text style={styles.resultValue}>{calculationResult.usedMana} adet</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Mana Masrafı:</Text>
                      <Text style={styles.resultValue}>{calculationResult.manaCost.toLocaleString()} coins</Text>
                    </View>

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Kullanılan Wolf:</Text>
                      <Text style={styles.resultValue}>{calculationResult.usedWolf} adet</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Wolf Masrafı:</Text>
                      <Text style={styles.resultValue}>{calculationResult.wolfCost.toLocaleString()} coins</Text>
                    </View>

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Kullanılan Kitap:</Text>
                      <Text style={styles.resultValue}>{calculationResult.usedKitap} adet</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Kitap Masrafı:</Text>
                      <Text style={styles.resultValue}>{calculationResult.kitapCost.toLocaleString()} coins</Text>
                    </View>

                    <View style={styles.resultDivider} />

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Toplam Masraf:</Text>
                      <Text style={[styles.resultValue, styles.resultValueNegative]}>
                        {calculationResult.totalCost.toLocaleString()} coins
                      </Text>
                    </View>

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Bus Değeri:</Text>
                      <Text style={styles.resultValue}>{calculationResult.busValue.toLocaleString()} coins</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Bes Değeri:</Text>
                      <Text style={styles.resultValue}>{calculationResult.besValue.toLocaleString()} coins</Text>
                    </View>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Toplam Gelir:</Text>
                      <Text style={[styles.resultValue, styles.resultValuePositive]}>
                        {calculationResult.totalIncome.toLocaleString()} coins
                      </Text>
                    </View>

                    <View style={styles.resultDivider} />

                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Net Kar/Zarar:</Text>
                      <Text style={[
                        styles.resultValue,
                        calculationResult.netProfit >= 0 ? styles.resultValuePositive : styles.resultValueNegative,
                        styles.resultValueLarge
                      ]}>
                        {calculationResult.netProfit >= 0 ? '+' : ''}{calculationResult.netProfit.toLocaleString()} coins
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.calculateButton}
                  onPress={handleCalculate}
                >
                  <Text style={styles.calculateButtonText}>🧮 Hesapla</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowResultModal(false)}
                >
                  <Text style={styles.closeButtonText}>Kapat</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Açıklama Modal */}
        <Modal
          visible={showInfoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <View style={styles.infoModalOverlay}>
            <View style={styles.infoModalContent}>
              <Text style={styles.infoModalText}>{infoText}</Text>
              <TouchableOpacity
                style={styles.infoModalCloseButton}
                onPress={() => setShowInfoModal(false)}
              >
                <Text style={styles.infoModalCloseButtonText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
};

// Levele Göre Exp Bileşeni
const ALSkillStatScreen = () => {
  const expData = [
    { level: 1, exp: 50 },
    { level: 2, exp: 100 },
    { level: 3, exp: 190 },
    { level: 4, exp: 342 },
    { level: 5, exp: 581 },
    { level: 6, exp: 929 },
    { level: 7, exp: 1393 },
    { level: 8, exp: 1950 },
    { level: 9, exp: 2535 },
    { level: 10, exp: 5070 },
    { level: 11, exp: 6084 },
    { level: 12, exp: 7300 },
    { level: 13, exp: 8760 },
    { level: 14, exp: 10512 },
    { level: 15, exp: 12612 },
    { level: 16, exp: 15136 },
    { level: 17, exp: 18163 },
    { level: 18, exp: 21795 },
    { level: 19, exp: 26154 },
    { level: 20, exp: 52308 },
    { level: 21, exp: 60154 },
    { level: 22, exp: 69177 },
    { level: 23, exp: 79553 },
    { level: 24, exp: 91485 },
    { level: 25, exp: 105207 },
    { level: 26, exp: 120988 },
    { level: 27, exp: 139136 },
    { level: 28, exp: 160006 },
    { level: 29, exp: 184006 },
    { level: 30, exp: 368012 },
    { level: 31, exp: 404813 },
    { level: 32, exp: 445294 },
    { level: 33, exp: 489823 },
    { level: 34, exp: 538805 },
    { level: 35, exp: 808207 },
    { level: 36, exp: 889027 },
    { level: 37, exp: 977929 },
    { level: 38, exp: 1075721 },
    { level: 39, exp: 1183293 },
    { level: 40, exp: 2366586 },
    { level: 41, exp: 2603244 },
    { level: 42, exp: 2863568 },
    { level: 43, exp: 3149924 },
    { level: 44, exp: 3464916 },
    { level: 45, exp: 5197374 },
    { level: 46, exp: 5717111 },
    { level: 47, exp: 6288822 },
    { level: 48, exp: 6917704 },
    { level: 49, exp: 7609474 },
    { level: 50, exp: 15218948 },
    { level: 51, exp: 16740842 },
    { level: 52, exp: 18414926 },
    { level: 53, exp: 20256418 },
    { level: 54, exp: 22282059 },
    { level: 55, exp: 33423088 },
    { level: 56, exp: 36765396 },
    { level: 57, exp: 40441935 },
    { level: 58, exp: 44486128 },
    { level: 59, exp: 48934740 },
    { level: 60, exp: 73402110 },
    { level: 61, exp: 132123798 },
    { level: 62, exp: 145336177 },
    { level: 63, exp: 159869794 },
    { level: 64, exp: 175856773 },
    { level: 65, exp: 193442450 },
    { level: 66, exp: 212786695 },
    { level: 67, exp: 234065364 },
    { level: 68, exp: 257471900 },
    { level: 69, exp: 293219090 },
    { level: 70, exp: 311540999 },
    { level: 71, exp: 373849198 },
    { level: 72, exp: 453852927 },
    { level: 73, exp: 550977453 },
    { level: 74, exp: 668886628 },
    { level: 75, exp: 812028367 },
    { level: 76, exp: 985802438 },
    { level: 77, exp: 1196764159 },
    { level: 78, exp: 1452871690 },
    { level: 79, exp: 1763786231 },
    { level: 80, exp: 2141236485 },
    { level: 81, exp: 4317589248 },
    { level: 82, exp: 6130976733 },
    { level: 83, exp: 8705986960 },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>📈 Levele Göre Exp</Text>
        <Text style={styles.sectionDescription}>
          Seviye bazlı deneyim (exp) miktarları
        </Text>

        <View style={styles.card}>
          <Text style={styles.eventName}>Levele Göre Exp Tablosu</Text>
          
          {/* Tablo Başlığı */}
          <View style={styles.expTableHeader}>
            <Text style={[styles.expTableHeaderText, { flex: 1 }]}>Seviye</Text>
            <Text style={[styles.expTableHeaderText, { flex: 2 }]}>Exp Miktarı</Text>
          </View>

          {/* Tablo İçeriği - Alt alta sıralı */}
          {expData.map((item, index) => (
            <View key={index} style={[
              styles.expTableRow,
              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
            ]}>
              <Text style={[styles.expTableCell, { flex: 1, fontWeight: 'bold' }]}>
                {item.level}
              </Text>
              <Text style={[styles.expTableCell, { flex: 2 }]}>
                {item.exp.toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

// Achievements Bileşeni
const AchievementsScreen = () => {
  const [selectedFilter, setSelectedFilter] = useState('Tümü');

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
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>🏆 Achievements</Text>
        <Text style={styles.sectionDescription}>
          Knight Online başarımları ve ödülleri
        </Text>

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

// Master Bileşeni
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
              <Text style={[styles.tableHeaderText, {flex: 1, fontSize: 11}]}>1 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1, fontSize: 11}]}>2 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1, fontSize: 11}]}>3 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1, fontSize: 11}]}>4 Spell Stone Powder</Text>
              <Text style={[styles.tableHeaderText, {flex: 1, fontSize: 11}]}>5 Spell Stone Powder</Text>
            </View>
            
            {sokmeSanslari.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <Text style={[styles.tableCell, {flex: 2, fontWeight: 'bold'}]}>{item.aksesuar}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik1}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik2}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik3}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik4}</Text>
                <Text style={[styles.tableCell, {flex: 1, color: '#FDB022'}]}>{item.olasilik5}</Text>
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

// Knight Online Monster Bileşeni
const MonsterScreen = () => {
  const [selectedZone, setSelectedZone] = useState('Tümü');
  const [searchQuery, setSearchQuery] = useState('');

  // Ham monster verisi (tab-separated format)
  const rawMonsterData = `Centaur	Hell Abyss	305	327	50	19204	1134	90	455	655	455
Centaur	Hell Abyss	281	302	50	19204	1134	90	455	655	455
Centaur	Hell Abyss	324	345	50	19204	1134	90	455	655	455
Centaur	Hell Abyss	283	302	50	19204	1134	90	455	655	455
Centaur	Hell Abyss	330	346	50	19204	1134	90	455	655	455
Flame Rock	Hell Abyss	415	435	50	16615	720	100	25	25	25
Flame Rock	Hell Abyss	453	470	50	16615	720	100	25	25	25
Flame Rock	Hell Abyss	453	468	50	16615	720	100	25	25	25
Flame Rock	Hell Abyss	417	439	50	16615	720	100	25	25	25
gloom hound	Hell Abyss	168	213	30	5247	316	55	150	150	150
GOBLIN bouncer	Hell Abyss	331	342	30	1601	303	45	130	130	130
GOBLIN bouncer	Hell Abyss	283	298	30	1601	303	45	130	130	130
GOBLIN bouncer	Hell Abyss	295	333	30	1601	303	45	130	130	130
GOBLIN bouncer	Hell Abyss	323	342	30	1601	303	45	130	130	130
GOBLIN bouncer	Hell Abyss	291	311	30	1601	303	45	130	130	130
Hell Fire	Ronark Land	975	975	?	165451	2547	75	555	555	555
Hell Fire	Ronark Land	1692	1692	20	165451	2547	75	555	555	555
Hell Fire	Ronark Land	357	357	?	165451	2547	75	555	555	555
Hell Fire	Ronark Land	1082	1082	?	165451	2547	75	555	555	555
Hell hound	Luferson Castle	114	136	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	159	183	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	109	136	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	147	173	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	103	126	45	10000	299	52	2000	2000	2000
Hell hound	El Morad Castle	1924	1945	45	10000	299	52	2000	2000	2000
Hell hound	El Morad Castle	1924	1945	45	10000	299	52	2000	2000	2000
Hell hound	El Morad Castle	1926	1951	45	10000	299	52	2000	2000	2000
Hell hound	El Morad Castle	1880	1902	45	10000	299	52	2000	2000	2000
Hell hound	El Morad Castle	1920	1939	45	10000	299	52	2000	2000	2000
HOBGOBLIN	Hell Abyss	331	342	50	6709	607	71	158	158	158
HOBGOBLIN	Hell Abyss	309	323	50	6709	607	71	158	158	158
HOBGOBLIN	Hell Abyss	293	304	50	6709	607	71	158	158	158
HOBGOBLIN	Hell Abyss	301	328	50	6709	607	71	158	158	158
Isiloon	Hell Abyss	413	476	32000	1300015	3555	170	1200	1200	1200
Lutterslan	Hell Abyss	42	87	30	1108	204	30	27	27	27
Lutterslan	Hell Abyss	40	86	30	1108	204	30	27	27	27
Lutterslan	Hell Abyss	27	90	30	1108	204	30	27	27	27
Lutterslan	Hell Abyss	45	88	30	1108	204	30	27	27	27
Lutterslan	Hell Abyss	36	47	30	1108	204	30	27	27	27
Manticore	Hell Abyss	321	332	50	12551	994	85	355	355	355
Manticore	Hell Abyss	292	312	50	12551	994	85	355	355	355
Manticore	Hell Abyss	325	342	50	12551	994	85	355	355	355
Manticore	Hell Abyss	336	355	50	12551	994	85	355	355	355
Manticore	Hell Abyss	279	296	50	12551	994	85	355	355	355
Orc bandit	Hell Abyss	62	64	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	61	63	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	188	190	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	443	445	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	443	445	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	314	316	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	61	63	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	188	190	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	61	63	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	188	190	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	188	190	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	443	445	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	314	316	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	443	445	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	314	316	30	780	154	10	25	25	50
Orc bandit	Hell Abyss	314	316	30	780	154	10	25	25	50
Orc mage	Hell Abyss	74	79	30	912	288	40	178	119	63
Orc mage	Hell Abyss	32	37	30	912	288	40	178	119	63
Orc mage	Hell Abyss	93	98	30	912	288	40	178	119	63
Orc mage	Hell Abyss	49	76	30	912	288	40	178	119	63
Orc mage	Hell Abyss	77	82	30	912	288	40	178	119	63
Orc Watcher	Hell Abyss	42	84	30	318	240	30	91	91	49
Orc Watcher	Hell Abyss	42	88	30	318	240	30	91	91	49
Orc Watcher	Hell Abyss	47	79	30	318	240	30	91	91	49
Orc Watcher	Hell Abyss	28	45	30	318	240	30	91	91	49
Servant of Isiloon	Hell Abyss	450	480	50	33999	1345	130	25	25	25
Servant of Isiloon	Hell Abyss	411	449	50	33999	1345	130	25	25	25
Servant of Isiloon	Hell Abyss	425	458	50	33999	1345	130	25	25	25
Servant of Isiloon	Hell Abyss	435	452	50	33999	1345	130	950	950	950
Servant of Isiloon	Hell Abyss	412	428	50	33999	1345	130	950	950	950
Servant of Isiloon	Hell Abyss	431	455	50	33999	1345	130	950	950	950
Servant of Isiloon	Hell Abyss	457	478	50	33999	1345	130	950	950	950
Servant of Isiloon	Hell Abyss	455	471	50	33999	1345	130	25	25	25
Servant of Isiloon	Hell Abyss	421	436	50	33999	1345	130	25	25	25
Wraith	Hell Abyss	175	205	30	4452	585	65	250	250	250
Wraith	Hell Abyss	176	209	30	4452	585	65	250	250	250
Wraith	Hell Abyss	175	207	30	4452	585	65	250	250	250
Wraith	Hell Abyss	162	171	30	4452	585	65	250	250	250
Wraith	Hell Abyss	207	220	30	4452	585	65	250	250	250
Wraith	Hell Abyss	162	177	30	4452	585	65	250	250	250
Wraith	Hell Abyss	173	202	30	4452	585	65	250	250	250
Wraith	Hell Abyss	202	219	30	4452	585	65	250	250	250
Black widow	Desperation Abyss	155	166	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	128	136	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	144	154	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	158	168	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	133	142	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	163	172	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	145	154	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	135	143	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	131	143	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	156	166	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	138	146	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	155	162	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	119	127	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	136	144	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	158	165	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	134	143	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	145	156	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	159	168	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	167	176	30	1932	360	40	120	120	120
Black widow	Desperation Abyss	145	157	30	1932	360	40	120	120	120
burning skeleton	Desperation Abyss	340	361	30	4000	410	57	25	79	79
burning skeleton	Desperation Abyss	361	370	30	4000	410	57	25	79	79
burning skeleton	Desperation Abyss	331	340	30	4000	410	57	25	79	79
burning skeleton	Desperation Abyss	329	369	30	4000	410	57	25	79	79
Cave leech	Desperation Abyss	45	56	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	56	68	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	55	70	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	27	42	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	47	57	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	30	43	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	67	75	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	24	32	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	31	71	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	43	55	32	215	107	20	90	90	90
Cave leech	Desperation Abyss	35	64	32	215	107	20	90	90	90
fallen Angel	Desperation Abyss	434	464	40	20000	1440	80	25	25	255
Ghost warrior	Desperation Abyss	360	368	30	5000	468	60	300	300	300
Ghost warrior	Desperation Abyss	341	355	30	5000	468	60	300	300	300
Ghost warrior	Desperation Abyss	331	340	30	5000	468	60	300	300	300
Ghost warrior	Desperation Abyss	459	469	30	5000	468	60	300	300	300
Ghost warrior	Desperation Abyss	428	441	30	5000	468	60	300	300	300
Ghost warrior	Desperation Abyss	438	461	30	5000	468	60	300	300	300
gloom hound	Desperation Abyss	257	263	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	264	272	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	228	236	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	245	255	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	234	250	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	259	265	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	229	237	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	264	273	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	242	255	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	243	255	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	232	240	30	5247	316	55	150	150	150
gloom hound	Desperation Abyss	251	255	30	5247	316	55	150	150	150
Orc bandit	Desperation Abyss	49	50	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	249	250	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	49	50	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	349	350	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	49	50	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	150	150	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	50	51	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	249	250	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	349	350	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	349	350	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	349	350	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	449	450	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	449	450	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	449	450	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	450	451	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	149	150	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	150	151	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	150	151	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	249	250	10000	780	154	10	25	25	50
Orc bandit	Desperation Abyss	249	250	10000	780	154	10	25	25	50
Orc bandit archer	Desperation Abyss	423	424	10000	18	20	10	10	50	50
Phantom	Desperation Abyss	333	364	30	3500	432	60	180	180	180
Reaper	Desperation Abyss	434	461	40	7000	612	65	159	159	25
Shadow	Desperation Abyss	128	137	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	160	167	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	158	164	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	137	156	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	129	138	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	159	166	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	149	155	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	260	268	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	261	271	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	228	238	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	275	279	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	219	224	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	231	239	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	262	272	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	171	179	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	137	142	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	228	234	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	235	239	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	247	254	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	258	264	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	246	251	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	146	160	30	5000	345	48	120	250	250
Shadow	Desperation Abyss	136	144	30	5000	345	48	120	250	250
Solid Bin	Desperation Abyss	161	171	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	159	168	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	128	139	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	145	157	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	157	169	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	144	155	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	131	143	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	132	143	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	65	75	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	42	47	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	39	59	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	59	67	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	32	45	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	25	34	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	52	58	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	136	144	30	1500	345	38	50	50	50
Solid Bin	Desperation Abyss	155	162	30	1500	345	38	50	50	50
Bandicoot	Moradon	603	620	30	11	10	2	10	10	10
Bandicoot	Moradon	632	649	30	11	10	2	10	10	10
Battalion	Moradon	283	300	30	769	233	27	42	75	42
Battalion	Moradon	305	322	30	769	233	27	42	75	42
Bulcan	Moradon	535	552	30	99	57	11	26	26	26
Bulcan	Moradon	535	552	30	99	57	11	26	26	26
Bulture	Moradon	443	460	30	265	98	19	39	39	39
Bulture	Moradon	457	474	30	265	98	19	39	39	39
Dark eyes	Moradon	502	519	30	1193	210	31	46	46	46
Dark eyes	Moradon	477	494	30	1193	210	31	46	46	46
Death knight	Moradon	155	172	30	2846	324	45	63	121	63
Death knight	Moradon	153	170	30	2846	324	45	63	121	63
Death knight	Moradon	156	173	30	2846	324	45	63	121	63
Death knight	Moradon	191	208	30	2846	324	45	63	121	63
Death knight	Moradon	61	63	30	2846	324	45	63	121	63
Death knight	Moradon	60	61	30	2846	324	45	63	121	63
Death knight	Moradon	71	73	30	2846	324	45	63	121	63
Death knight	Moradon	76	77	30	2846	324	45	63	121	63
Death knight	Moradon	82	84	30	2846	324	45	63	121	63
Death knight	Moradon	91	93	30	2846	324	45	63	121	63
Death knight	Moradon	75	76	30	2846	324	45	63	121	63
Death knight	Moradon	88	89	30	2846	324	45	63	121	63
Dire wolf	Moradon	549	566	30	1373	224	33	49	49	49
Dire wolf	Moradon	522	539	30	1373	224	33	49	49	49
Gavolt	Moradon	577	594	30	190	83	16	34	34	34
Gavolt	Moradon	566	583	30	190	83	16	34	34	34
Giant bulcan	Moradon	414	431	30	214	88	17	36	36	36
Giant bulcan	Moradon	382	399	30	214	88	17	36	36	36
Giant gavolt	Moradon	534	551	30	238	93	18	38	38	38
Giant gavolt	Moradon	546	563	30	238	93	18	38	38	38
Gloomwing	Moradon	464	481	30	512	138	24	38	38	38
Gloomwing	Moradon	483	500	30	512	138	24	38	38	38
Glyptodont	Moradon	586	603	30	2206	462	34	50	50	50
Glyptodont	Moradon	559	576	30	2206	462	34	50	50	50
Kecoon	Moradon	597	614	30	32	31	6	18	18	18
Kecoon captain	Moradon	628	645	30	352	138	20	42	42	42
Kecoon captain	Moradon	658	675	30	352	138	20	42	42	42
Kecoon warrior	Moradon	602	619	30	190	83	16	34	34	34
Kecoon warrior	Moradon	627	644	30	190	83	16	34	34	34
Keilan	Moradon	338	355	30	13420	208	40	32	32	32
Keilan	Moradon	341	358	30	13420	208	40	32	32	32
Lard Orc	Moradon	231	232	30	1058	360	50	147	147	77
Lard Orc	Moradon	239	240	30	1058	360	50	147	147	77
Lard Orc	Moradon	224	225	30	1058	360	50	147	147	77
Loup-garou	Moradon	502	519	30	879	155	27	42	42	42
Loup-garou	Moradon	534	551	30	879	155	27	42	42	42
Lycan	Moradon	457	474	30	745	144	25	38	38	38
Lycan	Moradon	479	496	30	745	144	25	38	38	38
Orc Watcher	Moradon	323	340	30	318	240	30	91	91	49
Orc Watcher	Moradon	328	345	30	318	240	30	91	91	49
paralyzer	Moradon	406	423	30	1121	326	32	48	48	48
paralyzer	Moradon	402	419	30	1121	326	32	48	48	48
Pincers scorpion	Moradon	409	426	30	970	306	30	45	45	45
Pincers scorpion	Moradon	408	425	30	970	306	30	45	45	45
Rotten Eyes	Moradon	348	365	30	970	306	30	45	84	45
Rotten Eyes	Moradon	351	368	30	970	306	30	45	84	45
saber tooth	Moradon	797	797	30	1992	236	41	69	69	58
saber tooth	Moradon	310	327	30	1992	236	41	69	69	58
saber tooth	Moradon	242	259	30	1992	236	41	69	69	58
Scavenger Bandicoot	Moradon	590	607	30	40	36	7	19	19	19
Scavenger Bandicoot	Moradon	615	632	30	40	36	7	19	19	19
Scorpion	Moradon	403	420	30	709	224	26	40	40	40
Scorpion	Moradon	394	411	30	709	224	26	40	40	40
Shadow seeker	Moradon	565	582	30	1028	167	29	44	44	44
Shadow seeker	Moradon	538	555	30	1028	167	29	44	44	44
silan	Moradon	415	432	30	705	104	20	22	22	22
silan	Moradon	385	402	30	705	104	20	22	22	22
Skeleton	Moradon	112	113	30	1193	210	31	46	86	46
Skeleton	Moradon	138	139	30	1193	210	31	46	86	46
Skeleton	Moradon	141	142	30	1193	210	31	46	86	46
Skeleton	Moradon	140	141	30	1193	210	31	46	86	46
Skeleton	Moradon	117	118	30	1193	210	31	46	86	46
Skeleton	Moradon	373	390	30	1193	210	31	46	86	46
Skeleton	Moradon	349	366	30	1193	210	31	46	86	46
Skeleton	Moradon	121	122	30	1193	210	31	46	86	46
Skeleton warrior	Moradon	85	86	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	77	78	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	97	98	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	106	107	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	114	115	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	110	111	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	107	108	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	97	98	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	103	104	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	108	109	30	1373	224	33	49	91	49
Skeleton warrior	Moradon	94	95	30	1373	224	33	49	91	49
Smilodon	Moradon	488	505	30	1564	201	37	63	63	54
Smilodon	Moradon	454	471	30	1564	201	37	63	63	54
Smilodon	Moradon	52	53	30	1564	201	37	63	63	54
Smilodon	Moradon	40	41	30	1564	201	37	63	63	54
Smilodon	Moradon	36	37	30	1564	201	37	63	63	54
spoiler	Moradon	429	446	30	428	126	22	36	36	36
spoiler	Moradon	434	451	30	428	126	22	36	36	36
Stegodon	Moradon	185	202	30	2854	516	38	55	55	55
undying	Moradon	312	329	30	1202	336	33	49	91	49
undying	Moradon	287	304	30	1202	336	33	49	91	49
Werewolf	Moradon	410	427	30	625	132	23	36	36	36
Werewolf	Moradon	385	402	30	625	132	23	36	36	36
Wild bulcan	Moradon	506	523	30	131	67	13	30	30	30
Wild bulcan	Moradon	502	519	30	131	67	13	30	30	30
Wild smilodon	Moradon	315	316	30	1769	212	39	67	67	56
Wild smilodon	Moradon	326	327	30	1769	212	39	67	67	56
Wild smilodon	Moradon	340	341	30	1769	212	39	67	67	56
Wild smilodon	Moradon	349	350	30	1769	212	39	67	67	56
Wild smilodon	Moradon	360	361	30	1769	212	39	67	67	56
Wild smilodon	Moradon	369	370	30	1769	212	39	67	67	56
Wild smilodon	Moradon	452	469	30	1769	212	39	67	67	56
Wild smilodon	Moradon	478	495	30	1769	212	39	67	67	56
Wild smilodon	Moradon	290	291	30	1769	212	39	67	67	56
Wild smilodon	Moradon	298	299	30	1769	212	39	67	67	56
Wild smilodon	Moradon	309	310	30	1769	212	39	67	67	56
Worm	Moradon	624	641	30	7	5	1	9	9	9
Worm	Moradon	637	654	30	7	5	1	9	9	9
Worm	Moradon	657	657	30	7	5	1	9	9	9
Worm	Moradon	653	655	30	7	5	1	9	9	9
Worm	Moradon	649	649	30	7	5	1	9	9	9
[Quest] Apostle	Karus Eslant	864	870	150	120233	5000	150	170	170	170
[Quest] Giant golem	El Morad Eslant	105	113	150	120533	3628	160	1200	1200	1200
[Quest] Lard Orc	El Morad Eslant	508	520	150	120233	5000	150	170	170	170
[Quest] Stone Golem	Karus Eslant	96	102	150	120233	5000	150	170	170	170
[Quest] Troll Berserker	Karus Eslant	783	790	150	120233	5000	150	170	170	170
[Quest] Troll Captain	El Morad Eslant	757	768	150	120533	3628	160	1200	1200	1200
[Quest] Uruk Hai	Karus Eslant	388	393	150	120233	5000	150	170	170	170
[Quest] Uruk Tron	El Morad Eslant	701	713	150	120533	3628	160	1200	1200	1200
Apostle	El Morad Eslant	575	620	30	21556	315	70	200	200	200
Apostle	Karus Eslant	573	616	30	21556	315	70	200	200	200
Apostle of Flames	El Morad Eslant	784	829	50	46556	1000	70	100	100	100
Apostle of Flames	El Morad Eslant	861	907	50	46556	1000	70	100	100	100
Apostle of Flames	Karus Eslant	804	849	50	46556	1000	70	100	100	100
Apostle of Flames	Karus Eslant	867	911	50	46556	1000	70	100	100	100
Apostle of Piercing Cold	El Morad Eslant	613	657	50	42556	1000	70	100	100	100
Apostle of Piercing Cold	El Morad Eslant	680	719	50	42556	1000	70	100	100	100
Apostle of Piercing Cold	Karus Eslant	607	658	50	42556	1000	70	100	100	100
Apostle of Piercing Cold	Karus Eslant	675	718	50	42556	1000	70	100	100	100
Balrog	El Morad Eslant	929	940	60	81775	2000	100	120	120	120
Balrog	El Morad Eslant	894	907	60	81775	2000	100	120	120	120
Balrog	Karus Eslant	944	952	60	81775	2000	100	120	120	120
Balrog	Karus Eslant	934	942	60	81775	2000	100	120	120	120
Balrog	Karus Eslant	929	938	60	81775	2000	100	120	120	120
Balrog	Karus Eslant	952	962	60	81775	2000	100	120	120	120
Balrog	El Morad Eslant	940	951	60	81775	2000	100	120	120	120
Balrog	El Morad Eslant	926	938	60	81775	2000	100	120	120	120
Bearded Ruminant	El Morad Eslant	784	793	60	55005	2115	110	150	150	150
Bearded Ruminant	El Morad Eslant	811	822	60	55005	2115	110	150	150	150
Bearded Ruminant	El Morad Eslant	848	860	60	55005	2115	110	150	150	150
Bearded Ruminant	El Morad Eslant	881	891	60	55005	2115	110	150	150	150
Bearded Ruminant	Karus Eslant	795	806	60	55005	2115	110	150	150	150
Bearded Ruminant	Karus Eslant	828	840	60	55005	2115	110	150	150	150
Bearded Ruminant	Karus Eslant	870	882	60	55005	2115	110	150	150	150
Bearded Ruminant	Karus Eslant	894	906	60	55005	2115	110	150	150	150
Brahman	El Morad Eslant	594	633	30	38190	432	80	28	25	255
Brahman	El Morad Eslant	593	638	30	38190	432	80	28	25	255
Brahman	Karus Eslant	599	644	30	38190	432	80	28	25	255
Brahman	Karus Eslant	591	636	30	38190	432	80	28	25	255
Crimson Wing	El Morad Eslant	113	168	60	43835	810	90	200	200	154
Crimson Wing	El Morad Eslant	398	429	60	43835	810	90	200	200	154
Crimson Wing	El Morad Eslant	375	416	60	43835	810	90	200	200	154
Crimson Wing	El Morad Eslant	105	138	60	43835	810	90	200	200	154
Crimson Wing	Karus Eslant	396	425	60	43835	810	90	200	200	154
Crimson Wing	Karus Eslant	358	412	60	43835	810	90	200	200	154
Crimson Wing	Karus Eslant	116	168	60	43835	810	90	200	200	154
Crimson Wing	Karus Eslant	105	139	60	43835	810	90	200	200	154
Dark Knight	El Morad Eslant	382	409	50	88014	535	70	50	50	300
Dark Knight	El Morad Eslant	79	128	50	88014	535	70	50	50	300
Dark Knight	El Morad Eslant	67	123	50	88014	535	70	50	50	300
Dark Knight	El Morad Eslant	311	370	50	88014	535	70	50	50	300
Dark Knight	Karus Eslant	92	134	50	88014	535	70	50	50	300
Dark Knight	Karus Eslant	352	399	50	88014	535	70	50	50	300
Dark Knight	Karus Eslant	84	123	50	88014	535	70	50	50	300
Dark Knight	Karus Eslant	290	338	50	88014	535	70	50	50	300
Dark stone	El Morad Eslant	77	120	60	17000	1600	120	25	25	255
Dark stone	El Morad Eslant	149	200	60	17000	1600	120	25	25	255
Dark stone	El Morad Eslant	157	180	30	17000	1600	120	25	25	255
Dark stone	Karus Eslant	76	115	30	17000	1600	120	25	25	255
Dark stone	Karus Eslant	123	173	30	17000	1600	120	25	25	255
Deruvish founder	El Morad Eslant	837	930	32000	150000	900	100	25	25	255
Deruvish founder	El Morad Eslant	566	892	32000	150000	900	100	25	25	255
Deruvish founder	El Morad Eslant	757	859	32000	150000	900	100	25	25	255
Deruvish founder	El Morad Eslant	583	658	32000	150000	900	100	25	25	255
Deruvish founder	El Morad Eslant	231	273	32000	150000	900	100	25	25	255
Deruvish founder	El Morad Eslant	217	238	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	231	273	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	837	930	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	217	238	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	583	658	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	566	892	32000	150000	900	100	25	25	255
Deruvish founder	Karus Eslant	757	859	32000	150000	900	100	25	25	255
Doom Soldier	El Morad Eslant	255	287	30	45845	500	70	120	120	100
Doom Soldier	El Morad Eslant	332	382	30	45845	500	70	120	120	100
Doom Soldier	Karus Eslant	331	378	30	45845	500	70	120	120	100
Doom Soldier	Karus Eslant	270	304	35	45845	500	70	120	120	100
Dragon tooth	El Morad Eslant	782	834	32000	76380	1152	80	25	25	255
Dragon tooth	El Morad Eslant	164	202	32000	76380	1152	80	25	25	255
Dragon tooth	El Morad Eslant	112	149	32000	76380	1152	80	25	25	255
Dragon tooth	El Morad Eslant	640	708	32000	76380	1152	80	25	25	255
Dragon tooth	Karus Eslant	164	202	32000	76380	1152	80	500	500	500
Dragon tooth	Karus Eslant	782	834	32000	76380	1152	80	500	500	500
Dragon tooth	Karus Eslant	112	149	32000	76380	1152	80	500	500	500
Dragon tooth	Karus Eslant	640	708	32000	76380	1152	80	500	500	500
Dragon Tooth commander	El Morad Eslant	425	469	45	10557	501	68	70	500	130
Dragon Tooth commander	Karus Eslant	412	479	45	10557	501	68	70	500	130
Falcon	El Morad Eslant	122	158	60	66460	990	100	250	250	154
Falcon	El Morad Eslant	217	266	60	66460	990	100	250	250	154
Falcon	El Morad Eslant	274	324	60	66460	990	100	250	250	154
Falcon	Karus Eslant	125	157	60	66460	990	100	250	250	154
Falcon	Karus Eslant	181	227	60	66460	990	100	250	250	154
Falcon	Karus Eslant	281	321	60	66460	990	100	250	250	154
Falcon	Karus Eslant	227	243	60	66460	990	100	250	250	154
Gagoil	El Morad Eslant	228	286	40	43457	1250	70	150	150	150
Gagoil	Karus Eslant	228	289	40	43457	1250	70	150	150	150
Giant golem	El Morad Eslant	830	882	30	14000	990	110	25	25	255
Giant golem	El Morad Eslant	766	810	25	14000	990	110	25	25	255
Giant golem	Karus Eslant	806	843	25	14000	990	110	25	25	255
Giant golem	Karus Eslant	865	902	30	14000	990	110	25	25	255
Harpy	El Morad Eslant	420	458	30	16167	529	70	50	50	50
Harpy	Karus Eslant	432	483	40	16167	529	70	50	50	50
Harpy Queen	El Morad Eslant	848	932	32000	179998	1188	110	25	25	154
Harpy Queen	El Morad Eslant	106	130	32000	179998	1188	110	25	25	154
Harpy Queen	El Morad Eslant	118	168	32000	179998	1188	110	25	25	154
Harpy Queen	El Morad Eslant	562	623	32000	179998	1188	110	25	25	154
Harpy Queen	Karus Eslant	848	932	32000	179998	1188	110	25	25	154
Harpy Queen	Karus Eslant	118	168	32000	179998	1188	110	25	25	154
Harpy Queen	Karus Eslant	562	623	32000	179998	1188	110	25	25	154
Harpy Queen	Karus Eslant	106	130	32000	179998	1188	110	25	25	154
Paramun	El Morad Eslant	724	789	30	62622	567	90	25	25	255
Paramun	El Morad Eslant	661	705	30	62622	567	90	25	25	255
Paramun	Karus Eslant	737	789	30	62622	567	90	25	25	255
Paramun	Karus Eslant	660	704	30	62622	567	90	25	25	255
Raven Harpy	El Morad Eslant	333	369	60	27496	648	80	150	150	154
Raven Harpy	El Morad Eslant	398	436	50	27496	648	80	150	150	154
Raven Harpy	El Morad Eslant	392	430	60	27496	648	80	150	150	154
Raven Harpy	El Morad Eslant	246	303	60	27496	648	80	150	150	154
Raven Harpy	Karus Eslant	391	432	60	27496	648	80	150	150	154
Raven Harpy	Karus Eslant	316	365	60	27496	648	80	150	150	154
Raven Harpy	Karus Eslant	388	430	50	27496	648	80	150	150	154
Raven Harpy	Karus Eslant	237	289	60	27496	648	80	150	150	154
Samma	El Morad Eslant	109	132	32000	104370	1296	90	500	500	500
Samma	El Morad Eslant	660	804	32000	104370	1296	90	500	500	500
Samma	El Morad Eslant	851	889	32000	104370	1296	90	500	500	500
Samma	El Morad Eslant	97	131	32000	104370	1296	90	500	500	500
Samma	Karus Eslant	109	132	32000	104370	1296	90	500	500	500
Samma	Karus Eslant	660	804	32000	104370	1296	90	500	500	500
Samma	Karus Eslant	851	889	32000	104370	1296	90	500	500	500
Samma	Karus Eslant	97	131	32000	104370	1296	90	500	500	500
Shaula	El Morad Eslant	860	957	32000	64485	1080	75	500	500	500
Shaula	El Morad Eslant	151	201	32000	64485	1080	75	500	500	500
Shaula	El Morad Eslant	88	121	32000	64485	1080	75	500	500	500
Shaula	El Morad Eslant	820	869	32000	64485	1080	75	500	500	500
Shaula	Karus Eslant	860	957	32000	64485	1080	75	25	25	25
Shaula	Karus Eslant	88	121	32000	64485	1080	75	25	25	25
Shaula	Karus Eslant	151	201	32000	64485	1080	75	25	25	25
Shaula	Karus Eslant	820	869	32000	64485	1080	75	25	25	25
Snake Queen	El Morad Eslant	776	838	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	871	934	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	202	232	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	113	179	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	135	180	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	237	326	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	637	685	32000	150000	1350	100	25	25	255
Snake Queen	El Morad Eslant	810	901	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	202	232	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	776	838	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	237	326	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	637	685	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	113	179	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	871	934	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	810	901	32000	150000	1350	100	25	25	255
Snake Queen	Karus Eslant	135	180	32000	150000	1350	100	25	25	255
Stone golem	El Morad Eslant	170	194	30	11000	720	100	200	200	200
Stone golem	El Morad Eslant	223	254	25	11000	720	100	200	200	200
Stone golem	El Morad Eslant	218	254	30	11000	720	100	200	200	200
Stone golem	Karus Eslant	198	246	30	11000	720	100	200	200	200
Stone golem	Karus Eslant	170	194	30	11000	720	100	200	200	200
Stone golem	Karus Eslant	222	237	25	11000	720	100	200	200	200
Talos	Karus Eslant	399	412	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	761	818	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	862	892	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	176	240	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	668	887	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	86	114	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	133	152	32000	220000	2016	140	28	25	255
Talos	Karus Eslant	144	169	32000	220000	2016	140	28	25	255
Talos	El Morad Eslant	144	169	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	399	412	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	761	818	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	862	892	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	176	240	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	86	114	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	668	887	32000	220000	2016	140	25	25	255
Talos	El Morad Eslant	133	152	32000	220000	2016	140	25	25	255
Titan	El Morad Eslant	856	907	60	20000	1638	130	25	25	255
Titan	El Morad Eslant	849	903	60	20000	1638	130	25	25	255
Titan	Karus Eslant	856	906	30	20000	1638	130	25	25	255
Titan	Karus Eslant	853	910	35	20000	1638	130	25	25	255
Troll	El Morad Eslant	562	622	30	21556	315	70	56	56	56
Troll	Karus Eslant	565	625	45	21556	315	70	56	56	56
Troll Berserker	El Morad Eslant	742	808	50	41748	405	90	56	56	56
Troll Berserker	El Morad Eslant	832	897	50	41748	405	90	56	56	56
Troll Berserker	Karus Eslant	771	828	50	41748	405	90	56	56	56
Troll Berserker	Karus Eslant	838	901	50	41748	405	90	56	56	56
Troll Captain	El Morad Eslant	601	631	55	55384	450	100	56	56	56
Troll Captain	El Morad Eslant	677	733	55	55384	450	100	56	56	56
Troll Captain	El Morad Eslant	708	765	55	55384	450	100	56	56	56
Troll Captain	Karus Eslant	701	758	60	55384	450	100	56	56	56
Troll Captain	Karus Eslant	743	810	60	55384	450	100	56	56	56
Troll King	El Morad Eslant	704	744	32000	233025	1490	110	1000	1000	56
Troll King	El Morad Eslant	107	135	32000	233025	1490	110	1000	1000	56
Troll King	El Morad Eslant	865	890	32000	233025	1490	110	1000	1000	56
Troll King	El Morad Eslant	838	875	32000	233025	1490	110	1000	1000	56
Troll King	El Morad Eslant	85	143	32000	233025	1490	110	1000	1000	56
Troll King	El Morad Eslant	850	904	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	838	875	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	85	143	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	107	129	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	850	904	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	865	890	32000	233025	1490	110	1000	1000	56
Troll King	Karus Eslant	711	741	32000	233025	1490	110	1000	1000	56
Troll Shaman	El Morad Eslant	678	741	50	49867	1325	70	100	100	100
Troll Shaman	El Morad Eslant	715	774	50	49867	1325	70	100	100	100
Troll Shaman	Karus Eslant	694	751	60	49867	1325	70	100	100	100
Troll Shaman	Karus Eslant	666	751	60	49867	1325	70	100	100	100
Troll Warrior	El Morad Eslant	543	600	50	38190	360	80	56	56	56
Troll Warrior	El Morad Eslant	563	617	60	38190	360	80	56	56	56
Troll Warrior	El Morad Eslant	602	661	50	38190	360	80	56	56	56
Troll Warrior	Karus Eslant	564	627	50	38190	360	80	56	56	56
Troll Warrior	Karus Eslant	542	607	50	38190	360	80	56	56	56
Troll Warrior	Karus Eslant	619	683	60	38190	360	80	56	56	56
Ancient	Luferson Castle	1207	1234	30	3577	315	50	75	150	120
Ancient	Luferson Castle	1252	1276	30	3577	315	50	75	150	120
Ancient	Luferson Castle	1244	1268	30	3577	315	50	75	150	120
Antares	Luferson Castle	724	815	32000	23010	720	50	25	25	25
Antares	Luferson Castle	653	733	32000	23010	720	50	25	25	25
Antares	Luferson Castle	259	356	32000	23010	720	50	25	25	25
Antares	Luferson Castle	840	894	32000	23010	720	50	25	25	25
Antares	Luferson Castle	1541	1599	32000	23010	720	50	25	25	25
Ape	Luferson Castle	178	199	30	3255	412	42	105	105	105
Ape	Luferson Castle	218	240	30	3255	412	42	105	105	105
Ape	Luferson Castle	236	260	30	3255	412	42	105	105	105
Ape	Luferson Castle	1055	1090	30	3255	412	42	105	105	105
Ape	Luferson Castle	766	789	30	3255	412	42	105	105	105
Apostle	Luferson Castle	1529	1536	45	21556	315	70	200	200	200
Apostle	Luferson Castle	1559	1566	45	21556	315	70	200	200	200
Apostle	Luferson Castle	1469	1476	45	21556	315	70	200	200	200
Ash knight	Luferson Castle	1508	1539	30	4664	396	55	76	146	76
Ash knight	Luferson Castle	1430	1460	35	4664	396	55	76	146	76
Ash knight	Luferson Castle	1249	1299	30	4664	396	55	76	146	76
Ash knight	Luferson Castle	1307	1345	35	4664	396	55	76	146	76
Baron	Luferson Castle	565	598	33	4056	374	52	86	73	73
Baron	Luferson Castle	631	668	33	4056	374	52	86	73	73
Battalion	Luferson Castle	1017	1031	30	769	233	27	42	75	42
Battalion	Luferson Castle	1046	1061	30	769	233	27	42	75	42
Blood Don	Luferson Castle	296	321	30	15211	299	70	100	100	100
Blood Don	Luferson Castle	299	326	35	15211	299	70	100	100	100
BUGBEAR	Luferson Castle	263	275	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	289	299	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	325	338	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	235	244	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	324	336	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	366	377	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	260	271	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	286	297	30	687	204	35	116	116	116
BUGBEAR	Luferson Castle	358	367	30	687	204	35	116	116	116
burning skeleton	Luferson Castle	961	1059	45	4000	410	57	79	79	79
burning skeleton	Luferson Castle	1140	1238	45	4000	410	57	79	79	79
Cardinal	Luferson Castle	581	619	33	4455	388	54	88	75	75
Cardinal	Luferson Castle	640	688	33	4455	388	54	88	75	75
Centaur	Luferson Castle	1870	1891	60	19204	1134	90	455	655	455
Centaur	Luferson Castle	1921	1949	60	19204	1134	90	455	655	455
Centaur	Luferson Castle	1833	1855	60	19204	1134	90	455	655	455
Dark eyes	Luferson Castle	639	663	25	1193	210	31	46	46	46
Dark eyes	Luferson Castle	674	698	30	1193	210	31	46	46	46
Death knight	Luferson Castle	674	716	30	2846	324	45	63	121	63
Death knight	Luferson Castle	1224	1245	30	2846	324	45	63	121	63
Death knight	Luferson Castle	1190	1215	30	2846	324	45	63	121	63
Death knight	Luferson Castle	1172	1200	30	2846	324	45	63	121	63
Death knight	Luferson Castle	1138	1169	30	2846	324	45	63	121	63
Decayed Zombie	Luferson Castle	1009	1023	30	598	207	24	38	68	38
Decayed Zombie	Luferson Castle	990	1005	30	598	207	24	38	68	38
Decayed Zombie	Luferson Castle	987	998	30	598	207	24	38	68	38
Deruvish	Luferson Castle	1440	1447	30	10890	216	60	140	140	140
Deruvish	Luferson Castle	1546	1553	30	10890	216	60	140	140	140
Dire wolf	Luferson Castle	559	582	25	1373	224	33	49	49	49
Dire wolf	Luferson Castle	589	613	30	1373	224	33	49	49	49
Dire wolf	Luferson Castle	663	696	25	1373	224	33	49	49	49
Dire wolf	Luferson Castle	670	708	30	1373	224	33	49	49	49
Dragon Knight	Luferson Castle	891	931	35	3846	486	50	63	500	63
Dragon Knight	Luferson Castle	1717	1739	35	3846	486	50	63	500	63
Dragon Knight	Luferson Castle	952	994	30	3846	486	50	63	500	63
Dragon Knight	Luferson Castle	1644	1673	30	3846	486	50	63	500	63
Dragon Tooth commander	Luferson Castle	1131	1177	30	10557	501	68	70	500	130
Dragon Tooth commander	Luferson Castle	1173	1247	35	10557	501	68	70	500	130
Dragon Tooth commander	Luferson Castle	1712	1774	30	10557	501	68	70	500	130
Dragon Tooth commander	Luferson Castle	1745	1781	35	10557	501	68	70	500	130
Dragon Tooth Skeleton	Luferson Castle	910	962	30	7123	468	65	88	171	88
Dragon Tooth Skeleton	Luferson Castle	803	868	35	7123	468	65	88	171	88
Dragon Tooth Skeleton	Luferson Castle	661	709	30	7123	468	65	88	171	88
Dragon Tooth Skeleton	Luferson Castle	584	629	35	7123	468	65	88	171	88
Dragon Tooth soldier	Luferson Castle	854	904	30	5824	417	58	76	500	76
Dragon Tooth soldier	Luferson Castle	957	1009	35	5824	417	58	76	500	76
Dragon Tooth soldier	Luferson Castle	1513	1547	35	5824	417	58	76	500	76
Dragon Tooth soldier	Luferson Castle	1487	1527	30	5824	417	58	76	500	76
Dusk Orc	Luferson Castle	714	738	25	617	288	40	119	119	63
Dusk Orc	Luferson Castle	745	767	30	617	288	40	119	119	63
Dusk Orc	Luferson Castle	774	797	25	617	288	40	119	119	63
Dusk Orc	Luferson Castle	803	824	30	617	288	40	119	119	63
Flame Rock	Luferson Castle	1860	1949	3600	16615	720	100	25	25	25
Flame Rock	Luferson Castle	1906	1941	3600	16615	720	100	25	25	25
Garuna	Luferson Castle	1496	1523	23	5316	572	53	74	74	74
Garuna	Luferson Castle	1554	1585	30	5316	572	53	74	74	74
Garuna	Luferson Castle	1503	1536	30	5316	572	53	74	74	74
Giant golem	Luferson Castle	1895	1916	25	14000	990	110	25	25	255
Giant golem	Luferson Castle	1915	1943	30	14000	990	110	25	25	255
Giant golem	Luferson Castle	1904	1934	30	14000	990	110	25	25	255
Glyptodont	Luferson Castle	641	691	30	2206	462	34	50	50	50
Glyptodont	Luferson Castle	616	672	30	2206	462	34	50	50	50
GOBLIN bouncer	Luferson Castle	316	326	30	1601	303	45	130	130	130
GOBLIN bouncer	Luferson Castle	288	300	30	1601	303	45	130	130	130
GRAY OOZY	Luferson Castle	418	445	30	4077	345	40	38	38	38
GRAY OOZY	Luferson Castle	455	480	25	4077	345	40	38	38	38
GRAY OOZY	Luferson Castle	431	477	35	4077	345	40	38	38	38
GRELL	Luferson Castle	243	264	30	4885	387	60	154	154	154
GRELL	Luferson Castle	259	277	30	4885	387	60	154	154	154
GRELL	Luferson Castle	207	227	30	4885	387	60	154	154	154
GRELL	Luferson Castle	176	192	30	4885	387	60	154	154	154
GRELL	Luferson Castle	194	213	30	4885	387	60	154	154	154
Harpy	Luferson Castle	1628	1647	60	16167	529	70	50	50	50
Harpy	Luferson Castle	1833	1850	60	16167	529	70	50	50	50
Harpy	Luferson Castle	1907	1925	60	16167	529	70	50	50	50
Harpy	Luferson Castle	1837	1856	60	16167	529	70	50	50	50
Harpy	Luferson Castle	1907	1927	60	16167	529	70	50	50	50
Harpy	Luferson Castle	1730	1746	60	16167	529	70	50	50	50
Haunga	Luferson Castle	1271	1302	20	5831	594	55	76	76	76
Haunga	Luferson Castle	1395	1436	20	5831	594	55	76	76	76
Haunga	Luferson Castle	1512	1539	15	5831	594	55	76	76	76
Haunga	Luferson Castle	1286	1320	15	5831	594	55	76	76	76
Haunga	Luferson Castle	1517	1542	15	5831	594	55	76	76	76
Haunga Warrior	Luferson Castle	1177	1212	30	7260	648	60	2000	2000	2000
Haunga Warrior	Luferson Castle	1104	1139	30	7260	648	60	2000	2000	2000
Haunga Warrior	Luferson Castle	996	1034	30	7260	648	60	2000	2000	2000
Haunga Warrior	Luferson Castle	1228	1277	30	7260	648	60	2000	2000	2000
Hell hound	Luferson Castle	114	136	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	159	183	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	109	136	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	147	173	45	10000	299	52	2000	2000	2000
Hell hound	Luferson Castle	103	126	45	10000	299	52	2000	2000	2000
HORNET	Luferson Castle	1052	1088	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1383	1403	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1381	1399	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1380	1396	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1378	1396	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1107	1155	30	3998	300	45	50	50	130
HORNET	Luferson Castle	1387	1404	30	3998	300	45	50	50	130
Hyde	Luferson Castle	1782	1834	32000	17790	648	45	25	25	255
Hyde	Luferson Castle	1002	1064	32000	17790	648	45	25	25	255
Hyde	Luferson Castle	910	1010	32000	17790	648	45	25	25	255
Hyde	Luferson Castle	626	694	32000	17790	648	45	25	25	255
Hyde	Luferson Castle	1197	1238	32000	17790	648	45	25	25	255
Keilan	Luferson Castle	722	750	25	13420	208	40	32	32	32
Keilan	Luferson Castle	757	788	30	13420	208	40	32	32	32
Keilan	Luferson Castle	777	807	25	13420	208	40	32	32	32
Keilan	Luferson Castle	739	786	30	13420	208	40	32	32	32
KOBOLD	Luferson Castle	352	363	30	415	162	30	109	109	109
KOBOLD	Luferson Castle	367	376	30	415	162	30	109	109	109
KOBOLD	Luferson Castle	268	278	30	415	162	30	109	109	109
KOBOLD	Luferson Castle	251	260	30	415	162	30	109	109	109
KOBOLD	Luferson Castle	240	249	30	415	162	30	109	109	109
KOBOLD	Luferson Castle	386	398	30	415	162	30	109	109	109
Kongau	Luferson Castle	1293	1307	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1213	1248	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1192	1225	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1248	1279	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1280	1296	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1128	1188	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1427	1452	23	4378	529	49	69	69	69
Kongau	Luferson Castle	1368	1401	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1376	1400	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1299	1352	23	4378	529	49	69	69	69
Kongau	Luferson Castle	1111	1148	30	4378	529	49	69	69	69
Kongau	Luferson Castle	1076	1097	30	4378	529	49	69	69	69
Laird	Luferson Castle	722	753	30	3681	360	50	84	70	70
Laird	Luferson Castle	783	832	30	3681	360	50	84	70	70
Lamia	Luferson Castle	1405	1433	30	2904	432	60	20	200	200
Lamia	Luferson Castle	1384	1419	30	2904	432	60	20	200	200
Lard Orc	Luferson Castle	410	440	30	1058	360	50	147	147	77
Lard Orc	Luferson Castle	440	472	30	1058	360	50	147	147	77
LICH	Luferson Castle	627	647	30	8557	477	70	70	70	130
LICH	Luferson Castle	690	712	30	8557	477	70	70	70	130
LICH	Luferson Castle	716	738	30	8557	477	70	70	70	130
Loup-garou	Luferson Castle	519	540	25	879	155	27	42	42	42
Loup-garou	Luferson Castle	534	562	30	879	155	27	42	42	42
Loup-garou	Luferson Castle	574	595	25	879	155	27	42	42	42
Loup-garou	Luferson Castle	599	625	30	879	155	27	42	42	42
Lycan	Luferson Castle	458	478	25	745	144	25	38	38	38
Lycan	Luferson Castle	485	510	30	745	144	25	38	38	38
Lycan	Luferson Castle	598	618	25	745	144	25	38	38	38
Lycan	Luferson Castle	571	589	30	745	144	25	38	38	38
Machirodus	Luferson Castle	285	336	23	2232	247	43	72	72	61
Machirodus	Luferson Castle	350	388	30	2232	247	43	72	72	61
Machirodus	Luferson Castle	238	273	23	2232	247	43	72	72	61
Manticore	Luferson Castle	1413	1469	60	12551	994	85	25	25	255
Manticore	Luferson Castle	1594	1666	60	12551	994	85	25	25	255
Manticore	Luferson Castle	1602	1649	60	12551	994	85	25	25	255
Mastodon	Luferson Castle	790	840	25	3220	576	40	58	58	58
Mastodon	Luferson Castle	570	615	25	3220	576	40	58	58	58
Meganthereon	Luferson Castle	169	213	30	2490	259	45	75	75	63
Meganthereon	Luferson Castle	121	150	30	2490	259	45	75	75	63
Megarodon	Luferson Castle	784	847	25	3616	604	42	114	114	61
Orc Watcher	Luferson Castle	620	653	30	318	240	30	91	91	49
Orc Watcher	Luferson Castle	595	616	25	318	240	30	91	91	49
paralyzer	Luferson Castle	841	862	30	1121	326	32	48	48	48
Paralyzer	Luferson Castle	813	835	25	1121	326	32	48	48	48
Pincers scorpion	Luferson Castle	720	752	30	970	306	30	45	45	45
Pincers scorpion	Luferson Castle	747	779	30	970	306	30	45	45	45
POOKA	Luferson Castle	313	324	30	1073	252	40	123	123	123
POOKA	Luferson Castle	338	349	30	1073	252	40	123	123	123
POOKA	Luferson Castle	248	259	30	1073	252	40	123	123	123
POOKA	Luferson Castle	283	293	30	1073	252	40	123	123	123
Raven Harpy	Luferson Castle	1704	1729	35	27496	648	80	150	150	154
Raven Harpy	Luferson Castle	1798	1832	60	27496	648	80	150	150	154
Raven Harpy	Luferson Castle	1870	1893	60	27496	648	80	150	150	154
Raven Harpy	Luferson Castle	1641	1658	60	27496	648	80	150	150	154
Rotten Eyes	Luferson Castle	961	975	30	970	306	30	45	84	45
Rotten Eyes	Luferson Castle	987	1001	30	970	306	30	45	84	45
saber tooth	Luferson Castle	500	566	23	1992	236	41	69	69	58
saber tooth	Luferson Castle	317	361	23	1992	236	41	69	69	58
saber tooth	Luferson Castle	364	404	30	1992	236	41	69	69	58
saber tooth	Luferson Castle	1237	1263	30	1992	236	41	69	69	58
saber tooth	Luferson Castle	805	836	25	1992	236	41	69	69	58
saber tooth	Luferson Castle	870	895	25	1992	236	41	69	69	58
saber tooth	Luferson Castle	880	909	30	1992	236	41	69	69	58
saber tooth	Luferson Castle	842	863	30	1992	236	41	69	69	58
Scolar	Luferson Castle	1090	1109	30	3002	331	46	76	66	66
Scolar	Luferson Castle	537	571	33	3002	331	46	76	66	66
Scolar	Luferson Castle	529	568	33	3002	331	46	76	66	66
Scolar	Luferson Castle	657	694	33	3002	331	46	76	66	66
Scorpion	Luferson Castle	634	658	25	709	224	26	40	40	40
Scorpion	Luferson Castle	666	690	30	709	224	26	40	40	40
scouting soldier	Luferson Castle	811	820	300	3000	500	30	400	400	400
Shadow seeker	Luferson Castle	909	926	30	1028	167	29	44	44	44
Shadow seeker	Luferson Castle	939	949	30	1028	167	29	44	44	44
Shadow seeker	Luferson Castle	923	939	30	1028	167	29	44	44	44
Sheriff	Luferson Castle	1210	1254	30	3330	345	48	80	68	68
Skeleton	Luferson Castle	649	675	25	1193	210	31	46	86	46
Skeleton	Luferson Castle	612	642	30	1193	210	31	46	86	46
Skeleton	Luferson Castle	556	588	25	1193	210	31	46	86	46
Skeleton	Luferson Castle	557	593	30	1193	210	31	46	86	46
Skeleton champion	Luferson Castle	662	695	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	662	706	30	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	1019	1044	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	1005	1039	30	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	976	1001	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	965	997	30	1787	251	37	54	100	54
Skeleton knight	Luferson Castle	588	618	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	627	659	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	901	911	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	929	943	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	899	915	35	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	951	972	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	980	1001	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	959	987	30	1572	238	35	51	96	51
Shadow seeker	Luferson Castle	909	926	30	1028	167	29	44	44	44
Shadow seeker	Luferson Castle	939	949	30	1028	167	29	44	44	44
Shadow seeker	Luferson Castle	923	939	30	1028	167	29	44	44	44
Sheriff	Luferson Castle	1210	1254	30	3330	345	48	80	68	68
Skeleton	Luferson Castle	649	675	25	1193	210	31	46	86	46
Skeleton	Luferson Castle	612	642	30	1193	210	31	46	86	46
Skeleton	Luferson Castle	556	588	25	1193	210	31	46	86	46
Skeleton	Luferson Castle	557	593	30	1193	210	31	46	86	46
Skeleton champion	Luferson Castle	662	695	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	662	706	30	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	1019	1044	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	1005	1039	30	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	976	1001	25	1787	251	37	54	100	54
Skeleton champion	Luferson Castle	965	997	30	1787	251	37	54	100	54
Skeleton knight	Luferson Castle	588	618	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	627	659	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	901	911	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	929	943	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	899	915	35	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	951	972	30	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	980	1001	25	1572	238	35	51	96	51
Skeleton knight	Luferson Castle	959	987	30	1572	238	35	51	96	51
Skeleton warrior	Luferson Castle	975	1002	30	1373	224	33	49	91	49
Skeleton warrior	Luferson Castle	968	993	25	1373	224	33	49	91	49
Skeleton warrior	Luferson Castle	971	995	25	1373	224	33	49	91	49
Skeleton warrior	Luferson Castle	961	995	30	1373	224	33	49	91	49
Skeleton warrior	Luferson Castle	638	671	25	1373	224	33	49	91	49
Skeleton warrior	Luferson Castle	627	671	30	1373	224	33	49	91	49
Smilodon	Luferson Castle	440	471	25	1564	201	37	63	63	54
Smilodon	Luferson Castle	392	432	30	1564	201	37	63	63	54
Smilodon	Luferson Castle	440	470	25	1564	201	37	63	63	54
Smilodon	Luferson Castle	395	431	30	1564	201	37	63	63	54
Smilodon	Luferson Castle	421	459	25	1564	201	37	63	63	54
Smilodon	Luferson Castle	426	472	30	1564	201	37	63	63	54
Smilodon	Luferson Castle	755	781	30	1564	201	37	63	63	54
Smilodon	Luferson Castle	790	814	25	1564	201	37	63	63	54
Smilodon	Luferson Castle	823	858	35	1564	201	37	63	63	54
Stegodon	Luferson Castle	666	702	30	2854	516	38	55	55	55
Stegodon	Luferson Castle	1173	1242	25	2854	516	38	55	55	55
Stegodon	Luferson Castle	1131	1245	25	2854	516	38	55	55	55
Stegodon	Luferson Castle	831	891	25	2854	516	38	55	55	55
Stinger	Luferson Castle	871	912	25	1286	346	34	50	50	50
Stinger	Luferson Castle	892	937	30	1286	346	34	50	50	50
Stone golem	Luferson Castle	1774	1805	30	11000	720	100	200	200	200
Stone golem	Luferson Castle	1899	1922	30	11000	720	100	200	200	200
Stone golem	Luferson Castle	1916	1941	25	11000	720	100	200	200	200
Stone golem	Luferson Castle	1930	1950	25	11000	720	100	200	200	200
treant	Luferson Castle	1159	1185	30	4773	405	55	85	160	120
treant	Luferson Castle	1103	1135	30	4773	405	55	85	160	120
treant	Luferson Castle	1099	1131	30	4773	405	55	85	160	120
Troll	Luferson Castle	1437	1463	45	21556	315	70	56	56	56
Troll	Luferson Castle	1500	1521	45	21556	315	70	56	56	56
Troll	Luferson Castle	1283	1308	60	21556	315	70	56	56	56
Troll	Luferson Castle	1199	1228	60	21556	315	70	56	56	56
Troll	Luferson Castle	1202	1234	60	21556	315	70	56	56	56
Troll Warrior	Luferson Castle	1240	1273	60	38190	360	80	56	56	56
Troll Warrior	Luferson Castle	1345	1374	45	38190	360	80	56	56	56
Troll Warrior	Luferson Castle	1209	1242	45	38190	360	80	56	56	56
Troll Warrior	Luferson Castle	1411	1444	60	38190	360	80	56	56	56
Troll Warrior	Luferson Castle	1334	1362	60	38190	360	80	56	56	56
Tyon	Luferson Castle	347	367	30	8423	405	55	197	197	197
Tyon	Luferson Castle	366	387	30	8423	405	55	197	197	197
Tyon	Luferson Castle	444	464	30	8423	405	55	197	197	197
Tyon	Luferson Castle	477	495	30	8423	405	55	197	197	197
Tyon	Luferson Castle	447	466	30	8423	405	55	197	197	197
Tyon	Luferson Castle	386	402	30	8423	405	55	197	197	197
undying	Luferson Castle	1032	1049	30	1202	336	33	49	91	49
undying	Luferson Castle	1033	1046	30	1202	336	33	49	91	49
undying	Luferson Castle	1032	1045	30	1202	336	33	49	91	49
Uruk Blade	Luferson Castle	1700	1718	30	2478	504	70	154	154	154
Uruk Blade	Luferson Castle	1759	1777	30	2478	504	70	154	154	154
Uruk Blade	Luferson Castle	1711	1728	30	2478	504	70	154	154	154
Uruk Hai	Luferson Castle	1686	1704	30	1669	432	60	154	154	154
Uruk Hai	Luferson Castle	1737	1756	30	1669	432	60	154	154	154
Uruk Hai	Luferson Castle	1742	1760	30	1669	432	60	154	154	154
Uruk Tron	Luferson Castle	1563	1586	60	3513	576	80	154	154	154
Uruk Tron	Luferson Castle	1649	1673	60	3513	576	80	154	154	154
Uruk Tron	Luferson Castle	1620	1643	60	3513	576	80	154	154	154
Wild smilodon	Luferson Castle	736	773	30	1769	212	39	67	67	56
Wild smilodon	Luferson Castle	738	774	25	1769	212	39	67	67	56
Wild smilodon	Luferson Castle	832	884	30	1769	212	39	67	67	56
Wild smilodon	Luferson Castle	833	865	25	1769	212	39	67	67	56
Wild smilodon	Luferson Castle	874	902	25	1769	212	39	67	67	56
Wild smilodon	Luferson Castle	873	915	30	1769	212	39	67	67	56
Ancient	Ronark Land	587	587	20	3577	315	50	75	150	120
Ancient	Ronark Land	595	595	20	3577	315	50	75	150	120
Ancient	Ronark Land	603	603	20	3577	315	50	75	150	120
Ancient	Ronark Land	607	607	20	3577	315	50	75	150	120
Ancient	Ronark Land	602	602	20	3577	315	50	75	150	120
Ancient	Ronark Land	593	593	20	3577	315	50	75	150	120
Ancient	Ronark Land	588	588	20	3577	315	50	75	150	120
Ancient	Ronark Land	589	589	20	3577	315	50	75	150	120
Ancient	Ronark Land	594	594	20	3577	315	50	75	150	120
Ancient	Ronark Land	602	602	20	3577	315	50	75	150	120
Ancient	Ronark Land	607	607	20	3577	315	50	75	150	120
Ancient	Ronark Land	607	607	20	3577	315	50	75	150	120
Ancient	Ronark Land	1438	1438	20	3577	315	50	75	150	120
Ancient	Ronark Land	1439	1439	20	3577	315	50	75	150	120
Ancient	Ronark Land	1430	1430	20	3577	315	50	75	150	120
Elite Pirate	Ronark Land	?	?	60	30000	?	60	?	?	?
Ancient	Ronark Land	1418	1418	20	3577	315	50	75	150	120
Ancient	Ronark Land	1410	1410	20	3577	315	50	75	150	120
Ancient	Ronark Land	1410	1410	20	3577	315	50	75	150	120
Ancient	Ronark Land	1418	1418	20	3577	315	50	75	150	120
Ancient	Ronark Land	1427	1427	20	3577	315	50	75	150	120
Ancient	Ronark Land	1418	1418	20	3577	315	50	75	150	120
Ancient	Ronark Land	1428	1428	20	3577	315	50	75	150	120
Ancient	Ronark Land	1429	1429	20	3577	315	50	75	150	120
Apostle of Flames	Ronark Land	1094	1094	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1099	1099	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	762	762	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	763	763	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	754	754	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	751	751	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	756	756	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1226	1226	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1232	1232	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1220	1220	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1213	1213	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1221	1221	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1101	1101	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1095	1095	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1106	1106	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1111	1111	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1103	1103	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1094	1094	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1104	1104	20	46556	1000	70	100	100	100
Apostle of Flames	Ronark Land	1103	1103	20	46556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	281	281	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	276	276	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	263	263	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	265	265	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	271	271	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	236	236	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	239	239	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	225	225	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	220	220	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	229	229	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1780	1780	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1770	1770	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1766	1766	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1776	1776	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1773	1773	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1786	1786	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1795	1795	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1802	1802	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1792	1792	20	42556	1000	70	100	100	100
Apostle of Piercing Cold	Ronark Land	1792	1792	20	42556	1000	70	100	100	100
Atross	Ronark Land	1009	1009	3600	89650	1224	85	500	500	500
Atross	Ronark Land	968	968	3600	89650	1224	85	500	500	500
Atross	Ronark Land	999	999	3600	89650	1224	85	500	500	500
Atross	Ronark Land	1015	1015	3600	89650	1224	85	500	500	500
Atross	Ronark Land	1043	1043	3600	89650	1224	85	500	500	500
Atross	Ronark Land	1084	1084	3600	89650	1224	85	500	500	500
Balrog	Ronark Land	427	427	30	81775	2000	100	120	120	120
Balrog	Ronark Land	423	423	30	81775	2000	100	120	120	120
Balrog	Ronark Land	427	427	30	81775	2000	100	120	120	120
Balrog	Ronark Land	423	423	30	81775	2000	100	120	120	120
Balrog	Ronark Land	423	423	30	81775	2000	100	120	120	120
Balrog	Ronark Land	733	733	20	81775	2000	100	120	120	120
Balrog	Ronark Land	745	745	20	81775	2000	100	120	120	120
Balrog	Ronark Land	731	731	20	81775	2000	100	120	120	120
Balrog	Ronark Land	717	717	20	81775	2000	100	120	120	120
Balrog	Ronark Land	732	732	20	81775	2000	100	120	120	120
Balrog	Ronark Land	1625	1625	30	81775	2000	100	120	120	120
Balrog	Ronark Land	1629	1629	30	81775	2000	100	120	120	120
Balrog	Ronark Land	1617	1617	30	81775	2000	100	120	120	120
Balrog	Ronark Land	1625	1625	30	81775	2000	100	120	120	120
Balrog	Ronark Land	1645	1645	30	81775	2000	100	120	120	120
Balrog	Ronark Land	1300	1300	20	81775	2000	100	120	120	120
Balrog	Ronark Land	1317	1317	20	81775	2000	100	120	120	120
Balrog	Ronark Land	1312	1312	20	81775	2000	100	120	120	120
Balrog	Ronark Land	1326	1326	20	81775	2000	100	120	120	120
Balrog	Ronark Land	1318	1318	20	81775	2000	100	120	120	120
Beast	Ronark Land	287	287	20	3549	299	52	86	86	73
Beast	Ronark Land	302	302	20	3549	299	52	86	86	73
Beast	Ronark Land	304	304	20	3549	299	52	86	86	73
Beast	Ronark Land	1573	1573	20	3549	299	52	86	86	73
Beast	Ronark Land	1590	1590	20	3549	299	52	86	86	73
Beast	Ronark Land	1592	1592	20	3549	299	52	86	86	73
Beast	Ronark Land	1578	1578	20	3549	299	52	86	86	73
Blood seeker	Ronark Land	411	411	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	405	405	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	412	412	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	419	419	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1570	1570	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1563	1563	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1567	1567	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1575	1575	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1115	1115	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1122	1122	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1131	1131	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1126	1126	20	3681	360	50	70	70	70
Blood seeker	Ronark Land	1123	1123	20	3681	360	50	70	70	70
Booro	Ronark Land	1589	1705	30	95000	1250	100	0	0	200
Booro	Ronark Land	1625	1637	30	95000	1250	100	0	0	200
Booro	Ronark Land	1597	1621	30	95000	1250	100	0	0	200
Booro	Ronark Land	1613	1633	30	95000	1250	100	0	0	200
Booro	Ronark Land	1581	1589	30	95000	1250	100	0	0	200
Booro	Ronark Land	1585	1601	30	95000	1250	100	0	0	200
Booro	Ronark Land	1369	1369	30	95000	1250	100	0	0	200
Booro	Ronark Land	1373	1373	30	95000	1250	100	0	0	200
Booro	Ronark Land	661	661	20	95000	1250	100	0	0	200
Booro	Ronark Land	668	668	20	95000	1250	100	0	0	200
Booro	Ronark Land	682	682	20	95000	1250	100	0	0	200
Booro	Ronark Land	674	674	20	95000	1250	100	0	0	200
Booro	Ronark Land	671	671	20	95000	1250	100	0	0	200
Booro	Ronark Land	363	363	30	64124	2000	90	120	120	120
Booro	Ronark Land	383	383	30	64124	2000	90	120	120	120
Booro	Ronark Land	367	367	30	64124	2000	90	120	120	120
Booro	Ronark Land	379	379	30	64124	2000	90	120	120	120
Booro	Ronark Land	379	379	30	64124	2000	90	120	120	120
Booro	Ronark Land	1357	1377	30	95000	1250	100	0	0	200
Booro	Ronark Land	1369	1385	30	95000	1250	100	0	0	200
Booro	Ronark Land	1349	1373	30	95000	1250	100	0	0	200
Booro	Ronark Land	1373	1377	30	95000	1250	100	0	0	200
Cardinal	Ronark Land	203	203	20	4664	396	55	91	76	76
Cardinal	Ronark Land	191	191	20	4664	396	55	91	76	76
Cardinal	Ronark Land	187	187	20	4664	396	55	91	76	76
Cardinal	Ronark Land	198	198	20	4664	396	55	91	76	76
Cardinal	Ronark Land	195	195	20	4664	396	55	91	76	76
Cardinal	Ronark Land	166	166	20	4664	396	55	91	76	76
Cardinal	Ronark Land	151	151	20	4664	396	55	91	76	76
Cardinal	Ronark Land	156	156	20	4664	396	55	91	76	76
Cardinal	Ronark Land	169	169	20	4664	396	55	91	76	76
Cardinal	Ronark Land	159	159	20	4664	396	55	91	76	76
Cardinal	Ronark Land	150	150	20	4664	396	55	91	76	76
Cardinal	Ronark Land	138	138	20	4664	396	55	91	76	76
Cardinal	Ronark Land	143	143	20	4664	396	55	91	76	76
Cardinal	Ronark Land	153	153	20	4664	396	55	91	76	76
Cardinal	Ronark Land	147	147	20	4664	396	55	91	76	76
Cardinal	Ronark Land	198	198	20	4664	396	55	91	76	76
Cardinal	Ronark Land	189	189	20	4664	396	55	91	76	76
Cardinal	Ronark Land	174	174	20	4664	396	55	91	76	76
Cardinal	Ronark Land	185	185	20	4664	396	55	91	76	76
Cardinal	Ronark Land	171	171	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1860	1860	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1860	1860	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1871	1871	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1873	1873	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1867	1867	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1854	1854	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1863	1863	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1864	1864	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1859	1859	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1851	1851	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1905	1905	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1890	1890	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1889	1889	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1904	1904	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1898	1898	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1899	1899	20	4664	396	55	91	76	76
Cardinal	Ronark Land	1901	1901	20	4664	396	55	91	76	76
Chaos Stone	Ronark Land	1013	1013	7200	250000	2500	80	250	250	250
Crimson Wing	Ronark Land	790	790	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	798	798	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	805	805	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	796	796	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	797	797	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	772	772	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	766	766	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	778	778	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	782	782	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	773	773	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	819	819	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	812	812	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	827	827	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1302	1302	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1292	1292	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1285	1285	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1293	1293	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1292	1292	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1250	1250	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1255	1255	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1244	1244	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1239	1239	20	43835	810	90	200	200	154
Crimson Wing	Ronark Land	1246	1246	20	43835	810	90	200	200	154
Cruel	Ronark Land	852	852	?	55841	2914	73	55	55	55
Cruel	Ronark Land	1190	1190	?	55841	2914	73	55	55	55
Dark Knight	Ronark Land	456	456	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	442	442	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	442	442	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	456	456	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	450	450	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	434	434	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	445	445	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	445	445	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	434	434	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	438	438	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1537	1537	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	1537	1537	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	1533	1533	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	1537	1537	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	1525	1525	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	467	467	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	467	467	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	479	479	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	463	463	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	475	475	30	88014	535	82	50	50	150
Dark Knight	Ronark Land	1518	1518	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1527	1527	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1520	1520	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1529	1529	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1536	1536	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1544	1544	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1537	1537	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1545	1545	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1526	1526	20	88014	535	70	50	50	300
Dark Knight	Ronark Land	1539	1539	20	88014	535	70	50	50	300
Dark stone	Ronark Land	1461	1461	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1453	1453	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1477	1477	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1445	1445	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1453	1457	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1477	1477	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1469	1469	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1497	1497	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1457	1457	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1469	1469	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1361	1357	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1393	1393	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1389	1389	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1389	1389	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1377	1377	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1341	1341	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1345	1345	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1337	1337	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1365	1365	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	1353	1353	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	603	603	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	615	615	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	611	611	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	603	603	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	595	595	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	631	631	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	623	623	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	615	615	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	631	631	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	627	627	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	703	703	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	715	715	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	715	715	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	719	719	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	711	711	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	719	719	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	723	723	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	719	719	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	723	723	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	719	719	30	17000	1600	120	25	25	255
Dark stone	Ronark Land	715	715	30	17000	1600	120	25	25	255
Doom Soldier	Ronark Land	306	306	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	307	307	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	377	377	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	368	368	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	1659	1659	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	1674	1674	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	1739	1739	20	45845	500	70	120	120	100
Doom Soldier	Ronark Land	1727	1727	20	45845	500	70	120	120	100
Enigma	Ronark Land	664	664	?	148412	2541	70	555	555	555
Enigma	Ronark Land	1397	1397	?	148412	2541	70	555	555	555
Evil Wizard	Ronark Land	623	623	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	615	615	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	608	608	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	615	615	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	579	579	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	574	574	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	562	562	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	567	567	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	525	525	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	510	510	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	511	511	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	735	735	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	731	731	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1636	1636	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1623	1623	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1623	1623	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1635	1635	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1629	1629	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1159	1159	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1154	1154	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1165	1165	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1171	1171	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1163	1163	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1438	1438	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1444	1444	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1455	1455	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1449	1449	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1501	1501	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1508	1508	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1517	1517	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1512	1512	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1553	1553	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1564	1564	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	1564	1564	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	726	726	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	728	728	20	38912	1567	70	300	300	300
Evil Wizard	Ronark Land	738	738	20	38912	1567	70	300	300	300
Falcon	Ronark Land	444	444	20	66460	990	100	250	250	154
Falcon	Ronark Land	451	451	20	66460	990	100	250	250	154
Falcon	Ronark Land	462	462	20	66460	990	100	250	250	154
Falcon	Ronark Land	455	455	20	66460	990	100	250	250	154
Falcon	Ronark Land	452	452	20	66460	990	100	250	250	154
Falcon	Ronark Land	1248	1248	20	66460	990	100	250	250	154
Falcon	Ronark Land	1251	1251	20	66460	990	100	250	250	154
Falcon	Ronark Land	1235	1235	20	66460	990	100	250	250	154
Falcon	Ronark Land	1234	1234	20	66460	990	100	250	250	154
Falcon	Ronark Land	1242	1242	20	66460	990	100	250	250	154
Havoc	Ronark Land	1309	1309	?	95748	3214	75	555	555	555
Havoc	Ronark Land	759	759	?	95748	3214	75	555	555	555
Hell Fire	Ronark Land	975	975	?	165451	2547	75	555	555	555
Hell Fire	Ronark Land	1692	1692	20	165451	2547	75	555	555	555
Hell Fire	Ronark Land	357	357	?	165451	2547	75	555	555	555
Hell Fire	Ronark Land	1082	1082	?	165451	2547	75	555	555	555
HOBGOBLIN	Ronark Land	1464	1464	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1406	1406	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	647	647	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	710	710	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	642	642	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	625	625	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	603	603	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	603	603	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	614	614	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	704	704	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	712	712	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	714	714	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	721	721	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	724	724	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	732	732	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	728	728	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	734	734	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	732	732	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	737	737	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	732	732	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	735	735	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	728	728	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	729	729	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	723	723	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	715	715	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	712	712	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	705	705	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	697	697	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	690	690	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	689	683	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	678	678	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	671	671	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	667	667	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	657	657	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	652	652	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	644	644	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	641	641	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	635	635	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	633	633	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	623	623	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	623	623	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	613	613	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	617	617	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	614	614	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	621	621	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	622	622	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	622	622	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	631	631	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	630	630	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	637	637	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	641	641	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1382	1382	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1385	1385	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1376	1376	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1379	1379	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1371	1371	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1378	1378	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1370	1370	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1375	1375	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1367	1367	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1372	1372	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1365	1365	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1372	1372	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1372	1372	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1381	1381	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1385	1385	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1396	1396	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1396	1396	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1401	1401	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1406	1406	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1414	1414	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1418	1418	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1426	1426	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1433	1433	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1440	1440	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1446	1446	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1450	1450	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1456	1456	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1461	1461	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1470	1470	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1474	1474	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1482	1482	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1485	1485	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1495	1495	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1496	1496	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1495	1495	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1503	1503	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1503	1503	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1512	1512	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1509	1509	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1514	1514	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1514	1514	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1515	1515	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1516	1516	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1504	1504	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1500	1500	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1492	1492	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1487	1487	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1479	1479	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1472	1472	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1467	1467	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1459	1459	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	665	665	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	677	677	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	687	687	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	698	698	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1473	1473	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1456	1456	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1441	1441	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1441	1441	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1439	1439	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1428	1428	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1426	1426	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1418	1418	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1415	1415	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1402	1402	20	6709	607	71	158	158	158
HOBGOBLIN	Ronark Land	1408	1408	20	6709	607	71	158	158	158
Orc bandit archer	Ronark Land	1879	1879	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	154	154	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	158	158	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	155	155	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	134	134	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	123	123	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	120	120	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	128	128	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	141	141	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	152	152	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1884	1884	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1879	1879	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1883	1883	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1888	1888	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1897	1897	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1906	1906	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1919	1919	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1930	1930	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1936	1936	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1937	1937	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1932	1932	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1919	1919	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1905	1905	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1896	1896	20	1380	360	50	25	25	25
Orc bandit archer	Ronark Land	1887	1887	20	1380	360	50	25	25	25
Orc bandit leader	Ronark Land	1921	1921	20	227340	864	120	25	25	25
Orc bandit leader	Ronark Land	119	119	14440	227340	864	120	25	25	25
Orc bandit officer	Ronark Land	1878	1878	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1911	1911	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	157	157	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	168	168	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	147	147	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	121	121	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	119	119	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	106	106	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1884	1884	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1889	1889	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1907	1907	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1923	1923	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1923	1923	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1910	1910	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1896	1896	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1894	1894	20	27692	720	100	25	25	25
Orc bandit officer	Ronark Land	1866	1866	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1869	1869	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1888	1888	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1898	1898	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1936	1936	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1940	1940	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1939	1939	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	1924	1924	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	107	107	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	136	136	20	55384	720	100	25	25	25
Orc bandit officer	Ronark Land	150	150	20	55384	720	100	25	25	25
Orc bandit Warrior	Ronark Land	136	136	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	130	130	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	127	127	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	133	133	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	141	141	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	148	148	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	149	149	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	147	147	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1895	1895	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1900	1900	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1914	1914	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1903	1903	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1917	1917	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1919	1919	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1912	1912	20	2301	360	50	25	25	25
Orc bandit Warrior	Ronark Land	1905	1905	20	2301	360	50	25	25	25
Riote	Ronark Land	1007	1007	3600	43112	756	70	84	84	84
Riote	Ronark Land	974	974	3600	43112	756	70	84	84	84
Riote	Ronark Land	986	986	3600	43112	756	70	84	84	84
Riote	Ronark Land	1054	1054	3600	43112	756	70	84	84	84
Riote	Ronark Land	1098	1098	3600	43112	756	70	84	84	84
Riote	Ronark Land	1000	1000	3600	43112	756	70	84	84	84
Ronark Land Monument	Ronark Land	1014	1014	30	150000	5000	80	250	250	250
Stone golem	Ronark Land	557	557	20	11000	720	100	50	50	50
Stone golem	Ronark Land	547	547	20	11000	720	100	50	50	50
Stone golem	Ronark Land	542	542	20	11000	720	100	50	50	50
Stone golem	Ronark Land	551	551	20	11000	720	100	50	50	50
Stone golem	Ronark Land	547	547	20	11000	720	100	50	50	50
Stone golem	Ronark Land	517	517	20	11000	720	100	50	50	50
Stone golem	Ronark Land	524	524	20	11000	720	100	50	50	50
Stone golem	Ronark Land	526	526	20	11000	720	100	50	50	50
Stone golem	Ronark Land	533	533	20	11000	720	100	50	50	50
Stone golem	Ronark Land	525	525	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1559	1559	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1551	1551	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1556	1556	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1564	1564	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1557	1557	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1570	1570	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1580	1580	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1585	1585	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1576	1576	20	11000	720	100	50	50	50
Stone golem	Ronark Land	1576	1576	20	11000	720	100	50	50	50
Titan	Ronark Land	466	466	20	20000	1638	130	25	25	255
Titan	Ronark Land	479	479	20	20000	1638	130	25	25	255
Titan	Ronark Land	486	486	20	20000	1638	130	25	25	255
Titan	Ronark Land	473	473	20	20000	1638	130	25	25	255
Titan	Ronark Land	474	474	20	20000	1638	130	25	25	255
Titan	Ronark Land	1459	1459	20	20000	1638	130	25	25	255
Titan	Ronark Land	1443	1443	20	20000	1638	130	25	25	255
Titan	Ronark Land	1439	1439	20	20000	1638	130	25	25	255
Titan	Ronark Land	1454	1454	20	20000	1638	130	25	25	255
Titan	Ronark Land	1449	1449	20	20000	1638	130	25	25	255
treant	Ronark Land	547	547	20	4773	405	55	85	160	120
treant	Ronark Land	550	550	20	4773	405	55	85	160	120
treant	Ronark Land	548	548	20	4773	405	55	85	160	120
treant	Ronark Land	541	541	20	4773	405	55	85	160	120
treant	Ronark Land	531	531	20	4773	405	55	85	160	120
treant	Ronark Land	521	521	20	4773	405	55	85	160	120
treant	Ronark Land	522	522	20	4773	405	55	85	160	120
treant	Ronark Land	526	526	20	4773	405	55	85	160	120
treant	Ronark Land	533	533	20	4773	405	55	85	160	120
treant	Ronark Land	540	540	20	4773	405	55	85	160	120
treant	Ronark Land	545	545	20	4773	405	55	85	160	120
treant	Ronark Land	538	538	20	4773	405	55	85	160	120
treant	Ronark Land	1514	1514	20	4773	405	55	85	160	120
treant	Ronark Land	1518	1518	20	4773	405	55	85	160	120
treant	Ronark Land	1508	1508	20	4773	405	55	85	160	120
treant	Ronark Land	1501	1501	20	4773	405	55	85	160	120
treant	Ronark Land	1501	1501	20	4773	405	55	85	160	120
treant	Ronark Land	1507	1507	20	4773	405	55	85	160	120
treant	Ronark Land	1482	1482	20	4773	405	55	85	160	120
treant	Ronark Land	1473	1473	20	4773	405	55	85	160	120
treant	Ronark Land	1473	1473	20	4773	405	55	85	160	120
treant	Ronark Land	1481	1481	20	4773	405	55	85	160	120
treant	Ronark Land	1490	1490	20	4773	405	55	85	160	120
treant	Ronark Land	1490	1490	20	4773	405	55	85	160	120
Troll	Ronark Land	140	140	30	41748	1296	90	175	175	175
Troll	Ronark Land	144	144	30	41748	1296	90	175	175	175
Troll	Ronark Land	160	160	30	41748	1296	90	175	175	175
Troll	Ronark Land	184	184	30	41748	1296	90	175	175	175
Troll	Ronark Land	180	180	30	41748	1296	90	175	175	175
Troll	Ronark Land	180	180	30	41748	1296	90	175	175	175
Troll	Ronark Land	160	164	30	41748	1296	90	175	175	175
Troll	Ronark Land	124	124	30	21556	315	70	56	56	56
Troll	Ronark Land	136	136	30	21556	315	70	56	56	56
Troll	Ronark Land	140	140	30	21556	315	70	56	56	56
Troll	Ronark Land	148	148	30	21556	315	70	56	56	56
Troll	Ronark Land	1916	1916	30	41748	1296	90	175	175	175
Troll	Ronark Land	1908	1908	30	41748	1296	90	175	175	175
Troll	Ronark Land	1912	1912	30	41748	1296	90	175	175	175
Troll	Ronark Land	1916	1916	30	41748	1296	90	175	175	175
Troll	Ronark Land	1916	1916	30	41748	1296	90	175	175	175
Troll	Ronark Land	1872	1872	30	41748	1296	90	175	175	175
Troll	Ronark Land	1880	1880	30	41748	1296	90	175	175	175
Troll	Ronark Land	1880	1880	30	41748	1296	90	175	175	175
Troll	Ronark Land	1888	1888	30	41748	1296	90	175	175	175
Troll	Ronark Land	1888	1888	30	41748	1296	90	175	175	175
Troll	Ronark Land	136	136	30	41748	1296	90	175	175	175
Troll	Ronark Land	152	152	30	41748	1296	90	175	175	175
Troll	Ronark Land	140	140	30	41748	1296	90	175	175	175
Troll	Ronark Land	152	152	30	41748	1296	90	175	175	175
Troll	Ronark Land	156	156	30	41748	1296	90	175	175	175
Troll	Ronark Land	168	168	30	41748	1296	90	175	175	175
Troll	Ronark Land	180	180	30	41748	1296	90	175	175	175
Troll	Ronark Land	188	188	30	41748	1296	90	175	175	175
Troll	Ronark Land	184	184	30	41748	1296	90	175	175	175
Troll	Ronark Land	188	188	30	41748	1296	90	175	175	175
Troll	Ronark Land	132	132	30	41748	1296	90	175	175	175
Troll	Ronark Land	144	144	30	41748	1296	90	175	175	175
Troll	Ronark Land	120	120	30	41748	1296	90	175	175	175
Troll	Ronark Land	1916	1916	30	41748	1296	90	175	175	175
Troll	Ronark Land	1924	1924	30	41748	1296	90	175	175	175
Troll	Ronark Land	1908	1908	30	41748	1296	90	175	175	175
Troll	Ronark Land	1912	1912	30	41748	1296	90	175	175	175
Troll	Ronark Land	1920	1920	30	41748	1296	90	175	175	175
Troll	Ronark Land	1900	1900	30	41748	1296	90	175	175	175
Troll	Ronark Land	1908	1908	30	41748	1296	90	175	175	175
Troll	Ronark Land	1900	1900	30	41748	1296	90	175	175	175
Troll	Ronark Land	1912	1912	30	41748	1296	90	175	175	175
Troll	Ronark Land	1908	1908	30	41748	1296	90	175	175	175
Troll	Ronark Land	1868	1868	30	41748	1296	90	175	175	175
Troll	Ronark Land	1880	1880	30	41748	1296	90	175	175	175
Troll	Ronark Land	1880	1880	30	41748	1296	90	175	175	175
Troll	Ronark Land	1884	1884	30	41748	1296	90	175	175	175
Troll	Ronark Land	1880	1880	30	41748	1296	90	175	175	175
Troll	Ronark Land	1928	1928	30	41748	1296	90	175	175	175
Troll	Ronark Land	1936	1936	30	41748	1296	90	175	175	175
Troll	Ronark Land	1932	1932	30	41748	1296	90	175	175	175
Troll	Ronark Land	1932	1932	30	41748	1296	90	175	175	175
Troll	Ronark Land	1936	1936	30	41748	1296	90	175	175	175
Troll Warrior	Ronark Land	116	116	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	136	136	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	136	136	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	128	128	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	136	136	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	140	140	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	164	164	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	160	160	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	156	156	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	156	156	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1892	1892	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1892	1892	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1920	1920	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1928	1928	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1932	1932	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1932	1932	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1928	1928	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1880	1880	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1896	1896	30	38190	360	80	56	56	56
Troll Warrior	Ronark Land	1892	1892	30	38190	360	80	56	56	56
DARK MARE	Ronark Land	79	125	60	49847	2088	145	600	800	800
DARK MARE	Ronark Land	87	131	60	49847	2088	145	600	800	800
DARK MARE	Ronark Land	86	119	60	49847	2088	145	600	800	800
DARK MARE	Ronark Land	87	117	60	49847	2088	145	600	800	800
DREAD MARE	Ronark Land	127	179	60	162283	3465	175	1200	1400	1400
DREAD MARE	Ronark Land	196	250	60	162283	3465	175	1200	1400	1400
DREAD MARE	Ronark Land	139	190	60	162283	3465	175	1200	1400	1400
DREAD MARE	Ronark Land	218	271	60	162283	3465	175	1200	1400	1400
Anger	Bifrost	0	0	?	81009	2525	145	0	0	0
Ego	Bifrost	0	0	?	35000	2015	110	0	0	0
Envy	Bifrost	0	0	?	160355	5077	190	0	0	0
ethiroth	Bifrost	0	0	?	21510	1350	110	0	0	0
Glutton	Bifrost	0	0	?	61775	2234	130	0	0	0
Greed	Bifrost	0	0	?	217755	6073	210	0	0	0
Lust	Bifrost	0	0	?	120533	4055	175	0	0	0
Wrath	Bifrost	0	0	?	125970	1242	130	0	0	0`;

  // Veriyi parse et ve grupla
  const parseAndGroupMonsters = useMemo(() => {
    const lines = rawMonsterData.trim().split('\n');
    const monsterMap = new Map();

    // Zone normalize fonksiyonu - benzer zone'ları birleştir
    const normalizeZone = (zone) => {
      const normalized = zone.trim();
      // Karus Eslant ve El Morad Eslant -> Karus/Human Eslant
      if (normalized === 'Karus Eslant' || normalized === 'El Morad Eslant') {
        return 'Karus/Human Eslant';
      }
      // El Morad Castle ve Luferson Castle -> Luferson/Elmorad Castle
      if (normalized === 'El Morad Castle' || normalized === 'Luferson Castle') {
        return 'Luferson/Elmorad Castle';
      }
      // Desperation Abyss -> Delos
      if (normalized === 'Desperation Abyss') {
        return 'Delos';
      }
      return normalized;
    };

    lines.forEach(line => {
      const parts = line.split('\t');
      if (parts.length >= 8) {
        // Monster ismini normalize et (trim ve boşlukları normalize et)
        const name = parts[0].trim().replace(/\s+/g, ' ');
        const originalZone = parts[1].trim();
        const zone = normalizeZone(originalZone); // Zone'u normalize et
        // X, Y, FR, GR, LR atlanıyor - sadece şunlar alınıyor:
        const respawnStr = parts[4]?.trim();
        const respawn = respawnStr === '?' ? '?' : (parseInt(respawnStr) || 0);
        const hp = parseInt(parts[5]) || 0;
        const def = parseInt(parts[6]) || 0;
        const level = parseInt(parts[7]) || 0;

        // Aynı isimli monster varsa, sadece zone'u ekle (tek bir entry olacak)
        if (monsterMap.has(name)) {
          const existing = monsterMap.get(name);
          // Zone'u ekle (duplicate kontrolü)
          if (!existing.zones.includes(zone)) {
            existing.zones.push(zone);
          }
          // Diğer stat'ları güncelleme (ilk görülen değerleri kullan)
        } else {
          // Yeni monster ekle (tek seferlik)
          monsterMap.set(name, {
            name,
            zones: [zone],
            respawn,
            hp,
            def,
            level,
          });
        }
      }
    });

    // Map'i array'e çevir ve zone'ları sırala
    const result = Array.from(monsterMap.values()).map(monster => ({
      ...monster,
      zones: monster.zones.sort(),
    }));

    // Level'a göre sırala
    return result.sort((a, b) => a.level - b.level);
  }, []);

  // Zone listesini çıkar - Normalize edilmiş zone'lar
  const allZones = useMemo(() => {
    // Normalize edilmiş zone'lar (Karus Eslant ve El Morad Eslant -> Karus/Human Eslant, El Morad Castle ve Luferson Castle -> Luferson/Elmorad Castle)
    const allowedZones = ['Moradon', 'Karus/Human Eslant', 'Luferson/Elmorad Castle', 'Ronark Land', 'Delos', 'Hell Abyss', 'Bifrost'];
    return ['Tümü', ...allowedZones];
  }, []);

  // Filtreleme - Normalize edilmiş zone'lardaki monster'lar
  const filteredMonsters = useMemo(() => {
    const allowedZones = ['Moradon', 'Karus/Human Eslant', 'Luferson/Elmorad Castle', 'Ronark Land', 'Delos', 'Hell Abyss', 'Bifrost'];
    
    // Önce sadece izin verilen zone'larda olan monster'ları filtrele
    let filtered = parseAndGroupMonsters.filter(monster => {
      return monster.zones.some(zone => allowedZones.includes(zone));
    });

    // Zone filtresi
    if (selectedZone !== 'Tümü') {
      filtered = filtered.filter(monster => monster.zones.includes(selectedZone));
    }

    // Arama filtresi
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(monster =>
        monster.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [parseAndGroupMonsters, selectedZone, searchQuery]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={styles.tabContent}>
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>👹 Knight Online Monster</Text>
        <Text style={styles.sectionDescription}>
          Monster bilgilerini filtreleyebilir ve arayabilirsiniz
        </Text>

        {/* Arama Kutusu */}
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Monster adı ara..."
            placeholderTextColor="#8E97A8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Zone Filtresi */}
        <View style={styles.card}>
          <Text style={styles.eventName}>📍 Zone Filtresi</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {allZones.map((zone) => (
              <TouchableOpacity
                key={zone}
                style={[
                  styles.monsterZoneButton,
                  selectedZone === zone && styles.monsterZoneButtonActive
                ]}
                onPress={() => setSelectedZone(zone)}
              >
                <Text
                  style={[
                    styles.monsterZoneButtonText,
                    selectedZone === zone && styles.monsterZoneButtonTextActive
                  ]}
                >
                  {zone}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Monster Tablosu */}
        <View style={styles.card}>
          <Text style={styles.eventName}>📊 Monster Listesi ({filteredMonsters.length})</Text>
          
          {filteredMonsters.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Monster bulunamadı</Text>
            </View>
          ) : (
            <>
              {/* Tablo Başlığı */}
              <View style={styles.monsterTableHeader}>
                <Text style={[styles.monsterTableHeaderText, { flex: 2 }]}>AD</Text>
                <Text style={[styles.monsterTableHeaderText, { flex: 1 }]}>LEVEL</Text>
                <Text style={[styles.monsterTableHeaderText, { flex: 1.2 }]}>HP</Text>
                <Text style={[styles.monsterTableHeaderText, { flex: 1 }]}>DEF</Text>
                <Text style={[styles.monsterTableHeaderText, { flex: 1 }]}>RESPAWN</Text>
                <Text style={[styles.monsterTableHeaderText, { flex: 2 }]}>KONUM</Text>
              </View>

              {/* Tablo İçeriği */}
              {filteredMonsters.map((monster, index) => (
                <View
                  key={index}
                  style={[
                    styles.monsterTableRow,
                    index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                  ]}
                >
                  <Text style={[styles.monsterTableCell, { flex: 2, fontWeight: 'bold' }]}>
                    {monster.name}
                  </Text>
                  <Text style={[styles.monsterTableCell, { flex: 1 }]}>
                    {monster.level}
                  </Text>
                  <Text style={[styles.monsterTableCell, { flex: 1.2 }]}>
                    {monster.hp.toLocaleString()}
                  </Text>
                  <Text style={[styles.monsterTableCell, { flex: 1 }]}>
                    {monster.def.toLocaleString()}
                  </Text>
                  <Text style={[styles.monsterTableCell, { flex: 1 }]}>
                    {monster.respawn === 0 ? '-' : monster.respawn === '?' ? '?' : monster.respawn}
                  </Text>
                  <Text style={[styles.monsterTableCell, { flex: 2, fontSize: 10 }]}>
                    {monster.zones.join(', ')}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// Görevler Bileşeni
const GorevlerScreen = () => {
  const [selectedLevelRange, setSelectedLevelRange] = useState('1-35');
  const [searchQuery, setSearchQuery] = useState('');

  // Görev verileri
  // 1-35 Seviye Görevleri - DÜZENLENMİŞ
  const gorevler1_35 = [
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
      case 'Tümü': return tumGorevler;
      default: return gorevler1_35;
    }
  };

  const filteredGorevler = getFilteredGorevler().filter(gorev => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      gorev.baslik.toLowerCase().includes(query) ||
      gorev.npc.toLowerCase().includes(query) ||
      gorev.aciklama.toLowerCase().includes(query) ||
      gorev.seviye.toLowerCase().includes(query)
    );
  });

  return (
    <View style={{flex: 1, backgroundColor: '#07070C'}}>
      <View style={styles.tabContent}>
        <View style={{ paddingTop: 70 }} />
        <Text style={styles.homeTitle}>📋 Knight Online Görevleri</Text>
        
        {/* Seviye Filtreleme Butonları */}
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>Seviye Aralığı: {selectedLevelRange}</Text>
          <Text style={styles.gorevSayisi}>Toplam {filteredGorevler.length} görev</Text>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.levelButtonsContainer}
        >
          {['1-35', '35-59', '60-70', '71-83', 'Tümü'].map((range) => (
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
                {range}
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
        <ScrollView 
          style={styles.gorevListContainer}
          showsVerticalScrollIndicator={true}
        >
          {filteredGorevler.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>Görev bulunamadı</Text>
            </View>
          ) : (
            filteredGorevler.map((gorev, index) => (
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
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
};

// Goldbar Fiyatları Bileşeni
const GoldbarPrices = () => {
  const [gbPrices, setGbPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const webViewRef = useRef(null);

  const fetchGbPrices = useCallback(() => {
    setLoading(true);
    setError(null);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, []);

  useEffect(() => {
    fetchGbPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const injectedJavaScript = `
    (function() {
      function extractPrices() {
        try {
          const table = document.querySelector('table');
          if (!table) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Tablo bulunamadı' }));
            return;
          }

          const rows = Array.from(table.querySelectorAll('tr'));
          const prices = [];
          
          // İlk satır header, onu atla
          for (let i = 1; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('td'));
            if (cells.length < 3) continue;
            
            // Site adını al (ilk hücre)
            const siteNameCell = cells[0];
            let siteName = siteNameCell.textContent.trim();
            
            // Link varsa al
            const linkElement = siteNameCell.querySelector('a');
            const link = linkElement ? linkElement.href : '';
            
            // Site adından link metnini temizle
            if (linkElement) {
              siteName = linkElement.textContent.trim();
            }
            
            // Resim varsa alt text'i al
            const img = siteNameCell.querySelector('img');
            if (img && img.alt) {
              siteName = img.alt.trim();
            }
            
            // Site ismini temizle ve düzelt
            siteName = siteName.trim();
            // klassgame -> klasgame düzeltmesi
            siteName = siteName.replace(/klassgame/gi, 'klasgame');
            
            // Fiyatları al - her server için Satış ve Alış var
            const serverPrices = {};
            const servers = ['ZERO', 'AGARTHA', 'FELIS', 'PANDORA', 'DESTAN', 'OREADS', 'MINARK', 'DRYADS'];
            
            // İkinci hücreden başla (birinci hücre site adı)
            let priceIndex = 1;
            for (let j = 0; j < servers.length && priceIndex + 1 < cells.length; j++) {
              const server = servers[j];
              const satisCell = cells[priceIndex];
              const alisCell = cells[priceIndex + 1];
              
              if (satisCell && alisCell) {
                const satis = satisCell.textContent.trim().replace(/\s*TL\s*/gi, '').trim();
                const alis = alisCell.textContent.trim().replace(/\s*TL\s*/gi, '').trim();
                
                if (satis || alis) {
                  serverPrices[server] = {
                    satis: satis || '-',
                    alis: alis || '-'
                  };
                }
              }
              priceIndex += 2;
            }
            
            if (siteName && Object.keys(serverPrices).length > 0) {
              prices.push({
                site: siteName,
                link: link,
                prices: serverPrices
              });
            }
          }
          
          if (prices.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ prices: prices }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Fiyat verisi bulunamadı' }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Parse hatası: ' + e.message }));
        }
      }
      
      // Sayfa yüklendikten sonra çalıştır
      if (document.readyState === 'complete') {
        setTimeout(extractPrices, 2000);
      } else {
        window.addEventListener('load', function() {
          setTimeout(extractPrices, 2000);
        });
      }
    })();
    true;
  `;

  const handleMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.error) {
        setError(data.error);
        setLoading(false);
      } else if (data.prices) {
        setGbPrices(data.prices);
        setLastUpdate(new Date());
        setLoading(false);
      }
    } catch (e) {
      setError('Veri parse edilemedi');
      setLoading(false);
    }
  }, []);

  const servers = ['ZERO', 'AGARTHA', 'FELIS', 'PANDORA', 'DESTAN', 'OREADS', 'MINARK', 'DRYADS'];

  return (
    <View>
      {/* Gizli WebView - Veri çekmek için */}
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://korehberi.com/en-ucuz-gb' }}
        style={{ position: 'absolute', height: 1, width: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
      />
      
      {/* Güncelle Butonu */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={styles.muted}>
          {lastUpdate ? `Son güncelleme: ${lastUpdate.toLocaleTimeString('tr-TR')}` : 'Fiyatlar yükleniyor...'}
        </Text>
        <TouchableOpacity 
          style={[
            styles.linkButton, 
            { paddingHorizontal: 15, paddingVertical: 8 },
            loading && { opacity: 0.6 }
          ]}
          onPress={fetchGbPrices}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.linkButtonText}>
            {loading ? '⏳ Yükleniyor...' : '🔄 Güncelle'}
          </Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.card}>
          <Text style={[styles.eventName, { color: '#e74c3c' }]}>❌ Hata</Text>
          <Text style={styles.muted}>{error}</Text>
        </View>
      )}

      {loading && !error && (
        <View style={styles.card}>
          <Text style={styles.eventName}>⏳ Fiyatlar yükleniyor...</Text>
        </View>
      )}

      {!loading && !error && gbPrices.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginBottom: 20 }}>
          <View>
            {/* Tablo Header */}
            <View style={styles.gbTableHeader}>
              <Text style={[styles.gbTableHeaderText, { width: 120 }]}>Site</Text>
              {servers.map((server) => (
                <View key={server} style={{ width: 150, alignItems: 'center' }}>
                  <Text style={[styles.gbTableHeaderText, { fontSize: 10, marginBottom: 2 }]}>{server}</Text>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={[styles.gbTableHeaderText, { width: 75, fontSize: 9 }]}>Satış</Text>
                    <Text style={[styles.gbTableHeaderText, { width: 75, fontSize: 9 }]}>Alış</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Tablo İçeriği */}
            {gbPrices.map((item, index) => (
              <View 
                key={index} 
                style={[
                  styles.gbTableRow,
                  index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd
                ]}
              >
                <Text style={[styles.gbTableCell, { width: 120, fontWeight: 'bold', fontSize: 11 }]}>
                  {item.site.toUpperCase().replace('KLASSGAME', 'KLASGAME')}
                </Text>
                {servers.map((server) => {
                  const serverData = item.prices[server];
                  return (
                    <View key={server} style={{ width: 150, flexDirection: 'row' }}>
                      <Text style={[styles.gbTableCell, { width: 75, fontSize: 10, color: '#2ecc71', fontWeight: '600' }]}>
                        {serverData?.satis || '-'}
                      </Text>
                      <Text style={[styles.gbTableCell, { width: 75, fontSize: 10, color: '#e74c3c', fontWeight: '600' }]}>
                        {serverData?.alis || '-'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

// Merchant Alt Sekmeleri
const MerchantScreen = ({ activeSubTab, setActiveSubTab }) => {
  const merchantSubTabs = [
    { id: 'pazar', icon: '💰', label: 'Pazar', url: 'https://www.uskopazar.com' },
    { id: 'goldbar', icon: '💎', label: 'Goldbar', url: 'https://www.enucuzgb.com' },
  ];

  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewTitle, setWebViewTitle] = useState('');

  const handleLinkPress = (url, title) => {
    setWebViewUrl(url);
    setWebViewTitle(title);
    setShowWebView(true);
  };

  if (showWebView) {
    return (
      <WebViewScreen 
        url={webViewUrl}
        title={webViewTitle}
        onBack={() => setShowWebView(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>💰 Merchant</Text>
        
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

        {activeSubTab === 'pazar' && (
          <ReklamBanner position="merchant" />
        )}
        
        {activeSubTab === 'goldbar' && (
          <ReklamBanner position="goldbar" />
        )}

        <View style={styles.card}>
          {activeSubTab === 'pazar' && (
            <>
              <Text style={styles.eventName}>💰 Pazar</Text>
              <Text style={styles.muted}>
                Knight Online item pazarı için aşağıdaki butona tıklayın:
              </Text>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => handleLinkPress('https://www.uskopazar.com', 'USKO Pazar')}
              >
                <Text style={styles.linkButtonText}>🌐 USKO PAZAR</Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'goldbar' && (
            <>
              <Text style={styles.eventName}>💎 Goldbar Fiyatları</Text>
              <Text style={styles.muted}>
                Knight Online sunucularındaki güncel goldbar fiyatları:
              </Text>
              <GoldbarPrices />
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// Karakter Alt Sekmeleri
const KarakterScreen = ({ activeSubTab, setActiveSubTab }) => {
  const karakterSubTabs = [
    { id: 'basitAtakHesaplama', icon: '⚔️', label: 'Basit Atak', url: 'https://www.kobugda.com/Calculator' },
    { id: 'skillHesaplama', icon: '🔮', label: 'Skill Hesapla', url: 'https://www.kobugda.com/SkillCalculator' },
    { id: 'charDiz', icon: '👤', label: 'Char Diz', url: 'https://www.kobugda.com/Calculator/Calculator' },
  ];

  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [webViewTitle, setWebViewTitle] = useState('');

  const handleLinkPress = (url, title) => {
    setWebViewUrl(url);
    setWebViewTitle(title);
    setShowWebView(true);
  };

  if (showWebView) {
    return (
      <WebViewScreen 
        url={webViewUrl}
        title={webViewTitle}
        onBack={() => setShowWebView(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>👤 Karakter</Text>
        
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

        {activeSubTab === 'basitAtakHesaplama' && (
          <ReklamBanner position="karakter" />
        )}
        
        {activeSubTab === 'skillHesaplama' && (
          <ReklamBanner position="skill" />
        )}
        
        {activeSubTab === 'charDiz' && (
          <ReklamBanner position="chardiz" />
        )}

        <View style={styles.card}>
          {activeSubTab === 'basitAtakHesaplama' && (
            <>
              <Text style={styles.eventName}>⚔️ Basit Atak Hesaplama</Text>
              <Text style={styles.muted}>
                Karakterinizin basit atak değerlerini hesaplamak için aşağıdaki butona tıklayın:
              </Text>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => handleLinkPress('https://www.kobugda.com/Calculator', 'Basit Atak Hesaplama')}
              >
                <Text style={styles.linkButtonText}>⚔️ Basit Atak Hesaplama </Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'skillHesaplama' && (
            <>
              <Text style={styles.eventName}>🔮 Skill Hesaplama</Text>
              <Text style={styles.muted}>
                Skill puanlarınızı hesaplamak ve dağıtmak için aşağıdaki butona tıklayın:
              </Text>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => handleLinkPress('https://www.kobugda.com/SkillCalculator', 'Skill Hesaplama')}
              >
                <Text style={styles.linkButtonText}>🔮 Skill Hesaplama </Text>
              </TouchableOpacity>
            </>
          )}
          
          {activeSubTab === 'charDiz' && (
            <>
              <Text style={styles.eventName}>👤 Char Diz</Text>
              <Text style={styles.muted}>
                Karakterinizi optimize etmek için char diz aracını kullanmak için aşağıdaki butona tıklayın:
              </Text>
              
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={() => handleLinkPress('https://www.kobugda.com/Calculator/Calculator', 'Char Diz')}
              >
                <Text style={styles.linkButtonText}>👤 Char Diz</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

// REHBER BİLEŞENİ
const RehberScreen = ({ activeSubTab, setActiveSubTab }) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [masterSubTab, setMasterSubTab] = useState('master'); // Master alt sekmesi
  const [alSkillStatSubTab, setAlSkillStatSubTab] = useState('skillstat'); // AL Skill Stat alt sekmesi (varsayılan: Skill-Stat)

  // Ana menü sekmeleri
  const mainMenuItems = [
    { id: 'master', icon: '⚔️', label: 'Master', hasSubMenu: true },
    { id: 'alskillstat', icon: '📈', label: 'Skil/Stat/Exp', hasSubMenu: true },
    { id: 'gorevler', icon: '📋', label: 'Görevler', hasSubMenu: false },
    { id: 'achievements', icon: '🏆', label: 'Achievements', hasSubMenu: false },
    { id: 'farm', icon: '💰', label: 'Farm Geliri Hesapla', hasSubMenu: false },
    { id: 'monster', icon: '👹', label: 'Knight Online Monster', hasSubMenu: false },
  ];

  // Master alt sekmeleri
  const masterSubTabs = [
    { id: 'master', icon: '⚔️', label: 'Master' },
    { id: 'masterSkill', icon: '🔮', label: 'Master Skill' },
  ];

  // AL Skill Stat alt sekmeleri
  const alSkillStatSubTabs = [
    { id: 'skillstat', icon: '📊', label: 'Skill-Stat' },
    { id: 'alskillstat', icon: '📈', label: 'Levele Göre Exp' },
    { id: 'rebirth', icon: '🔄', label: 'Rebirth Sistemi 83/1-15' },
  ];

  const renderContent = () => {
    // Eğer master sekmesi veya masterSkill seçiliyse, alt sekme içeriğini göster
    if (activeSubTab === 'master' || activeSubTab === 'masterSkill') {
      // activeSubTab değerine göre içerik göster
      if (activeSubTab === 'masterSkill') {
        return <MasterSkillScreen />;
      } else if (activeSubTab === 'master' || masterSubTab === 'master') {
        return <MasterScreen />;
      }
    }

    // Eğer AL Skill Stat, Skill-Stat veya Rebirth sekmesi seçiliyse, alt sekme içeriğini göster
    if (activeSubTab === 'alskillstat' || activeSubTab === 'skillstat' || activeSubTab === 'rebirth') {
      if (activeSubTab === 'skillstat') {
        return <SkillStatResetScreen />;
      } else if (activeSubTab === 'alskillstat') {
        return <ALSkillStatScreen />;
      } else if (activeSubTab === 'rebirth') {
        return <RebirthSystemScreen />;
      }
    }

    // Diğer sekmeler
    switch(activeSubTab) {
      case 'gorevler': 
        return <GorevlerScreen />;
      case 'achievements':
        return <AchievementsScreen />;
      case 'farm':
        return <FarmGeliriScreen />;
      case 'monster':
        return <MonsterScreen />;
      default:
        // Varsayılan: Hoş geldin mesajı
        return (
          <ScrollView style={styles.screen} contentContainerStyle={styles.rehberWelcomeContent}>
            <View style={styles.rehberWelcomeContainer}>
              <View style={styles.rehberWelcomeCard}>
                <Text style={styles.rehberWelcomeTitle}>📚 Rehber</Text>
                <Text style={styles.rehberWelcomeText}>
                  Aradığınız rehbere sol üstte bulunan menüden ulaşabilirsiniz.
                </Text>
              </View>
            </View>
          </ScrollView>
        );
    }
  };

  // İçerik seçili mi kontrol et
  const hasContentSelected = activeSubTab !== null && activeSubTab !== undefined;

  return (
    <View style={{flex: 1}}>
      {/* Hamburger Menü Butonu veya Geri Butonu - Sol Üst */}
      {hasContentSelected ? (
        // İçerik seçildiyse geri butonu göster
        <TouchableOpacity 
          style={styles.backButtonRehber}
          onPress={() => {
            setActiveSubTab(null);
            setMasterSubTab('master'); // Master alt sekmesini sıfırla
            setAlSkillStatSubTab('alskillstat'); // AL Skill Stat alt sekmesini sıfırla
            setMenuVisible(false);
          }}
        >
          <Text style={styles.backButtonTextRehber}>← Geri</Text>
        </TouchableOpacity>
      ) : (
        // İçerik seçilmediyse hamburger menü göster
        <TouchableOpacity 
          style={styles.hamburgerButton}
          onPress={() => setMenuVisible(!menuVisible)}
        >
          <View style={styles.hamburgerIcon}>
            <View style={[styles.hamburgerLine, menuVisible && styles.hamburgerLineActive]} />
            <View style={[styles.hamburgerLine, menuVisible && styles.hamburgerLineActive]} />
            <View style={[styles.hamburgerLine, menuVisible && styles.hamburgerLineActive]} />
          </View>
        </TouchableOpacity>
      )}

      {/* Hamburger Menü - Slide Menu */}
      {menuVisible && (
        <View style={styles.menuOverlay}>
          <TouchableOpacity 
            style={styles.menuBackdrop}
            onPress={() => setMenuVisible(false)}
            activeOpacity={1}
          />
          <View style={styles.menuDrawer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>📚 Rehber Menüsü</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <Text style={styles.menuCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.menuContent}>
              {mainMenuItems.map((item) => (
                <View key={item.id}>
                  <TouchableOpacity
                    style={[
                      styles.menuItem,
                      (activeSubTab === item.id || (item.id === 'master' && (activeSubTab === 'master' || activeSubTab === 'masterSkill')) || (item.id === 'alskillstat' && (activeSubTab === 'skillstat' || activeSubTab === 'alskillstat' || activeSubTab === 'rebirth'))) && styles.menuItemActive
                    ]}
                    onPress={() => {
                      if (item.id === 'master') {
                        setActiveSubTab('master');
                        setMasterSubTab('master'); // Varsayılan alt sekme
                      } else if (item.id === 'alskillstat') {
                        setActiveSubTab('skillstat'); // Varsayılan olarak Skill-Stat'i göster
                        setAlSkillStatSubTab('skillstat'); // Varsayılan alt sekme
                      } else {
                        setActiveSubTab(item.id);
                      }
                      setMenuVisible(false);
                    }}
                  >
                    <Text style={styles.menuItemIcon}>{item.icon}</Text>
                    <Text style={[
                      styles.menuItemText,
                      activeSubTab === item.id && styles.menuItemTextActive
                    ]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>

                  {/* Master alt sekmeleri - sadece master seçiliyse ve menü açıksa göster */}
                  {item.id === 'master' && (activeSubTab === 'master' || activeSubTab === 'masterSkill') && (
                    <View style={styles.subMenuContainer}>
                      {masterSubTabs.map((subTab) => (
                        <TouchableOpacity
                          key={subTab.id}
                          style={[
                            styles.subMenuItem,
                            (masterSubTab === subTab.id || activeSubTab === subTab.id) && styles.subMenuItemActive
                          ]}
                          onPress={() => {
                            setMasterSubTab(subTab.id);
                            setActiveSubTab(subTab.id);
                            setMenuVisible(false);
                          }}
                        >
                          <Text style={styles.subMenuItemIcon}>{subTab.icon}</Text>
                          <Text style={[
                            styles.subMenuItemText,
                            (masterSubTab === subTab.id || activeSubTab === subTab.id) && styles.subMenuItemTextActive
                          ]}>
                            {subTab.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* AL Skill Stat alt sekmeleri - sadece alskillstat seçiliyse ve menü açıksa göster */}
                  {item.id === 'alskillstat' && (activeSubTab === 'skillstat' || activeSubTab === 'alskillstat' || activeSubTab === 'rebirth') && (
                    <View style={styles.subMenuContainer}>
                      {alSkillStatSubTabs.map((subTab) => (
                        <TouchableOpacity
                          key={subTab.id}
                          style={[
                            styles.subMenuItem,
                            (alSkillStatSubTab === subTab.id || activeSubTab === subTab.id) && styles.subMenuItemActive
                          ]}
                          onPress={() => {
                            setAlSkillStatSubTab(subTab.id);
                            setActiveSubTab(subTab.id);
                            setMenuVisible(false);
                          }}
                        >
                          <Text style={styles.subMenuItemIcon}>{subTab.icon}</Text>
                          <Text style={[
                            styles.subMenuItemText,
                            (alSkillStatSubTab === subTab.id || activeSubTab === subTab.id) && styles.subMenuItemTextActive
                          ]}>
                            {subTab.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Master alt sekmeleri - Master seçiliyse göster */}
      {(activeSubTab === 'master' || activeSubTab === 'masterSkill') && (
        <View style={styles.masterSubTabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.masterSubTabContent}
          >
            {masterSubTabs.map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                style={[
                  styles.masterSubTabButton,
                  masterSubTab === tab.id && styles.masterSubTabButtonActive
                ]}
                onPress={() => {
                  setMasterSubTab(tab.id);
                  setActiveSubTab(tab.id);
                }}
              >
                <Text style={[
                  styles.masterSubTabIcon,
                  masterSubTab === tab.id && styles.masterSubTabIconActive
                ]}>
                  {tab.icon}
                </Text>
                <Text style={[
                  styles.masterSubTabText,
                  masterSubTab === tab.id && styles.masterSubTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* AL Skill Stat alt sekmeleri - AL Skill Stat, Skill-Stat veya Rebirth seçiliyse göster */}
      {(activeSubTab === 'alskillstat' || activeSubTab === 'skillstat' || activeSubTab === 'rebirth') && (
        <View style={styles.masterSubTabContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.masterSubTabContent}
          >
            {alSkillStatSubTabs.map((tab) => (
              <TouchableOpacity 
                key={tab.id}
                style={[
                  styles.masterSubTabButton,
                  alSkillStatSubTab === tab.id && styles.masterSubTabButtonActive
                ]}
                onPress={() => {
                  setAlSkillStatSubTab(tab.id);
                  setActiveSubTab(tab.id);
                }}
              >
                <Text style={[
                  styles.masterSubTabIcon,
                  alSkillStatSubTab === tab.id && styles.masterSubTabIconActive
                ]}>
                  {tab.icon}
                </Text>
                <Text style={[
                  styles.masterSubTabText,
                  alSkillStatSubTab === tab.id && styles.masterSubTabTextActive
                ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* İçerik */}
      <View style={styles.rehberContentContainer}>
        {renderContent()}
      </View>
    </View>
  );
};

// API Base URL
const API_BASE_URL = 'https://knightrehberapi.vercel.app/api';

// Güncelleme Notları Bileşeni
const GuncellemeNotlariScreen = () => {
  const [updateNotes, setUpdateNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUpdateNotes();
  }, []);

  const fetchUpdateNotes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/guncelleme-notlari`);
      
      if (!response.ok) {
        throw new Error('Güncelleme notları yüklenemedi');
      }
      
      const data = await response.json();
      setUpdateNotes(data || []);
    } catch (err) {
      console.error('Güncelleme notları hatası:', err);
      setError('Güncelleme notları yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabContent}>
        <Text style={styles.homeTitle}>📝 Güncelleme Notları</Text>
        
        {loading ? (
          <View style={styles.card}>
            <Text style={styles.muted}>Güncelleme notları yükleniyor...</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={[styles.muted, { color: '#FF6B6B' }]}>{error}</Text>
            <TouchableOpacity 
              style={[styles.linkButton, { marginTop: 15 }]}
              onPress={fetchUpdateNotes}
            >
              <Text style={styles.linkButtonText}>🔄 Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        ) : updateNotes.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.eventName}>📢 Henüz Güncelleme Notu Yok</Text>
            <Text style={styles.muted}>
              Güncelleme notları yakında eklenecek.
            </Text>
          </View>
        ) : (
          updateNotes.map((note, index) => (
            <View key={note.id || index} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <Text style={[
                  styles.eventName, 
                  note.importance === 'yuksek' && { color: '#FF6B6B' }
                ]}>
                  {note.importance === 'yuksek' ? '❗ ' : '📢 '}
                  {note.title || 'Güncelleme Notu'}
                </Text>
                {note.date || note.created_at ? (
                  <Text style={[styles.muted, { fontSize: 12 }]}>
                    {formatDate(note.date || note.created_at)}
                  </Text>
                ) : null}
              </View>
              
              {note.imageUrl ? (
                <Image 
                  source={{ uri: note.imageUrl }}
                  style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 10 }}
                  resizeMode="cover"
                />
              ) : null}
              
              <Text style={styles.muted}>
                {note.content || 'İçerik bulunamadı'}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  } = auth;

  const [splashVisible, setSplashVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('anasayfa');
  const [activeMerchantSubTab, setActiveMerchantSubTab] = useState('pazar');
  const [activeKarakterSubTab, setActiveKarakterSubTab] = useState('basitAtakHesaplama');
  const [activeRehberSubTab, setActiveRehberSubTab] = useState(null); // Başlangıçta null - hoş geldin mesajı göster
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Farm durumunu kontrol et ve eğer çalışıyorsa direkt Farm sekmesine yönlendir
  useEffect(() => {
    const checkFarmState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('farmState');
        if (savedState) {
          const state = JSON.parse(savedState);
          const savedStartTime = new Date(state.startTime);
          const now = new Date();
          const elapsed = Math.floor((now - savedStartTime) / 1000);
          
          // Eğer 1 saatlik modda ve süre dolmuşsa, durumu temizle
          if (state.mode === '1hour' && elapsed >= 3600) {
            await AsyncStorage.removeItem('farmState');
            return;
          }
          
          // Farm çalışıyorsa direkt Farm sekmesine yönlendir
          setActiveTab('rehber');
          setActiveRehberSubTab('farm');
        }
      } catch (error) {
        console.error('Farm durumu kontrol edilemedi:', error);
      }
    };
    
    checkFarmState();
  }, []);

  // ✅ ÖNEMLİ: Tüm hook'lar early return'lerden ÖNCE olmalı (React Hooks kuralları)
  // ✅ PERFORMANS: allTabs useMemo ile önbellekleniyor (sadece veri, JSX değil)
  const allTabs = useMemo(() => [
    { id: 'anasayfa', icon: '🏠', label: 'Anasayfa' },
    { id: 'alarm', icon: '⏰', label: 'Alarm' },
    { id: 'guncellemeNotlari', icon: '📝', label: 'Güncelleme Notları' },
    { id: 'merchant', icon: '💰', label: 'Merchant' },
    { id: 'karakter', icon: '👤', label: 'Karakter' },
    { id: 'rehber', icon: '📚', label: 'Rehber' },
  ], []); // Sadece bir kez oluştur

  // ✅ PERFORMANS: Event handler'lar useCallback ile önbellekleniyor
  const handleOpenSettings = useCallback(() => {
    setSettingsVisible(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsVisible(false);
  }, []);

  // Splash screen efekti
  useEffect(() => {
    if (splashVisible) {
      const timer = setTimeout(() => {
        setSplashVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [splashVisible]);

  // ✅ Early return'ler hook'lardan SONRA olmalı
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

  // SORUMLULUK REDDİ MODAL'INI İLK AÇILIŞTA GÖSTER
  if (showDisclaimer && !disclaimerAccepted) {
    return (
      <DisclaimerModal
        visible={showDisclaimer}
        onAccept={acceptDisclaimer}
      />
    );
  }

  // ✅ DÜZELTME: Component'ler useMemo içinde olmamalı (React Hooks kuralları)
  // Normal component fonksiyonu olarak tanımla
  const AnasayfaScreen = () => {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <View style={styles.tabContent}>
          <Text style={styles.homeTitle}>🏠 Hoş Geldiniz!</Text>

          <View style={styles.card}>
            <Text style={styles.eventName}>🎯 Knight Rehber'e Hoş Geldiniz</Text>
            <Text style={styles.muted}>
              Knight Online için kapsamlı rehber uygulaması. Etkinlik saatleri, merchant fiyatları, skill hesaplamaları ve daha fazlası!
            </Text>
          </View>

          <ReklamBanner position="home" />
          
          <TouchableOpacity 
            style={styles.reklamBanner} 
            onPress={() => {
              Linking.openURL('mailto:advertknightrehber@gmail.com?subject=Reklam İşbirliği&body=Merhaba, Knight Rehber uygulamasında reklam vermek istiyorum.').catch(err => 
                Alert.alert('Hata', 'E-posta uygulaması açılamadı.')
              );
            }}
          >
            <Text style={styles.reklamTitle}>📧 Bize Ulaşmak İçin Tıklayın</Text>
            <Text style={styles.reklamCta}>advertknightrehber@gmail.com</Text>
          </TouchableOpacity>

          <CekilisKutusu />
        </View>
      </ScrollView>
    );
  };

  // ✅ DÜZELTME: renderContent normal fonksiyon (useMemo içinde JSX döndürmek hook sırasını bozuyor)
  const renderContent = () => {
    switch(activeTab) {
      case 'anasayfa':
        return <AnasayfaScreen />;
      case 'alarm':
        return <AlarmScreen />;
      case 'guncellemeNotlari':
        return <GuncellemeNotlariScreen />;
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
      default:
        return <AnasayfaScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#07070C" barStyle="light-content" />

      <Header onOpenSettings={handleOpenSettings} />

      <View style={styles.content}>
        {renderContent()}
      </View>

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

      <SettingsModal
        visible={settingsVisible}
        onClose={handleCloseSettings}
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
  scrollContent: {
    paddingBottom: 100,
  },
  tabContent: {
    flex: 1,
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
  headerPlaceholder: {
    width: 60,
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
  // Debug Kontrol Stilleri
  debugControls: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  debugButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusText: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusActive: {
    color: '#25D366',
  },
  statusInactive: {
    color: '#FF6B6B',
  },
  statusDetail: {
    color: '#8E97A8',
    fontSize: 11,
    lineHeight: 16,
  },
  // Reklam Banner Stilleri
  reklamBannerContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  reklamBannerImage: {
    width: '100%',
    height: 150,
    backgroundColor: 'transparent',
  },
  reklamPlaceholder: {
    backgroundColor: 'rgba(255, 214, 107, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFD66B',
    borderStyle: 'dashed',
  },
  reklamPlaceholderIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  reklamPlaceholderText: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  reklamPlaceholderSubtext: {
    color: '#8E97A8',
    fontSize: 12,
    textAlign: 'center',
  },
  reklamBannerWrapper: {
    width: '100%',
  },
  reklamBanner: {
    backgroundColor: '#FFD66B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFA726',
  },
  reklamTitle: {
    color: '#0B0B0B',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  reklamCta: {
    color: '#0B0B0B',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Link Button
  linkButton: {
    backgroundColor: '#2D3748',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#475467',
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    marginBottom: 4,
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
  etkinlikTime: {
    color: '#8E97A8',
    fontSize: 14,
    marginBottom: 4,
  },
  etkinlikDays: {
    color: '#FFD66B',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
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
  // Settings Tabs
  settingsTabs: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  settingsTab: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  settingsTabActive: {
    backgroundColor: '#FFD66B',
  },
  settingsTabText: {
    color: '#8E97A8',
    fontSize: 14,
    fontWeight: '600',
  },
  settingsTabTextActive: {
    color: '#0B0B0B',
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
  permissionButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
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
  contactButtonFull: {
    backgroundColor: '#2D3748',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#475467',
  },
  contactButtonText: {
    color: '#FFD66B',
    fontSize: 14,
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
  
  // GÖREVLER İÇİN STİLLER
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
  noResults: {
    padding: 20,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#8E97A8',
    fontSize: 16,
    textAlign: 'center',
  },
  // WebView Styles
  webview: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  // Modal Stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1D24',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  modalTitle: {
    color: '#FFD66B',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#2D3748',
  },
  // Gün Seçimi Stilleri
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  dayButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#2D3748',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3e3e3e',
  },
  dayButtonSelected: {
    backgroundColor: '#FFD66B',
    borderColor: '#FFD66B',
  },
  dayButtonText: {
    color: '#8E97A8',
    fontSize: 14,
    fontWeight: '600',
  },
  dayButtonTextSelected: {
    color: '#07070C',
    fontWeight: 'bold',
  },
  // Etkinlik Seçimi Stilleri
  eventSelector: {
    marginBottom: 16,
  },
  eventList: {
    maxHeight: 200,
    marginTop: 8,
  },
  eventOption: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2D3748',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3e3e3e',
  },
  eventOptionSelected: {
    backgroundColor: '#FFD66B',
    borderColor: '#FFD66B',
  },
  eventOptionName: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventOptionNameSelected: {
    color: '#07070C',
  },
  eventOptionDescription: {
    color: '#8E97A8',
    fontSize: 12,
  },
  eventOptionDescriptionSelected: {
    color: '#07070C',
  },
  eventOptionTime: {
    color: '#8E97A8',
    fontSize: 11,
    marginTop: 4,
  },
  eventOptionTimeSelected: {
    color: '#07070C',
  },
  // Switch Container
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  switchLabel: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: '600',
  },
  // Label
  label: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  // Input
  input: {
    backgroundColor: '#2D3748',
    borderWidth: 1,
    borderColor: '#475467',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 8,
  },
  // Button
  button: {
    backgroundColor: '#FFD66B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Button Text
  buttonText: {
    color: '#07070C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Hamburger Menu Styles
  hamburgerButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
    backgroundColor: '#1A1D24',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  hamburgerIcon: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
  },
  hamburgerLine: {
    height: 3,
    backgroundColor: '#FFD66B',
    borderRadius: 2,
    width: '100%',
    marginBottom: 3,
  },
  hamburgerLineActive: {
    backgroundColor: '#f39c12',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    flexDirection: 'row',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuDrawer: {
    width: 280,
    backgroundColor: '#1A1D24',
    borderRightWidth: 1,
    borderRightColor: '#2D3748',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
    backgroundColor: '#0B0B0B',
  },
  menuTitle: {
    color: '#FFD66B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuCloseButton: {
    color: '#8E97A8',
    fontSize: 24,
    fontWeight: 'bold',
  },
  menuContent: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  menuItemActive: {
    backgroundColor: '#2D3748',
    borderLeftWidth: 4,
    borderLeftColor: '#FFD66B',
  },
  menuItemIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#FFD66B',
    fontWeight: 'bold',
  },
  subMenuContainer: {
    backgroundColor: '#0B0B0B',
    paddingLeft: 20,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingLeft: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  subMenuItemActive: {
    backgroundColor: '#2D3748',
    borderLeftWidth: 3,
    borderLeftColor: '#FFD66B',
  },
  subMenuItemIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  subMenuItemText: {
    color: '#8E97A8',
    fontSize: 14,
  },
  subMenuItemTextActive: {
    color: '#FFD66B',
    fontWeight: '600',
  },
  // Back Button Rehber
  backButtonRehber: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1000,
    backgroundColor: '#1A1D24',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonTextRehber: {
    color: '#FFD66B',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Master Sub Tab Styles
  masterSubTabContainer: {
    backgroundColor: '#0B0B0B',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1D24',
    paddingVertical: 8,
    marginTop: 70, // Geri butonunun altına (buton yüksekliği + padding)
  },
  masterSubTabContent: {
    paddingHorizontal: 8,
  },
  masterSubTabButton: {
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
  masterSubTabButtonActive: {
    backgroundColor: '#FFD66B',
  },
  masterSubTabIcon: {
    fontSize: 16,
    color: '#8E97A8',
    marginRight: 6,
  },
  masterSubTabIconActive: {
    color: '#0B0B0B',
  },
  masterSubTabText: {
    color: '#8E97A8',
    fontSize: 12,
    fontWeight: '600',
  },
  masterSubTabTextActive: {
    color: '#0B0B0B',
  },
  // Rehber Welcome Styles
  rehberWelcomeContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 60, // Hamburger butonunun altına yer açmak için
  },
  rehberWelcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  rehberWelcomeCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2D3748',
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  rehberWelcomeTitle: {
    color: '#FFD66B',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  rehberWelcomeText: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
  },
  rehberContentContainer: {
    flex: 1,
    paddingTop: 0, // İçerik alanı için padding
  },
  // Levele Göre Exp Table Styles
  expTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#475467',
  },
  expTableHeaderText: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 2,
  },
  expTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
    minHeight: 32,
  },
  expTableCell: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  // Goldbar Table Styles
  gbTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#475467',
  },
  gbTableHeaderText: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 2,
  },
  gbTableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
    alignItems: 'center',
  },
  gbTableCell: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    marginHorizontal: 2,
  },
  // Farm Geliri Hesapla Styles
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#FFD66B',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#475467',
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#FFD66B',
  },
  modeButtonText: {
    color: '#8E97A8',
    fontSize: 14,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: '#0B0B0B',
  },
  timerContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1A1D24',
    borderRadius: 12,
    marginBottom: 16,
  },
  timerText: {
    color: '#FFD66B',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  timerLabel: {
    color: '#8E97A8',
    fontSize: 14,
    marginTop: 8,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  controlButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#6BCF7F',
  },
  stopButton: {
    backgroundColor: '#FF6B6B',
  },
  resetButton: {
    backgroundColor: '#8E97A8',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  modalTitle: {
    color: '#FFD66B',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#8E97A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalScroll: {
    maxHeight: 500,
  },
  calculateButton: {
    backgroundColor: '#FFD66B',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  calculateButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#8E97A8',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#0B0B0B',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  resultTitle: {
    color: '#FFD66B',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  resultLabel: {
    color: '#8E97A8',
    fontSize: 14,
    flex: 1,
  },
  resultValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  resultValuePositive: {
    color: '#6BCF7F',
  },
  resultValueNegative: {
    color: '#FF6B6B',
  },
  resultValueLarge: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#2D3748',
    marginVertical: 12,
  },
  labelWithInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    width: '100%',
  },
  infoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFD66B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    padding: 0,
    minWidth: 32,
    minHeight: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  infoButtonText: {
    color: '#0B0B0B',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoModalContent: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 24,
    minWidth: 250,
    maxWidth: 350,
    borderWidth: 1,
    borderColor: '#2D3748',
    alignItems: 'center',
  },
  infoModalText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoModalCloseButton: {
    backgroundColor: '#FFD66B',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  infoModalCloseButtonText: {
    color: '#0B0B0B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Monster Screen Styles
  monsterTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2D3748',
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 2,
  },
  monsterTableHeaderText: {
    color: '#FFD66B',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  monsterTableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  monsterTableCell: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#8E97A8',
    fontSize: 16,
  },
  monsterZoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2D3748',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3A4553',
  },
  monsterZoneButtonActive: {
    backgroundColor: '#FFD66B',
    borderColor: '#FFD66B',
  },
  monsterZoneButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  monsterZoneButtonTextActive: {
    color: '#0B0B0B',
    fontWeight: 'bold',
  },
});

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
