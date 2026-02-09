import sqlite3, pickle

with open("/tmp/fixed_manual_articles.pkl", "rb") as f:
    data = pickle.load(f)

db = sqlite3.connect("/Users/admin/Documents/server/Longhorn/server/longhorn.db")
cursor = db.cursor()

cursor.execute("DELETE FROM knowledge_articles WHERE category = 'Manual'")
print("✓ 已删除旧的Manual文章")

placeholders = ",".join(["?" for _ in data["columns"]])
columns_str = ",".join(data["columns"])
sql = f"INSERT INTO knowledge_articles ({columns_str}) VALUES ({placeholders})"
cursor.executemany(sql, data["rows"])
db.commit()

count = cursor.execute("SELECT COUNT(*) FROM knowledge_articles WHERE category = 'Manual'").fetchone()[0]
print(f"✅ 已导入 {count} 篇修复后的Manual文章")

test = cursor.execute("SELECT title, SUBSTR(content, 1, 100) FROM knowledge_articles WHERE id = 36").fetchone()
if test:
    print(f"验证: {test[0]}")
    print(f"内容: {test[1]}...")

db.close()
