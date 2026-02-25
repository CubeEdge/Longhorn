
from PIL import Image
import os

def get_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(rgb[0], rgb[1], rgb[2])

base_path = '/Users/Kine/.gemini/antigravity/brain/15cd015c-d368-4d97-8a63-23d3e094badc'
new_image = os.path.join(base_path, 'media__1771984046641.png')

img = Image.open(new_image).convert('RGB')

results = []
# "主备份" text
results.append(("Text 1", get_hex(img.getpixel((200, 130)))))
# Switch (Green part) - center of the toggle
results.append(("Toggle", get_hex(img.getpixel((800, 325)))))
# "3h" button (Selected)
results.append(("3h Button", get_hex(img.getpixel((175, 595)))))
# Bottom text "主备份状态"
results.append(("Bottom Text", get_hex(img.getpixel((250, 965)))))

for name, color in results:
    print(f"{name}: {color}")
