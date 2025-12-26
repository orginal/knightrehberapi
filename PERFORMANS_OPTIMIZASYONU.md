# 🚀 Performans Optimizasyonu Rehberi

## 📊 Mevcut Performans Sorunları

### 1. ❌ **Her Saniye Kompleks Hesaplamalar**
```javascript
// AlarmScreen.js - Her saniye çalışıyor!
const interval = setInterval(() => {
  updateCurrentTime();
  if (alarms.length > 0 && activeAlarms.length > 0) {
    checkNextAlarm(); // ❌ Tüm alarmları her saniye kontrol ediyor
  }
}, 1000);
```

**Sorun:** `checkNextAlarm()` fonksiyonu her saniye:
- Tüm aktif alarmları döngüye alıyor
- Her alarm için `calculateNextOccurrence()` çağırıyor
- Her zaman için `calculateRemainingTime()` çağırıyor
- Array'leri sıralıyor

**Etkisi:** CPU'da gereksiz yük, pil tüketimi, uygulama yavaşlaması

---

### 2. ❌ **Bileşenler Her Render'da Yeniden Oluşturuluyor**
```javascript
// App.js - MainApp içinde
const AnasayfaScreen = () => {  // ❌ Her render'da yeni fonksiyon
  return <ScrollView>...</ScrollView>;
};

const allTabs = [  // ❌ Her render'da yeni array
  { id: 'anasayfa', icon: '🏠', label: 'Anasayfa' },
  // ...
];
```

**Sorun:** MainApp her render olduğunda (state değiştiğinde):
- `AnasayfaScreen` yeni bir fonksiyon olarak oluşturuluyor
- `allTabs` array'i yeniden oluşturuluyor
- React bu değişiklikleri görünce gereksiz yeniden render yapıyor

---

### 3. ❌ **Memoization Kullanılmıyor**
```javascript
// ❌ useMemo, useCallback, React.memo hiç kullanılmamış
const checkNextAlarm = () => {
  // Kompleks hesaplamalar her seferinde tekrarlanıyor
};

const calculateNextOccurrence = (timeStr, days) => {
  // Aynı parametreler için tekrar tekrar hesaplanıyor
};
```

**Sorun:** Aynı hesaplamalar tekrar tekrar yapılıyor.

---

### 4. ❌ **Inline Fonksiyonlar ve Objeler**
```javascript
<Header onOpenSettings={() => setSettingsVisible(true)} />  // ❌ Her render'da yeni fonksiyon
<View style={{ paddingBottom: 100 }}>  // ❌ Her render'da yeni obje
```

**Sorun:** Child bileşenler her render'da yeni prop'lar alıyor, gereksiz render tetikleniyor.

---

## ✅ Optimizasyon Çözümleri

### 1. ✅ **useMemo ile Hesaplamaları Önbellekleme**

```javascript
import React, { useMemo } from 'react';

// ❌ ÖNCE (Her seferinde hesaplanıyor)
const checkNextAlarm = () => {
  let nextAlarm = null;
  let minTime = Infinity;
  
  activeAlarms.forEach(alarmId => {
    const alarm = alarms.find(a => a.id === alarmId);
    alarm.times.forEach(time => {
      const nextOccurrence = calculateNextOccurrence(time, alarm.days);
      const remaining = calculateRemainingTime(nextOccurrence);
      // ...
    });
  });
};

// ✅ SONRA (Sadece gerekli olduğunda hesaplanıyor)
const nextAlarm = useMemo(() => {
  if (alarms.length === 0 || activeAlarms.length === 0) return null;
  
  let result = null;
  let minTime = Infinity;
  
  activeAlarms.forEach(alarmId => {
    const alarm = alarms.find(a => a.id === alarmId);
    alarm?.times.forEach(time => {
      const nextOccurrence = calculateNextOccurrence(time, alarm.days);
      const remaining = calculateRemainingTime(nextOccurrence);
      
      if (remaining && remaining.totalMs < minTime) {
        minTime = remaining.totalMs;
        result = { alarm, time, nextOccurrence, remaining };
      }
    });
  });
  
  return result;
}, [alarms, activeAlarms, currentTime]); // Sadece bunlar değiştiğinde yeniden hesapla
```

**Fayda:** Kompleks hesaplama sadece gerekli olduğunda yapılır.

---

### 2. ✅ **useCallback ile Fonksiyonları Önbellekleme**

```javascript
import React, { useCallback } from 'react';

// ❌ ÖNCE (Her render'da yeni fonksiyon)
const toggleAlarm = (alarmId, enabled) => {
  // ...
};

// ✅ SONRA (Fonksiyon önbellekleniyor)
const toggleAlarm = useCallback((alarmId, enabled) => {
  const alarm = alarms.find(a => a.id === alarmId);
  if (!alarm) return;
  
  let newActiveAlarms;
  if (enabled) {
    newActiveAlarms = activeAlarms.includes(alarmId) 
      ? activeAlarms 
      : [...activeAlarms, alarmId];
    scheduleAlarm(alarm);
  } else {
    newActiveAlarms = activeAlarms.filter(id => id !== alarmId);
    cancelAlarm(alarmId);
  }
  
  setActiveAlarms(newActiveAlarms);
}, [alarms, activeAlarms]); // Sadece bu değerler değiştiğinde yeniden oluştur
```

**Fayda:** Child bileşenlere geçirilen fonksiyonlar sabit kalır, gereksiz render önlenir.

---

### 3. ✅ **React.memo ile Bileşen Optimizasyonu**

```javascript
import React, { memo } from 'react';

// ❌ ÖNCE (Her zaman render oluyor)
const AlarmCard = ({ alarm, isActive, onToggle }) => {
  return (
    <View style={styles.alarmCard}>
      <Text>{alarm.name}</Text>
      <Switch value={isActive} onValueChange={() => onToggle(alarm.id, !isActive)} />
    </View>
  );
};

// ✅ SONRA (Sadece props değiştiğinde render oluyor)
const AlarmCard = memo(({ alarm, isActive, onToggle }) => {
  return (
    <View style={styles.alarmCard}>
      <Text>{alarm.name}</Text>
      <Switch value={isActive} onValueChange={() => onToggle(alarm.id, !isActive)} />
    </View>
  );
}, (prevProps, nextProps) => {
  // Özel karşılaştırma (opsiyonel)
  return (
    prevProps.alarm.id === nextProps.alarm.id &&
    prevProps.isActive === nextProps.isActive
  );
});
```

**Fayda:** Props değişmediğinde bileşen render edilmez.

---

### 4. ✅ **Sabit Değerleri Dışarı Çıkarma**

```javascript
// ❌ ÖNCE (MainApp içinde, her render'da oluşturuluyor)
function MainApp() {
  const allTabs = [
    { id: 'anasayfa', icon: '🏠', label: 'Anasayfa' },
    // ...
  ];
  
  const AnasayfaScreen = () => {
    return <ScrollView>...</ScrollView>;
  };
}

// ✅ SONRA (MainApp dışında, sadece bir kez oluşturuluyor)
const ALL_TABS = [
  { id: 'anasayfa', icon: '🏠', label: 'Anasayfa' },
  { id: 'alarm', icon: '⏰', label: 'Alarm' },
  // ...
];

const AnasayfaScreen = () => {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      {/* ... */}
    </ScrollView>
  );
};

function MainApp() {
  // allTabs ve AnasayfaScreen artık dışarıda tanımlı
}
```

**Fayda:** Her render'da yeniden oluşturulmaz.

---

### 5. ✅ **Interval Optimizasyonu - Daha Az Sıklıkta Kontrol**

```javascript
// ❌ ÖNCE (Her saniye kontrol)
const interval = setInterval(() => {
  updateCurrentTime();
  if (alarms.length > 0 && activeAlarms.length > 0) {
    checkNextAlarm();
  }
}, 1000); // 1 saniye

// ✅ SONRA (Daha akıllı interval)
useEffect(() => {
  const interval = setInterval(() => {
    updateCurrentTime();
  }, 1000); // Sadece zaman güncellemesi için
  
  // Alarm kontrolü için daha uzun interval veya event-based
  const alarmCheckInterval = setInterval(() => {
    if (alarms.length > 0 && activeAlarms.length > 0) {
      checkNextAlarm();
    }
  }, 5000); // 5 saniyede bir kontrol et (yeterli)
  
  return () => {
    clearInterval(interval);
    clearInterval(alarmCheckInterval);
  };
}, [alarms, activeAlarms]);
```

**Alternatif - useMemo ile:**
```javascript
// Sonraki alarmı useMemo ile hesapla
const nextAlarmInfo = useMemo(() => {
  return calculateNextAlarm(alarms, activeAlarms);
}, [alarms, activeAlarms, Math.floor(Date.now() / 60000)]); // Her dakika güncelle

// Zamanı her saniye güncelle ama alarm bilgisini memoized kullan
useEffect(() => {
  const interval = setInterval(() => {
    setCurrentTime(new Date());
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

---

### 6. ✅ **Style Objelerini Dışarı Çıkarma veya useMemo ile Önbellekleme**

```javascript
// ❌ ÖNCE (Her render'da yeni obje)
<View style={{ paddingBottom: 100 }}>

// ✅ SONRA - Seçenek 1: Stylesheet'e ekle
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
});
<View style={styles.scrollContent}>

// ✅ SONRA - Seçenek 2: useMemo kullan
const scrollContentStyle = useMemo(() => ({
  paddingBottom: 100,
}), []);
<View style={scrollContentStyle}>
```

---

### 7. ✅ **List Rendering Optimizasyonu (FlatList)**

```javascript
// ❌ ÖNCE (ScrollView ile tüm itemlar render ediliyor)
<ScrollView>
  {alarms.map((alarm) => (
    <AlarmCard key={alarm.id} alarm={alarm} />
  ))}
</ScrollView>

// ✅ SONRA (FlatList ile sadece görünen itemlar render ediliyor)
<FlatList
  data={alarms}
  renderItem={({ item: alarm }) => (
    <AlarmCard alarm={alarm} />
  )}
  keyExtractor={(alarm) => alarm.id}
  removeClippedSubviews={true} // Performans için
  maxToRenderPerBatch={10} // Her seferde 10 item render et
  windowSize={10} // Ekranın etrafında 10 ekran yüksekliği tut
/>
```

**Fayda:** Uzun listelerde çok daha iyi performans.

---

## 📈 Performans İyileştirme Özeti

| Optimizasyon | Öncesi | Sonrası | İyileştirme |
|-------------|--------|---------|-------------|
| **checkNextAlarm çağrısı** | Her saniye | Her 5 saniye veya useMemo | %80 azalma |
| **Gereksiz render** | Her state değişikliği | Sadece gerekli durumlarda | %60-70 azalma |
| **Fonksiyon oluşturma** | Her render | useCallback ile önbellek | %90 azalma |
| **Array/Obje oluşturma** | Her render | useMemo/dışarı çıkarma | %100 azalma |
| **List rendering** | Tüm itemlar | FlatList (lazy loading) | %70-80 azalma |

---

## 🎯 Uygulanması Gerekenler (Öncelik Sırasıyla)

### Yüksek Öncelik 🔴
1. ✅ Alarm kontrolünü 5 saniyeye çıkar veya useMemo kullan
2. ✅ allTabs ve AnasayfaScreen'i MainApp dışına taşı
3. ✅ Inline style'ları StyleSheet'e taşı
4. ✅ Header onOpenSettings için useCallback kullan

### Orta Öncelik 🟡
5. ✅ AlarmCard için React.memo ekle
6. ✅ toggleAlarm için useCallback ekle
7. ✅ checkNextAlarm için useMemo kullan
8. ✅ FlatList kullan (uzun listeler için)

### Düşük Öncelik 🟢
9. ✅ calculateNextOccurrence için useMemo
10. ✅ Diğer kompleks hesaplamalar için memoization

---

## 🧪 Test Etme

Performansı ölçmek için React DevTools Profiler kullan:

```javascript
// React DevTools'ta Profiler sekmesi
// Record butonuna bas, uygulamayı kullan, durdur
// Hangi bileşenlerin ne kadar render olduğunu gör
```

---

## 📝 Örnek: Optimize Edilmiş AlarmScreen Snippet

```javascript
import React, { useState, useEffect, useMemo, useCallback } from 'react';

export default function AlarmScreen() {
  const [alarms, setAlarms] = useState([]);
  const [activeAlarms, setActiveAlarms] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ✅ useMemo: Sonraki alarmı hesapla (sadece gerekli olduğunda)
  const nextAlarm = useMemo(() => {
    if (alarms.length === 0 || activeAlarms.length === 0) return null;
    
    let result = null;
    let minTime = Infinity;
    
    activeAlarms.forEach(alarmId => {
      const alarm = alarms.find(a => a.id === alarmId);
      if (!alarm) return;
      
      alarm.times.forEach(time => {
        const nextOccurrence = calculateNextOccurrence(time, alarm.days);
        const remaining = calculateRemainingTime(nextOccurrence);
        
        if (remaining && remaining.totalMs < minTime) {
          minTime = remaining.totalMs;
          result = { alarm, time, nextOccurrence, remaining };
        }
      });
    });
    
    return result;
  }, [alarms, activeAlarms, Math.floor(Date.now() / 60000)]); // Her dakika güncelle

  // ✅ useCallback: Toggle fonksiyonunu önbellekle
  const toggleAlarm = useCallback((alarmId, enabled) => {
    const alarm = alarms.find(a => a.id === alarmId);
    if (!alarm) return;
    
    setActiveAlarms(prev => {
      if (enabled) {
        return prev.includes(alarmId) ? prev : [...prev, alarmId];
      } else {
        return prev.filter(id => id !== alarmId);
      }
    });
    
    if (enabled) {
      scheduleAlarm(alarm);
    } else {
      cancelAlarm(alarmId);
    }
  }, [alarms]);

  // ✅ Zaman güncellemesi için daha hafif interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ nextAlarm değiştiğinde UI'ı güncelle
  useEffect(() => {
    if (nextAlarm) {
      const remainingStr = formatRemainingTime(nextAlarm.remaining);
      setNextAlarmTime(`${nextAlarm.time} (${remainingStr})`);
    } else {
      setNextAlarmTime('--:--');
    }
  }, [nextAlarm]);

  // ... rest of component
}
```

---

## 💡 Sonuç

Performans optimizasyonu, uygulamanın:
- ⚡ Daha hızlı çalışmasını
- 🔋 Daha az pil tüketmesini
- 📱 Daha akıcı kullanıcı deneyimi sunmasını
- 🖥️ Daha az CPU kullanmasını

sağlar. Bu optimizasyonlar özellikle düşük performanslı cihazlarda çok önemlidir.



