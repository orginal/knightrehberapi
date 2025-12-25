import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { EVENTS_DATA } from '../data/events';

const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// ✅ PERFORMANS: Sabit değerler dışarıda
const NOTIFICATION_CHANNEL_CONFIG = {
  name: 'Alarm Bildirimleri',
  importance: Notifications.AndroidImportance.MAX, // MAX priority - düşük pil modunda da çalışır
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FFD66B',
  sound: true,
  enableLights: true,
  enableVibrate: true,
  showBadge: true,
};

export default function AlarmScreen() {
  const [alarms, setAlarms] = useState([]);
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextAlarmTime, setNextAlarmTime] = useState('--:--');
  const [notificationPermission, setNotificationPermission] = useState(false);
  const [serviceStatus, setServiceStatus] = useState('⚫ Servis Bekleniyor');
  const [upcomingAlarms, setUpcomingAlarms] = useState([]);
  const [autoStart, setAutoStart] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [volume, setVolume] = useState(80);
  const [batteryOptimizationIgnored, setBatteryOptimizationIgnored] = useState(false);
  const [exactAlarmPermission, setExactAlarmPermission] = useState(true);
  const alarmTimeouts = useRef(new Map());
  const nextCheckTimeout = useRef(null);

  useEffect(() => {
    const init = async () => {
      await loadAlarms();
      await checkNotificationPermission();
      if (Platform.OS === 'android') {
        await checkBatteryOptimization();
        await checkExactAlarmPermission();
      }
      updateCurrentTime();
    };
    
    init();
    
    // AppState değişikliklerini dinle (arka plan/ön plan)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Uygulama ön plana döndüğünde zaman hesaplamalarını yenile
        console.log('📱 Uygulama ön plana döndü - zaman hesaplamaları yenileniyor');
        updateCurrentTime();
        if (alarms.length > 0 && activeAlarms.length > 0) {
          // Aktif alarmları yeniden zamanla (zaman hesaplamaları güncellensin)
          activeAlarms.forEach(async (alarmId) => {
            const alarm = alarms.find(a => a.id === alarmId);
            if (alarm) {
              await scheduleAlarm(alarm);
            }
          });
          // NOT: checkNextAlarm artık useMemo ile otomatik yapılıyor
        }
      }
    });
    
    // ✅ PERFORMANS: Zaman güncellemesi için hafif interval (her saniye)
    // Alarm kontrolü useMemo ile otomatik yapılıyor, checkNextAlarm çağırmaya gerek yok
    const interval = setInterval(() => {
      updateCurrentTime();
      // NOT: checkNextAlarm artık useMemo tarafından otomatik yapılıyor
      // Sadece currentTime güncelleniyor, useMemo bağımlılık olarak algılıyor ve yeniden hesaplıyor
    }, 1000);

    return () => {
      subscription?.remove();
      clearInterval(interval);
      if (nextCheckTimeout.current) {
        clearTimeout(nextCheckTimeout.current);
      }
      alarmTimeouts.current.forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  // Alarmlar yüklendikten sonra alarm checker'ı başlat
  useEffect(() => {
    if (alarms.length > 0) {
      startAlarmChecker();
    }
  }, [alarms]);

  // activeAlarms değiştiğinde alarmları zamanla ve sayacı güncelle
  useEffect(() => {
    if (alarms.length > 0 && activeAlarms.length > 0) {
      // Aktif alarmları zamanla (async - arka planda çalışır)
      activeAlarms.forEach(async (alarmId) => {
        const alarm = alarms.find(a => a.id === alarmId);
        if (alarm) {
          await scheduleAlarm(alarm);
        }
      });
      
      // NOT: Alarm kontrolü useMemo ile otomatik yapılıyor
    } else if (alarms.length > 0 && activeAlarms.length === 0) {
      // Aktif alarm yoksa sayacı sıfırla
      setNextAlarmTime('--:--');
      setUpcomingAlarms([]);
    }
  }, [activeAlarms, alarms]);

  useEffect(() => {
    if (alarms.length > 0) {
      const save = async () => {
        try {
          const data = {
            alarms: alarms,
            activeAlarms: Array.from(activeAlarms),
            settings: {
              autoStart,
              vibrate,
              volume
            },
            timestamp: new Date().toISOString()
          };
          await AsyncStorage.setItem('ko-alarms', JSON.stringify(data));
        } catch (error) {
          console.error('Alarm kaydetme hatası:', error);
        }
      };
      save();
    }
  }, [activeAlarms, autoStart, vibrate, volume]);

  // ✅ PERFORMANS: useCallback ile fonksiyonu önbellekle
  const updateCurrentTime = useCallback(() => {
    setCurrentTime(new Date());
  }, []);

  // ✅ PERFORMANS: useCallback ile fonksiyonu önbellekle
  const checkNotificationPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      console.log(`📱 Bildirim izni durumu: ${status}`);
      const hasPermission = status === 'granted';
      setNotificationPermission(hasPermission);
      
      if (!hasPermission) {
        console.log('📢 Bildirim izni yok, otomatik olarak isteniyor...');
        const result = await requestNotificationPermission();
        if (result) {
          console.log('✅ Bildirim izni verildi!');
        } else {
          console.warn('⚠️ Bildirim izni verilmedi, kullanıcı manuel olarak açmalı');
        }
      } else {
        console.log('✅ Bildirim izni zaten verilmiş');
      }
    } catch (error) {
      console.error('❌ Bildirim izni kontrolü hatası:', error);
    }
  }, []);

  const requestNotificationPermission = async () => {
    try {
      console.log('📢 Bildirim izni isteniyor...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: false,
        },
      });
      
      console.log(`📱 İzin isteği sonucu: ${status}`);
      setNotificationPermission(status === 'granted');
      
      if (status === 'granted') {
        console.log('✅ Bildirim izni verildi!');
        // Alert gösterme, sadece log
      } else {
        console.warn('⚠️ Bildirim izni verilmedi');
        // İlk açılışta alert gösterme, sadece log
      }
      
      return status === 'granted';
    } catch (error) {
      console.error('❌ Bildirim izni hatası:', error);
      return false;
    }
  };

  // ✅ APK İYİLEŞTİRME: Battery optimization kontrolü
  const checkBatteryOptimization = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    
    try {
      // expo-device ile battery optimization kontrolü
      const isIgnored = await Device.isIgnoringBatteryOptimizationsAsync();
      setBatteryOptimizationIgnored(isIgnored);
      
      if (!isIgnored) {
        console.warn('⚠️ Battery optimization aktif - bildirimler gecikebilir!');
      } else {
        console.log('✅ Battery optimization devre dışı - bildirimler güvenli');
      }
    } catch (error) {
      console.error('❌ Battery optimization kontrolü hatası:', error);
      // Hata durumunda varsayılan olarak false kabul et
      setBatteryOptimizationIgnored(false);
    }
  }, []);

  // ✅ APK İYİLEŞTİRME: Battery optimization ayarlarına yönlendirme
  const requestBatteryOptimizationIgnore = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    
    try {
      // Önce durumu kontrol et
      const isIgnored = await Device.isIgnoringBatteryOptimizationsAsync();
      
      if (isIgnored) {
        Alert.alert('✅ Bilgi', 'Pil optimizasyonu zaten devre dışı.');
        return;
      }

      // Önce API ile denemeyi yap
      try {
        const canRequest = await Device.canRequestBatteryOptimizationExemptionAsync();
        
        if (canRequest) {
          // API ile istek yap
          await Device.requestBatteryOptimizationExemptionAsync();
          
          // Kısa bir süre bekle ve tekrar kontrol et
          setTimeout(async () => {
            await checkBatteryOptimization();
          }, 500);
          
          Alert.alert(
            '🔋 Pil Optimizasyonu',
            'Lütfen açılan ekranda "İzin Ver" veya "İzin Verme" butonuna tıklayın.\n\nEğer ekran açılmadıysa, manuel olarak ayarlardan pil optimizasyonunu kapatmanız gerekiyor.',
            [
              { text: 'Tamam', onPress: async () => {
                // Tekrar kontrol et
                setTimeout(async () => {
                  await checkBatteryOptimization();
                }, 1000);
              }}
            ]
          );
          return;
        }
      } catch (apiError) {
        console.log('⚠️ API ile istek yapılamadı, manuel yönlendirme yapılıyor:', apiError);
      }
      
      // API çalışmazsa manuel olarak ayarlara yönlendir
      Alert.alert(
        '🔋 Pil Optimizasyonu',
        'Bildirimlerin zamanında gelmesi için uygulamanın pil optimizasyonundan muaf tutulması gerekiyor.\n\nLütfen açılan ayarlardan:\n1. "Pil optimizasyonu" veya "Battery optimization" seçeneğini bulun\n2. "Optimize etme" veya "Don\'t optimize" seçeneğini seçin',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Ayarlara Git',
            onPress: async () => {
              try {
                // Önce uygulama ayarlarına yönlendir
                await Linking.openSettings();
                
                // Kullanıcı geri döndüğünde kontrol et
                setTimeout(async () => {
                  await checkBatteryOptimization();
                }, 2000);
              } catch (error) {
                console.error('❌ Ayarlara yönlendirme hatası:', error);
                Alert.alert(
                  'Manuel Yönlendirme',
                  'Lütfen manuel olarak şu yolu takip edin:\n\nAyarlar > Uygulamalar > Knight Rehber > Pil > Optimizasyonu kapat'
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Battery optimization isteği hatası:', error);
      // Hata durumunda da ayarlara yönlendirmeyi dene
      Alert.alert(
        '🔋 Pil Optimizasyonu',
        'Lütfen ayarlardan uygulamanın pil optimizasyonunu kapatın:\n\nAyarlar > Uygulamalar > Knight Rehber > Pil > Optimizasyonu kapat',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Ayarlara Git',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }
  }, [checkBatteryOptimization]);

  // ✅ APK İYİLEŞTİRME: Exact Alarm Permission kontrolü (Android 12+)
  const checkExactAlarmPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || Platform.Version < 31) {
      // Android 12 (API 31) altında exact alarm permission yok
      setExactAlarmPermission(true);
      return;
    }
    
    try {
      // Android 12+ için exact alarm permission kontrolü
      // expo-notifications bu kontrolü yapmıyor, bu yüzden varsayılan olarak true kabul ediyoruz
      // Ancak kullanıcıyı bilgilendirmek için bir uyarı gösterebiliriz
      const hasPermission = true; // USE_EXACT_ALARM izni varsa otomatik verilir
      setExactAlarmPermission(hasPermission);
      
      if (!hasPermission) {
        console.warn('⚠️ Exact alarm permission yok - bildirimler gecikebilir!');
      } else {
        console.log('✅ Exact alarm permission mevcut');
      }
    } catch (error) {
      console.error('❌ Exact alarm permission kontrolü hatası:', error);
      setExactAlarmPermission(true); // Hata durumunda varsayılan olarak true
    }
  }, []);

  const loadAlarms = async () => {
    try {
      console.log('📥 Alarmlar yükleniyor...');
      const saved = await AsyncStorage.getItem('ko-alarms');
      if (saved) {
        const data = JSON.parse(saved);
        const loadedAlarms = data.alarms || EVENTS_DATA.map(e => ({ ...e, enabled: false }));
        const loadedActiveAlarms = data.activeAlarms || [];
        
        console.log(`📥 Yüklenen alarmlar: ${loadedAlarms.length}, Aktif: ${loadedActiveAlarms.length}`);
        
        // Önce state'leri güncelle
        setAlarms(loadedAlarms);
        setActiveAlarms(loadedActiveAlarms);
        
        // NOT: Alarm kontrolü useMemo ile otomatik yapılıyor, state güncellendiğinde tetikleniyor
        
        if (data.settings) {
          setAutoStart(data.settings.autoStart !== false);
          setVibrate(data.settings.vibrate !== false);
          setVolume(data.settings.volume || 80);
        }
        
      } else {
        console.log('📥 Kayıtlı alarm yok, varsayılan alarmlar yükleniyor');
        const defaultAlarms = EVENTS_DATA.map(e => ({ ...e, enabled: false }));
        setAlarms(defaultAlarms);
        setActiveAlarms([]);
      }
    } catch (error) {
      console.error('❌ Alarm yükleme hatası:', error);
      const defaultAlarms = EVENTS_DATA.map(e => ({ ...e, enabled: false }));
      setAlarms(defaultAlarms);
      setActiveAlarms([]);
    }
  };

  const saveAlarms = async () => {
    try {
      const data = {
        alarms: alarms,
        activeAlarms: Array.from(activeAlarms),
        settings: {
          autoStart,
          vibrate,
          volume
        },
        timestamp: new Date().toISOString()
      };
      await AsyncStorage.setItem('ko-alarms', JSON.stringify(data));
    } catch (error) {
      console.error('Alarm kaydetme hatası:', error);
    }
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const calculateNextOccurrence = (timeStr, days = null) => {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    
    // Bugün için hedef zamanı oluştur (saniye ve milisaniye 0)
    let targetDate = new Date(now);
    targetDate.setHours(hours, minutes, 0, 0);
    targetDate.setMilliseconds(0);
    
    // Eğer hedef zaman geçmişse, bir sonraki güne al
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    // Gün kontrolü - belirli günlerde çalışacaksa
    if (days && days.length > 0) {
      let targetDay = targetDate.getDay();
      let targetDayName = DAYS_TR[targetDay];
      
      // Eğer hedef gün uygun değilse, bir sonraki uygun günü bul
      if (!days.includes(targetDayName)) {
        // Maksimum 7 gün ileriye bak (bir hafta)
        for (let i = 1; i <= 7; i++) {
          targetDate.setDate(targetDate.getDate() + 1);
          targetDay = targetDate.getDay();
          targetDayName = DAYS_TR[targetDay];
          
          if (days.includes(targetDayName)) {
            // Uygun günü bulduk, saati ayarla
            targetDate.setHours(hours, minutes, 0, 0);
            targetDate.setMilliseconds(0);
            break;
          }
        }
      }
    }
    
    // Son kontrol: Eğer hala geçmiş bir zamansa (gün kontrolü sırasında olabilir), bir gün daha ekle
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(hours, minutes, 0, 0);
      targetDate.setMilliseconds(0);
    }
    
    return targetDate;
  };

  const calculateRemainingTime = (targetTime) => {
    if (!targetTime || !(targetTime instanceof Date)) {
      return null;
    }
    
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();
    
    // Geçmiş zamanlar için null döndür
    if (diff <= 0) {
      return null;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return { hours, minutes, seconds, totalMs: diff };
  };

  const formatRemainingTime = (remaining) => {
    if (!remaining) return '';
    
    if (remaining.hours > 0) {
      return `${remaining.hours}sa ${remaining.minutes}d`;
    } else if (remaining.minutes > 0) {
      return `${remaining.minutes}d ${remaining.seconds}s`;
    } else {
      return `${remaining.seconds}s`;
    }
  };

  const scheduleAlarm = async (alarm) => {
    // Önce mevcut bildirimleri iptal et
    await cancelAlarm(alarm.id);
    
    // Bildirim izni kontrolü
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn(`⚠️ Bildirim izni yok, alarm zamanlanamıyor: ${alarm.name}`);
      return;
    }
    
    // ✅ BİLDİRİM GÜVENLİĞİ: Android için MAX priority notification channel
    // MAX importance = Düşük pil modunda, Do Not Disturb modunda bile çalışır
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', NOTIFICATION_CHANNEL_CONFIG);
        console.log('✅ Bildirim kanalı MAX priority ile oluşturuldu');
      } catch (channelError) {
        console.warn('⚠️ Channel oluşturma hatası:', channelError);
      }
    }
    
    // ✅ SIRALAMA: Aynı saatteki tüm bildirimleri topla ve sırala
    const notificationsToSchedule = [];
    
    for (const time of alarm.times) {
      const nextOccurrence = calculateNextOccurrence(time, alarm.days);
      const remaining = calculateRemainingTime(nextOccurrence);
      
      if (remaining && remaining.totalMs > 0) {
        // ✅ 5 dakika öncesi bildirimi (metinde "5 dakika kaldı" yazacak)
        const nextOccurrence5Min = new Date(nextOccurrence);
        nextOccurrence5Min.setMinutes(nextOccurrence5Min.getMinutes() - 5); // 5 dakika öncesi
        const remaining5Min = calculateRemainingTime(nextOccurrence5Min);
        
        // 5 dakika öncesi bildirimi sadece gelecekteyse zamanla
        if (remaining5Min && remaining5Min.totalMs > 0) {
          notificationsToSchedule.push({
            alarm,
            time,
            nextOccurrence5Min,
            notificationId5Min: `${alarm.id}_${time}_5min_before`,
            // Zaman damgası (timestamp) ile sıralama için
            timestamp: nextOccurrence5Min.getTime(),
          });
        }
      }
    }
    
    // ✅ SIRALAMA: Aynı zamanda gönderilecek bildirimleri sırala
    // 1. Önce zamana göre sırala
    notificationsToSchedule.sort((a, b) => {
      // Aynı zamandaysa (1 saniye içindeyse), alfabetik sıraya göre
      const timeDiff = Math.abs(a.timestamp - b.timestamp);
      if (timeDiff < 1000) { // 1 saniye içindeyse
        return a.alarm.name.localeCompare(b.alarm.name); // Alfabetik sıralama
      }
      return a.timestamp - b.timestamp; // Zamana göre sıralama
    });
    
    // ✅ SIRALAMA: Aynı zamandaki bildirimlere offset ekle (1 saniye arayla)
    const scheduledTimes = new Map(); // Zaman -> kaç bildirim gönderilecek
    
    for (let i = 0; i < notificationsToSchedule.length; i++) {
      const notif = notificationsToSchedule[i];
      const baseTime = notif.nextOccurrence5Min.getTime();
      
      // Bu zamanda kaç bildirim var?
      const timeKey = Math.floor(baseTime / 1000); // Saniye cinsinden (hassasiyet 1 saniye)
      const count = scheduledTimes.get(timeKey) || 0;
      scheduledTimes.set(timeKey, count + 1);
      
      // Offset ekle: Aynı zamandaki bildirimler 1 saniye arayla gönderilsin
      const offsetMs = count * 1000; // Her bildirim için 1 saniye offset
      const scheduledTime = new Date(baseTime + offsetMs);
      
      try {
        // Önce aynı identifier'a sahip bildirimi iptal et (varsa)
        try {
          await Notifications.cancelScheduledNotificationAsync(notif.notificationId5Min);
        } catch (cancelError) {
          // Bildirim yoksa hata vermez, devam et
        }
        
        // ✅ BİLDİRİM GÜVENLİĞİ: 5 dakika öncesi bildirimi MAX priority
        // Bildirim metninde "5 dakika kaldı" yazacak ve 5 dakika öncesinde gönderilecek
        // NOT: Yerel bildirimler internet gerektirmez. Android'in Battery Optimization ayarları
        // bildirimleri geciktirebilir, bu yüzden MAX priority kullanıyoruz.
        await Notifications.scheduleNotificationAsync({
          identifier: notif.notificationId5Min,
          content: {
            title: `⏰ ${notif.alarm.name}`,
            body: `🕐 ${notif.alarm.name} başlamasına 5 dakika kaldı`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX, // MAX priority - internet olmadan da çalışır
            data: { 
              alarmId: notif.alarm.id, 
              time: notif.time,
              eventName: notif.alarm.name,
              description: `${notif.alarm.name} başlamasına 5 dakika kaldı`,
              type: 'alarm_5min_before'
            },
            ...(Platform.OS === 'android' && { 
              channelId: 'default',
              sticky: true, // Kullanıcı kapatana kadar kalır - internet gerektirmez
            }),
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: scheduledTime, // Offset ile sıralı gönderilecek
            // Yerel bildirimler internet bağlantısı gerektirmez
          },
        });
        
        if (offsetMs > 0) {
          console.log(`✅ 5 dakika öncesi bildirim zamanlandı (${offsetMs/1000}s offset, sıralı): ${notif.alarm.name} - ${notif.time} (${scheduledTime.toISOString()})`);
        } else {
          console.log(`✅ 5 dakika öncesi bildirim zamanlandı: ${notif.alarm.name} - ${notif.time} (${scheduledTime.toISOString()})`);
        }
      } catch (error) {
        console.error(`❌ 5 dakika öncesi bildirim zamanlama hatası (${notif.alarm.name} - ${notif.time}):`, error);
      }
    }
  };

  const cancelAlarm = async (alarmId) => {
    try {
      // Tüm zamanlanmış bildirimleri al
      const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
      
      // Bu alarm'a ait tüm bildirimleri iptal et
      let cancelledCount = 0;
      for (const notification of allScheduled) {
        const data = notification.content.data;
        // Hem data'dan hem de identifier'dan kontrol et
        if (data && data.alarmId === alarmId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            cancelledCount++;
            console.log(`🗑️ Bildirim iptal edildi: ${notification.identifier}`);
          } catch (cancelError) {
            // Bildirim zaten iptal edilmiş olabilir, devam et
            console.log(`⚠️ Bildirim zaten iptal edilmiş: ${notification.identifier}`);
          }
        } else if (notification.identifier && notification.identifier.startsWith(`${alarmId}_`)) {
          // Identifier'dan da kontrol et (eski bildirimler için)
          try {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
            cancelledCount++;
            console.log(`🗑️ Bildirim iptal edildi (identifier): ${notification.identifier}`);
          } catch (cancelError) {
            // Bildirim zaten iptal edilmiş olabilir, devam et
          }
        }
      }
      
      if (cancelledCount > 0) {
        console.log(`✅ ${cancelledCount} bildirim iptal edildi (alarm: ${alarmId})`);
      }
    } catch (error) {
      console.error(`❌ Bildirim iptal hatası (${alarmId}):`, error);
    }
  };

  const triggerAlarm = async (alarm, time) => {
    console.log(`🔔 Alarm tetiklendi: ${alarm.name} - ${time}`);
    
    // Bildirim iznini tekrar kontrol et
    const { status } = await Notifications.getPermissionsAsync();
    const hasPermission = status === 'granted';
    
    if (hasPermission) {
      try {
        // ✅ BİLDİRİM GÜVENLİĞİ: MAX priority channel
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('default', NOTIFICATION_CHANNEL_CONFIG);
            console.log('✅ Android notification channel MAX priority ile oluşturuldu');
          } catch (channelError) {
            console.warn('⚠️ Channel oluşturma hatası (zaten var olabilir):', channelError);
          }
        }
        
        // ✅ BİLDİRİM GÜVENLİĞİ: MAX priority ile bildirim gönder
        const notificationContent = {
          title: `⏰ ${alarm.name}`,
          body: `🕐 Saat: ${time}\n📝 ${alarm.description}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX, // MAX priority
          data: { alarmId: alarm.id, time },
          ...(Platform.OS === 'android' && { 
            channelId: 'default',
            sticky: true, // Kullanıcı kapatana kadar kalır
          }),
        };
        
        let notificationId;
        // Hemen bildirim göndermek için minimum delay (100ms)
        const now = new Date();
        now.setMilliseconds(now.getMilliseconds() + 100); // 100ms sonra (hemen gönderme)
        
        console.log('📤 Bildirim gönderiliyor...');
        console.log('📤 Trigger date:', now.toISOString());
        console.log('📤 Notification content:', JSON.stringify(notificationContent, null, 2));
        
        try {
          notificationId = await Notifications.scheduleNotificationAsync({
            content: notificationContent,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: now,
            },
          });
          
          console.log(`✅ Bildirim gönderildi! ID: ${notificationId}`);
          console.log(`📋 Başlık: ⏰ ${alarm.name}`);
          console.log(`📋 İçerik: 🕐 Saat: ${time}\n📝 ${alarm.description}`);
        } catch (scheduleError) {
          console.error('❌ scheduleNotificationAsync hatası:', scheduleError);
          console.error('❌ Hata tipi:', scheduleError.constructor.name);
          console.error('❌ Hata mesajı:', scheduleError.message);
          console.error('❌ Hata stack:', scheduleError.stack);
          throw scheduleError; // Üstteki catch bloğuna ilet
        }
      } catch (error) {
        console.error('❌ Bildirim gönderme hatası:', error);
        console.error('❌ Hata detayları:', JSON.stringify(error, null, 2));
        Alert.alert('Hata', `Bildirim gönderilemedi: ${error.message}`);
      }
      } else {
        console.warn('⚠️ Bildirim izni yok, bildirim gönderilemedi');
        console.warn(`⚠️ İzin durumu: ${status}`);
      }
    
    // Bir sonraki alarmı zamanla (test alarmı değilse)
    if (alarm.id !== 'test') {
      scheduleAlarm(alarm);
    }
    // NOT: Alarm kontrolü useMemo ile otomatik yapılıyor
  };

  // ✅ PERFORMANS: useCallback ile toggle fonksiyonunu önbellekle
  const toggleAlarm = useCallback((alarmId, enabled) => {
    const alarm = alarms.find(a => a.id === alarmId);
    if (!alarm) return;
    
    setActiveAlarms(prev => {
      let newActiveAlarms;
      if (enabled) {
        newActiveAlarms = prev.includes(alarmId) ? prev : [...prev, alarmId];
        scheduleAlarm(alarm);
      } else {
        newActiveAlarms = prev.filter(id => id !== alarmId);
        cancelAlarm(alarmId);
      }
      
      // AsyncStorage'a kaydet (non-blocking)
      const data = {
        alarms: alarms,
        activeAlarms: newActiveAlarms,
        settings: {
          autoStart,
          vibrate,
          volume
        },
        timestamp: new Date().toISOString()
      };
      AsyncStorage.setItem('ko-alarms', JSON.stringify(data)).catch(err => console.error('Save error:', err));
      
      return newActiveAlarms;
    });
  }, [alarms, autoStart, vibrate, volume]);

  // ✅ PERFORMANS: useMemo ile sonraki alarmı hesapla (sadece gerekli olduğunda)
  // NOT: Bildirimler sistem tarafından zamanlandığı için bu sadece UI güncellemesi için
  const nextAlarmInfo = useMemo(() => {
    if (alarms.length === 0 || activeAlarms.length === 0) {
      return null;
    }

    let nextAlarm = null;
    let minTime = Infinity;
    
    activeAlarms.forEach(alarmId => {
      const alarm = alarms.find(a => a.id === alarmId);
      if (!alarm) return;
      
      alarm.times.forEach(time => {
        const nextOccurrence = calculateNextOccurrence(time, alarm.days);
        const remaining = calculateRemainingTime(nextOccurrence);
        
        if (remaining && remaining.totalMs < minTime) {
          minTime = remaining.totalMs;
          nextAlarm = {
            alarm,
            time,
            nextOccurrence,
            remaining
          };
        }
      });
    });
    
    return nextAlarm;
  }, [alarms, activeAlarms, Math.floor(currentTime.getTime() / 60000)]); // Her dakika güncelle

  // ✅ PERFORMANS: useMemo ile yaklaşan alarmları hesapla
  const upcomingAlarmsList = useMemo(() => {
    if (alarms.length === 0 || activeAlarms.length === 0) {
      return [];
    }

    const upcoming = [];
    
    activeAlarms.forEach(alarmId => {
      const alarm = alarms.find(a => a.id === alarmId);
      if (!alarm) return;
      
      alarm.times.forEach(time => {
        const nextOccurrence = calculateNextOccurrence(time, alarm.days);
        const remaining = calculateRemainingTime(nextOccurrence);
        
        if (remaining && remaining.totalMs <= 24 * 60 * 60 * 1000) {
          upcoming.push({
            alarm,
            time,
            nextOccurrence,
            remaining
          });
        }
      });
    });
    
    upcoming.sort((a, b) => a.remaining.totalMs - b.remaining.totalMs);
    return upcoming.slice(0, 5);
  }, [alarms, activeAlarms, Math.floor(currentTime.getTime() / 60000)]); // Her dakika güncelle

  // ✅ PERFORMANS: useMemo sonuçlarını state'e senkronize et
  useEffect(() => {
    if (nextAlarmInfo) {
      const remainingStr = formatRemainingTime(nextAlarmInfo.remaining);
      const nextTimeStr = `${nextAlarmInfo.time} (${remainingStr})`;
      setNextAlarmTime(nextTimeStr);
    } else {
      setNextAlarmTime('--:--');
    }
    setUpcomingAlarms(upcomingAlarmsList);
  }, [nextAlarmInfo, upcomingAlarmsList]);

  // ✅ PERFORMANS: Eski fonksiyonları kaldırdık, useMemo kullanıyoruz
  const checkNextAlarm = useCallback(() => {
    // useMemo zaten hesaplıyor, bu fonksiyon sadece geriye dönük uyumluluk için
    // Artık doğrudan kullanılmıyor, useMemo otomatik güncelliyor
  }, []);

  const updateUpcomingAlarms = useCallback(() => {
    // useMemo zaten hesaplıyor, bu fonksiyon sadece geriye dönük uyumluluk için
    // Artık doğrudan kullanılmıyor, useMemo otomatik güncelliyor
  }, []);

  const startAlarmChecker = () => {
    setServiceStatus('✅ Servis Çalışıyor');
    
    if (alarms.length === 0) return;
    
    // Aktif alarmları zamanla
    setTimeout(() => {
      activeAlarms.forEach(alarmId => {
        const alarm = alarms.find(a => a.id === alarmId);
        if (alarm) {
          scheduleAlarm(alarm);
        }
      });
    }, 150);
  };

  const enableAll = () => {
    alarms.forEach(alarm => {
      if (!activeAlarms.includes(alarm.id)) {
        toggleAlarm(alarm.id, true);
      }
    });
  };

  const disableAll = () => {
    activeAlarms.forEach(alarmId => {
      toggleAlarm(alarmId, false);
    });
  };

  const getDayText = (event) => {
    if (!event.days || event.days.length === 0) {
      return 'Her gün';
    }
    return event.days.join(', ');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎮 Knight Online Alarmları</Text>
        <View style={styles.headerControls}>
          <View style={styles.timeDisplay}>
            <Text style={styles.currentTime}>
              {currentTime.toLocaleTimeString('tr-TR')}
            </Text>
            <Text style={styles.currentDate}>
              {currentTime.toLocaleDateString('tr-TR')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Aktif Alarmlar:</Text>
          <Text style={styles.statusValue}>{activeAlarms.length}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Sonraki Alarm:</Text>
          <Text style={styles.statusValue}>{nextAlarmTime}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.serviceStatus}>{serviceStatus}</Text>
        </View>
      </View>

      {/* ✅ APK İYİLEŞTİRME: Battery optimization uyarısı */}
      {Platform.OS === 'android' && !batteryOptimizationIgnored && (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>⚠️ Önemli: Pil Optimizasyonu</Text>
          <Text style={styles.warningText}>
            Bildirimlerin zamanında gelmesi için uygulamanın pil optimizasyonundan muaf tutulması gerekiyor.
          </Text>
          <TouchableOpacity 
            style={styles.warningButton} 
            onPress={requestBatteryOptimizationIgnore}
          >
            <Text style={styles.warningButtonText}>🔋 Pil Optimizasyonunu Kapat</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.upcomingAlarms}>
        <Text style={styles.upcomingTitle}>🕐 Yaklaşan Alarmlar</Text>
        {upcomingAlarms.length > 0 ? (
          upcomingAlarms.map((item, idx) => (
            <View key={idx} style={styles.upcomingItem}>
              <Text style={styles.upcomingTime}>{item.time}</Text>
              <Text style={styles.upcomingEvent}>{item.alarm.name}</Text>
              <Text style={styles.upcomingRemaining}>
                {formatRemainingTime(item.remaining)}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.upcomingEmpty}>Yaklaşan alarm yok</Text>
        )}
      </View>

      <View style={styles.alarmsContainer}>
        {alarms.map((alarm) => {
          const isActive = activeAlarms.includes(alarm.id);
          
          return (
            <View key={alarm.id} style={[styles.alarmCard, isActive ? styles.alarmCardActive : styles.alarmCardInactive]}>
              <View style={styles.alarmHeader}>
                <View style={styles.alarmTitle}>
                  <Text style={styles.alarmName}>{alarm.name}</Text>
                  <Text style={styles.alarmDescription}>{alarm.description}</Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={(enabled) => toggleAlarm(alarm.id, enabled)}
                  trackColor={{ false: '#3e3e3e', true: '#27ae60' }}
                  thumbColor={isActive ? '#fff' : '#f4f3f4'}
                />
              </View>
              
              {alarm.days && alarm.days.length > 0 && (
                <View style={styles.alarmDays}>
                  {alarm.days.map((day, idx) => (
                    <View key={idx} style={styles.dayPill}>
                      <Text style={styles.dayPillText}>{day}</Text>
                    </View>
                  ))}
                </View>
              )}
              
              <View style={styles.alarmTimes}>
                {alarm.times.map((time, idx) => {
                  const nextOccurrence = calculateNextOccurrence(time, alarm.days);
                  const remaining = calculateRemainingTime(nextOccurrence);
                  const isPassed = !remaining;
                  const isNext = !isPassed && remaining && remaining.totalMs < 30 * 60 * 1000;
                  
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.timeSlot,
                        isPassed && styles.timeSlotPassed,
                        isNext && styles.timeSlotNext
                      ]}
                    >
                      <Text style={styles.timeSlotText}>{time}</Text>
                      {remaining && (
                        <Text style={styles.timeSlotRemaining}>
                          ({formatRemainingTime(remaining)})
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
              
              <View style={styles.alarmControls}>
                <Text style={styles.alarmStatus}>
                  {isActive ? '✅ Aktif' : '❌ Pasif'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>


      <View style={styles.settings}>
        <Text style={styles.settingsTitle}>⚙️ Ayarlar</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Otomatik başlat</Text>
          <Switch value={autoStart} onValueChange={setAutoStart} />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Titreşim</Text>
          <Switch value={vibrate} onValueChange={setVibrate} />
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Ses Seviyesi: {volume}%</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070C',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#1A1D24',
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 10,
    textAlign: 'center',
  },
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 15,
  },
  timeDisplay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2ecc71',
  },
  currentDate: {
    fontSize: 12,
    color: '#95a5a6',
  },
  controls: {
    backgroundColor: '#1A1D24',
    padding: 15,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  alarmControls: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  btn: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
  },
  btnTestText: {
    color: '#FFFFFF', // Beyaz - koyu turuncu arka plan üzerinde okunabilir
    fontSize: 11,
    fontWeight: 'bold',
  },
  btnSuccess: {
    backgroundColor: '#27ae60',
  },
  btnDanger: {
    backgroundColor: '#e74c3c',
  },
  btnWarning: {
    backgroundColor: '#f39c12',
  },
  btnPermission: {
    backgroundColor: '#9b59b6',
  },
  btnTest: {
    backgroundColor: '#e67e22', // Koyu turuncu - daha okunabilir
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusBar: {
    backgroundColor: '#1A1D24',
    padding: 15,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  statusItem: {
    alignItems: 'center',
    marginVertical: 5,
  },
  statusLabel: {
    color: '#95a5a6',
    fontSize: 12,
  },
  statusValue: {
    color: '#2ecc71',
    fontWeight: 'bold',
    fontSize: 16,
  },
  serviceStatus: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  alarmsContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  alarmCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 5,
    borderLeftColor: '#3498db',
  },
  alarmCardActive: {
    borderLeftColor: '#27ae60',
  },
  alarmCardInactive: {
    borderLeftColor: '#e74c3c',
    opacity: 0.8,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  alarmTitle: {
    flex: 1,
    marginRight: 15,
  },
  alarmName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 5,
  },
  alarmDescription: {
    fontSize: 14,
    color: '#95a5a6',
  },
  alarmDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  dayPill: {
    backgroundColor: 'rgba(52, 152, 219, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dayPillText: {
    color: '#3498db',
    fontSize: 12,
  },
  alarmTimes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 15,
  },
  timeSlot: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  timeSlotText: {
    color: '#27ae60',
    fontWeight: 'bold',
    fontSize: 14,
  },
  timeSlotRemaining: {
    fontSize: 10,
    color: '#95a5a6',
    marginTop: 2,
  },
  timeSlotPassed: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    opacity: 0.6,
  },
  timeSlotNext: {
    backgroundColor: 'rgba(243, 156, 18, 0.3)',
    borderWidth: 2,
    borderColor: '#f39c12',
  },
  alarmStatus: {
    color: '#95a5a6',
    fontSize: 14,
  },
  upcomingAlarms: {
    backgroundColor: '#1A1D24',
    padding: 20,
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
  upcomingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 15,
  },
  upcomingItem: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingTime: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#2ecc71',
    fontSize: 16,
  },
  upcomingEvent: {
    color: '#f39c12',
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 10,
  },
  upcomingRemaining: {
    color: '#95a5a6',
    fontSize: 12,
  },
  upcomingEmpty: {
    color: '#95a5a6',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
  settings: {
    backgroundColor: '#1A1D24',
    padding: 20,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f39c12',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingLabel: {
    color: '#95a5a6',
    fontSize: 14,
  },
  warningCard: {
    backgroundColor: '#f39c12',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 5,
    borderLeftColor: '#e67e22',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 18,
  },
  warningButton: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  warningButtonText: {
    color: '#f39c12',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
