import json
import re

SEED_FILE = 'server/seeds/vocabulary_seed.json'

def fix_vocab():
    try:
        with open(SEED_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        initial_count = len(data)
        cleaned_data = []
        
        # Regex patterns to clean suffixes from Words
        # "Word (1)" -> "Word"
        # "Word [A2-1]" -> "Word"
        pattern_parens = re.compile(r'\s*\(\d+\)$')
        pattern_brackets = re.compile(r'\s*\[.*?\]$')
        
        # Regex to Identify Garbage Definitions
        # Matches: "A2 Vocabulary:", "Basic German word:", "JLPT N5 Word:", "A common elementary word:"
        # We delete these entries entirely.
        garbage_meaning_re = re.compile(r'(Vocabulary:|word:|Word:|concept:|N\d+ 单词:|德语基础:|词汇:)')

        deleted_garbage_count = 0
        cleaned_suffix_count = 0
        
        for d in data:
            original_word = d.get('word', '')
            meaning = d.get('meaning', '')
            meaning_zh = d.get('meaning_zh', '')
            
            # 1. Check for Garbage Definitions -> DELETE ENTRY
            # Use strict checks to ensure we don't delete real content.
            # Real content shouldn't have "Vocabulary:" or "Basic ... word:"
            
            is_garbage = False
            
            if garbage_meaning_re.search(meaning):
                 # Double check it's not a valid sentence like "The word 'Bat' means..."
                 # But our garbage is usually "X Vocabulary: Y"
                 if ":" in meaning:
                     is_garbage = True
            
            if not is_garbage and garbage_meaning_re.search(meaning_zh):
                if ":" in meaning_zh:
                    is_garbage = True
            
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
            
        print(f"Fixed vocabulary V5 (Aggressive).")
        print(f"Deleted Garbage Entries: {deleted_garbage_count}")
        print(f"After cleaning suffixes: {cleaned_suffix_count}")
        print(f"Final Count: {final_count}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_vocab()
