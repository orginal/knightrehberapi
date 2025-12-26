from PIL import Image
import os
import glob

# Apple App Store iPhone 6.5" Display gereksinimleri
TARGET_SIZES = [
    (1242, 2688),  # Portrait
    (2688, 1242),  # Landscape
    (1284, 2778),  # Portrait (iPhone 14 Pro Max)
    (2778, 1284),  # Landscape (iPhone 14 Pro Max)
]

# En yaygın kullanılan boyut (Portrait - 1242x2688)
PRIMARY_SIZE = (1242, 2688)

def resize_screenshot(input_path, output_path, target_size=PRIMARY_SIZE):
    """Screenshot'ı yeniden boyutlandır"""
    try:
        # Görseli aç
        img = Image.open(input_path)
        
        # Mevcut boyut
        original_size = img.size
        print(f"Orijinal boyut: {original_size[0]}x{original_size[1]}")
        
        # Aspect ratio'yu koruyarak yeniden boyutlandır
        # Apple'ın istediği boyutlara uygun olacak şekilde
        target_width, target_height = target_size
        
        # Aspect ratio hesapla
        img_ratio = original_size[0] / original_size[1]
        target_ratio = target_width / target_height
        
        if img_ratio > target_ratio:
            # Görsel daha geniş, yüksekliğe göre ölçekle
            new_height = target_height
            new_width = int(target_height * img_ratio)
        else:
            # Görsel daha uzun, genişliğe göre ölçekle
            new_width = target_width
            new_height = int(target_width / img_ratio)
        
        # Yeniden boyutlandır (yüksek kalite)
        resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Eğer tam boyut değilse, ortaya hizalı siyah arka plan ekle
        if new_width != target_width or new_height != target_height:
            # Yeni görsel oluştur (siyah arka plan)
            final_img = Image.new('RGB', target_size, (0, 0, 0))
            
            # Ortalama konumu hesapla
            x_offset = (target_width - new_width) // 2
            y_offset = (target_height - new_height) // 2
            
            # Yeniden boyutlandırılmış görseli ortaya yapıştır
            final_img.paste(resized, (x_offset, y_offset))
            final_img.save(output_path, "PNG", quality=95, optimize=True)
            print(f"Olusturuldu: {output_path} ({target_width}x{target_height}) - Ortalandi")
        else:
            # Tam boyut, direkt kaydet
            resized.save(output_path, "PNG", quality=95, optimize=True)
            print(f"Olusturuldu: {output_path} ({target_width}x{target_height})")
        
        return True
    except Exception as e:
        print(f"HATA ({input_path}): {e}")
        return False

def main():
    # Screenshot'ları bul (png, jpg, jpeg)
    screenshot_patterns = [
        "screenshots/*.png",
        "screenshots/*.jpg",
        "screenshots/*.jpeg",
        "assets/*Screenshot*.png",
        "assets/*screenshot*.png",
        "assets/*.png",
        "assets/*.jpg",
        "*.png",
        "*.jpg",
        "*.jpeg"
    ]
    
    screenshots = []
    for pattern in screenshot_patterns:
        screenshots.extend(glob.glob(pattern))
    
    if not screenshots:
        print("UYARI: Screenshot bulunamadi!")
        print("Screenshot'lari 'screenshots' klasorune koyun veya proje root'una ekleyin")
        return
    
    # Çıktı klasörü oluştur
    output_dir = "app-store-screenshots"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"{len(screenshots)} screenshot bulundu")
    print(f"Hedef boyut: {PRIMARY_SIZE[0]}x{PRIMARY_SIZE[1]} (iPhone 6.5\" Display)")
    print(f"Cikti klasoru: {output_dir}/\n")
    
    # Her screenshot'ı işle
    for i, screenshot in enumerate(screenshots, 1):
        filename = os.path.basename(screenshot)
        name_without_ext = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{name_without_ext}_appstore.png")
        
        print(f"[{i}/{len(screenshots)}] Isleniyor: {filename}")
        resize_screenshot(screenshot, output_path, PRIMARY_SIZE)
        print()
    
    print(f"Tamamlandi! Screenshot'lar '{output_dir}' klasorunde.")
    print(f"Apple App Store'a yuklemek icin bu dosyalari kullanin.")

if __name__ == "__main__":
    main()

