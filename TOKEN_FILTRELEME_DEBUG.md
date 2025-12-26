# 🔍 Token Filtreleme Debug Güncellemesi

## Sorun
Redeploy sonrası hala 6 token gönderiliyor (2 eski + 4 yeni). Filtreleme çalışmıyor.

## Olası Sebep
Eski token'lar MongoDB'de `experienceId` alanına sahip olmayabilir (null veya field yok). MongoDB sorgusu `{ experienceId: '@ceylan26/knight-rehber' }` sadece bu değere sahip olanları bulur, ama null/undefined olanlar filtrelenmiyor olabilir.

## Çözüm
Debug için tüm token'ları logluyoruz ve experienceId'lerini gösteriyoruz. Böylece hangi token'ların experienceId'si olduğunu, hangilerinin olmadığını görebiliriz.

## Yapılan Değişiklikler
1. Tüm token'lar loglanıyor (experienceId'leri ile birlikte)
2. Null/undefined experienceId sorgusu düzeltildi (`$or` ve `$exists` kullanılıyor)
3. Filtreleme hala sadece `@ceylan26/knight-rehber` token'larını kullanıyor

## Sonraki Adım
Redeploy yapın ve bildirim gönderin. Log'larda şunları göreceksiniz:
- Tüm token'ların listesi ve experienceId'leri
- Filtrelenmiş token sayısı
- Eski token'ların sayısı

Bu log'lar sorunun kaynağını gösterecek.





