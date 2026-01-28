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
        pattern_parens = re.compile(r'\s*\(\d+\)$')
        pattern_brackets = re.compile(r'\s*\[.*?\]$')
        
        # Garbage Definition Patterns
        bad_meaning_patterns = [
            "Basic German word:",
            "JLPT N",
            "Intermediate vocabulary:",
            "Intermediate concept:",
            "Basic vocabulary:"
        ]
        
        bad_meaning_zh_patterns = [
            "德语基础:",
            "N5 单词:",
            "N4 单词:",
            "N3 单词:",
            "N2 单词:",
            "N1 单词:",
            "进阶词汇:"
        ]

        deleted_garbage_count = 0
        cleaned_suffix_count = 0
        
        for d in data:
            original_word = d.get('word', '')
            meaning = d.get('meaning', '')
            meaning_zh = d.get('meaning_zh', '')
            
            # 1. Check for Garbage Definitions -> DELETE ENTRY
            is_garbage = False
            for p in bad_meaning_patterns:
                if p in meaning:
                    is_garbage = True
                    break
            
            if not is_garbage:
                for p in bad_meaning_zh_patterns:
                    if p in meaning_zh:
                        is_garbage = True
                        break
            
            if is_garbage:
                deleted_garbage_count += 1
                continue # Skip this entry
            
            # 2. Clean Word Suffixes (for remaining valid words)
            new_word = pattern_parens.sub('', original_word)
            new_word = pattern_brackets.sub('', new_word)
            
            if new_word != original_word:
                d['word'] = new_word
                cleaned_suffix_count += 1
            
            cleaned_data.append(d)
        
        final_count = len(cleaned_data)
        
        with open(SEED_FILE, 'w', encoding='utf-8') as f:
            json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
            
        print(f"Fixed vocabulary V4.")
        print(f"Deleted Garbage Entries: {deleted_garbage_count}")
        print(f"Cleaned Words suffixes: {cleaned_suffix_count}")
        print(f"Final Count: {final_count}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_vocab()
