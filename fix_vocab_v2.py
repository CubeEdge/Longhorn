import json

SEED_FILE = 'server/seeds/vocabulary_seed.json'

def fix_vocab():
    try:
        with open(SEED_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        initial_count = len(data)
        
        # Filter out bad entries
        # Logic: Meaning starts with "Intermediate vocabulary:" or "intermediate concept:"
        # Or meaning_zh starts with "进阶词汇:"
        
        cleaned_data = []
        for d in data:
            meaning = d.get('meaning', '')
            meaning_zh = d.get('meaning_zh', '')
            
            if "Intermediate vocabulary:" in meaning:
                continue
            if "intermediate concept:" in meaning:
                continue
            if "进阶词汇:" in meaning_zh:
                continue
                
            cleaned_data.append(d)
        
        final_count = len(cleaned_data)
        removed_count = initial_count - final_count
        
        with open(SEED_FILE, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
            
        print(f"Fixed vocabulary V2. Removed {removed_count} corrupted entries. Remaining: {final_count}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_vocab()
