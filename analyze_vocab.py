import json
from collections import defaultdict

FILE = 'server/seeds/vocabulary_seed.json'

try:
    with open(FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    counts = defaultdict(int)
    for item in data:
        key = f"{item.get('language')} - {item.get('level')}"
        counts[key] += 1

    print("Current Counts (Target: 300):")
    for key, count in sorted(counts.items()):
        status = "✅" if count >= 300 else f"❌ (Need {300 - count})"
        print(f"{key}: {count} {status}")

except Exception as e:
    print(f"Error: {e}")
