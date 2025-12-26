from PIL import Image, ImageDraw, ImageFont
import os

# Feature Graphic boyutları: 1024x500 piksel
WIDTH = 1024
HEIGHT = 500

# Uygulama renkleri
BG_COLOR = '#07070C'  # Koyu arka plan
ACCENT_COLOR = '#FFD66B'  # Altın sarısı (vurgu rengi)
TITLE_COLOR = '#FFFFFF'  # Beyaz başlık
SUBTITLE_COLOR = '#8E97A8'  # Gri alt başlık

# Yeni görsel oluştur
img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

# Gradient efekti için (basit gradient simülasyonu)
for y in range(HEIGHT):
    alpha = y / HEIGHT
    r = int(7 * (1 - alpha) + 35 * alpha)
    g = int(7 * (1 - alpha) + 44 * alpha)
    b = int(12 * (1 - alpha) + 105 * alpha)
    draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

# Basit bir desen ekle (sağ üst köşede)
for i in range(5):
    x = WIDTH - 100 - (i * 20)
    y = 50 + (i * 15)
    size = 30 - (i * 5)
    draw.ellipse([x - size, y - size, x + size, y + size], 
                 outline=ACCENT_COLOR, width=2)

# Font boyutları (sistem fontları kullanılacak)
try:
    # Windows için
    title_font = ImageFont.truetype("arial.ttf", 72)
    subtitle_font = ImageFont.truetype("arial.ttf", 32)
except:
    # Fallback için default font
    title_font = ImageFont.load_default()
    subtitle_font = ImageFont.load_default()

# Başlık: "Knight Rehber"
title = "Knight Rehber"
title_bbox = draw.textbbox((0, 0), title, font=title_font)
title_width = title_bbox[2] - title_bbox[0]
title_x = (WIDTH - title_width) // 2
title_y = HEIGHT // 2 - 60

# Başlık gölgesi (daha iyi okunabilirlik için)
draw.text((title_x + 3, title_y + 3), title, fill=(0, 0, 0, 128), font=title_font)
# Ana başlık
draw.text((title_x, title_y), title, fill=TITLE_COLOR, font=title_font)

# Alt başlık
subtitle = "Knight Online Rehberi"
subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
subtitle_x = (WIDTH - subtitle_width) // 2
subtitle_y = title_y + 90

# Alt başlık gölgesi
draw.text((subtitle_x + 2, subtitle_y + 2), subtitle, fill=(0, 0, 0, 128), font=subtitle_font)
# Ana alt başlık
draw.text((subtitle_x, subtitle_y), subtitle, fill=ACCENT_COLOR, font=subtitle_font)

# Özellikler (ikonlar ve kısa açıklamalar)
features = ["📅 Etkinlikler", "💰 Merchant", "⚔️ Skill"]
feature_y = subtitle_y + 70
feature_spacing = WIDTH // (len(features) + 1)

for i, feature in enumerate(features):
    x = feature_spacing * (i + 1)
    # Basit bir kutu çiz
    box_width = 200
    box_height = 50
    box_x = x - box_width // 2
    box_y = feature_y
    
    # Yarı saydam arka plan kutusu
    overlay = Image.new('RGBA', (box_width, box_height), (255, 255, 255, 20))
    img.paste(overlay, (box_x, box_y), overlay)
    
    # Özellik metni
    feature_bbox = draw.textbbox((0, 0), feature, font=subtitle_font)
    feature_text_width = feature_bbox[2] - feature_bbox[0]
    feature_text_x = x - feature_text_width // 2
    draw.text((feature_text_x, box_y + 10), feature, fill=TITLE_COLOR, font=subtitle_font)

# Sol alt köşede küçük vurgu çizgisi
draw.rectangle([50, HEIGHT - 5, 250, HEIGHT], fill=ACCENT_COLOR)

# Sağ alt köşede küçük vurgu çizgisi
draw.rectangle([WIDTH - 250, HEIGHT - 5, WIDTH - 50, HEIGHT], fill=ACCENT_COLOR)

# Dosyayı kaydet
output_path = "assets/feature-graphic.png"
img.save(output_path, "PNG", quality=95, optimize=True)

print(f"Feature graphic olusturuldu: {output_path}")
print(f"Boyut: {WIDTH}x{HEIGHT} piksel")
print(f"Dosya boyutu kontrol ediliyor...")

file_size = os.path.getsize(output_path) / (1024 * 1024)  # MB
print(f"Dosya boyutu: {file_size:.2f} MB (max 15 MB)")

if file_size > 15:
    print("UYARI: Dosya boyutu 15 MB'dan buyuk! Kaliteyi dusurmayi dusunun.")
else:
    print("Dosya boyutu uygun!")

