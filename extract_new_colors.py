
from PIL import Image
import os

def get_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

base_path = '/Users/Kine/.gemini/antigravity/brain/15cd015c-d368-4d97-8a63-23d3e094badc'
new_image = os.path.join(base_path, 'media__1771984046641.png')

img = Image.open(new_image).convert('RGB')

# Sampling points from the new image (Backup UI)
# 1. "主备份" text (roughly middle top)
# x=200, y=130
c1 = get_hex(img.getpixel((200, 130)))

# 2. Toggle switch (roughly right middle)
# x=810, y=325
c2 = get_hex(img.getpixel((810, 325)))

# 3. "3h" button (roughly left middle)
# x=180, y=600
c3 = get_hex(img.getpixel((180, 600)))

print(f"Backup Title Text: {c1}")
print(f"Toggle Switch: {c2}")
print(f"Selected 3h Button: {c3}")
