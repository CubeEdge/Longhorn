
import json

path = '/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/ios/LonghornApp/Resources/Localizable.xcstrings'

def create_entry(en, de, zh, ja):
    return {
        "extractionState": "manual",
        "localizations": {
            "en": {"stringUnit": {"state": "translated", "value": en}},
            "de": {"stringUnit": {"state": "translated", "value": de}},
            "zh-Hans": {"stringUnit": {"state": "translated", "value": zh}},
            "ja": {"stringUnit": {"state": "translated", "value": ja}}
        }
    }

updates = {
    "personal.core_stats": create_entry("Core Stats", "Wichtige Statistiken", "核心数据", "統計情報"),
    "dept.OP": create_entry("Operations", "Betrieb", "运营部", "オペレーション"),
    "dept.RD": create_entry("R&D", "F&E", "研发部", "研究開発"),
    "dept.RE": create_entry("General Resource", "Allgemeine Ressourcen", "通用台面", "一般リソース"),
    "dept.MS": create_entry("Marketing", "Marketing", "市场部", "マーケティング"),
    # Fixing potentially missing keys from screenshot 2 if any
    "file.count_suffix": create_entry("Files", "Dateien", "个文件", "ファイル"),
    
    # Toast & Hints
    "hint.pull_refresh": create_entry("Pull to refresh", "Zum Aktualisieren ziehen", "下拉刷新", "引っ張って更新"),
    "toast.folder_created": create_entry("Folder created", "Ordner erstellt", "文件夹已创建", "フォルダを作成しました"),
    "toast.rename_success": create_entry("Renamed successfully", "Umbenannt", "重命名成功", "名前を変更しました"),
    "toast.delete_success": create_entry("Deleted successfully", "Gelöscht", "删除成功", "削除しました"),
    "toast.move_success": create_entry("Moved successfully", "Verschoben", "移动成功", "移動しました"),
    "toast.copy_success": create_entry("Copied successfully", "Kopiert", "复制成功", "コピーしました"),
}

try:
    with open(path, 'r') as f:
        data = json.load(f)
    
    strings = data.get('strings', {})
    
    for key, entry in updates.items():
        # Update or add, preserving existing if we want, but here we overwrite to ensure correctness
        # for department keys specifically as they seemed problematic
        print(f"Updating {key}...")
        strings[key] = entry
        
    data['strings'] = strings
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Successfully updated Localizable.xcstrings")

except Exception as e:
    print(f"Error: {e}")
