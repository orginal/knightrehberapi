from PIL import Image
import os
import glob

# iPad 13-inch (Pro) gereksinimi
IPAD_SIZE = (2048, 2732)

def resize_for_ipad(input_path, output_path):
    """Screenshot'ı iPad boyutuna getir"""
    try:
        img = Image.open(input_path)
        original_size = img.size
        print(f"Orijinal boyut: {original_size[0]}x{original_size[1]}")
        
        target_width, target_height = IPAD_SIZE
        
        # Aspect ratio'yu koruyarak yeniden boyutlandır
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
        
        # Yeniden boyutlandır
        resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Eğer tam boyut değilse, ortaya hizalı siyah arka plan ekle
        if new_width != target_width or new_height != target_height:
            final_img = Image.new('RGB', IPAD_SIZE, (0, 0, 0))
            x_offset = (target_width - new_width) // 2
            y_offset = (target_height - new_height) // 2
            final_img.paste(resized, (x_offset, y_offset))
            final_img.save(output_path, "PNG", quality=95, optimize=True)
            print(f"Olusturuldu: {output_path} ({target_width}x{target_height}) - Ortalandi")
        else:
            resized.save(output_path, "PNG", quality=95, optimize=True)
            print(f"Olusturuldu: {output_path} ({target_width}x{target_height})")
        
        return True
    except Exception as e:
        print(f"HATA ({input_path}): {e}")
        return False

def main():
    # Screenshot'ları bul
    screenshot_patterns = [
        "screenshots/*.png",
        "screenshots/*.jpg",
        "screenshots/*.jpeg",
        "app-store-screenshots/photo_*_appstore.png"
    ]
    
    screenshots = []
    for pattern in screenshot_patterns:
        screenshots.extend(glob.glob(pattern))
    
    if not screenshots:
        print("UYARI: Screenshot bulunamadi!")
        return
    
    # Çıktı klasörü oluştur
    output_dir = "ipad-screenshots"
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"{len(screenshots)} screenshot bulundu")
    print(f"Hedef boyut: {IPAD_SIZE[0]}x{IPAD_SIZE[1]} (iPad 13-inch)")
    print(f"Cikti klasoru: {output_dir}/\n")
    
    # Her screenshot'ı işle
    for i, screenshot in enumerate(screenshots, 1):
        filename = os.path.basename(screenshot)
        name_without_ext = os.path.splitext(filename)[0]
        # "_appstore" varsa kaldır
        name_without_ext = name_without_ext.replace("_appstore", "")
        output_path = os.path.join(output_dir, f"{name_without_ext}_ipad.png")
        
        print(f"[{i}/{len(screenshots)}] Isleniyor: {filename}")
        resize_for_ipad(screenshot, output_path)
        print()
    
    print(f"Tamamlandi! iPad screenshot'lari '{output_dir}' klasorunde.")
    print(f"App Store Connect'e yuklemek icin bu dosyalari kullanin.")

if __name__ == "__main__":
    main()



