import json
import re

SEED_FILE = 'server/seeds/vocabulary_seed.json'

def fix_vocab():
    try:
        with open(SEED_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        initial_count = len(data)
        cleaned_data = []
        
        # Regex patterns to clean:
        # "Word (1)" -> "Word"
        # "Word [N4-1]" -> "Word"
        pattern_parens = re.compile(r'\s*\(\d+\)$')
        pattern_brackets = re.compile(r'\s*\[[a-zA-Z0-9-]+\]$')
        
        fixed_count = 0
        
        for d in data:
            original_word = d.get('word', '')
            
            # 1. Clean Word
            new_word = pattern_parens.sub('', original_word)
            new_word = pattern_brackets.sub('', new_word)
            
            if new_word != original_word:
                d['word'] = new_word
                fixed_count += 1
            
            # 2. Filter out "Intermediate vocabulary:" garbage (double check)
            meaning = d.get('meaning', '')
            meaning_zh = d.get('meaning_zh', '')
            if "Intermediate vocabulary:" in meaning or "intermediate concept:" in meaning or "进阶词汇:" in meaning_zh:
                continue
                
            cleaned_data.append(d)
        
        final_count = len(cleaned_data)
        removed_count = initial_count - final_count
        
        with open(SEED_FILE, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
            
        print(f"Fixed vocabulary V3. Cleaned words: {fixed_count}. Removed entries: {removed_count}. Remaining: {final_count}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_vocab()
