#!/bin/bash
# Query product_models sn_prefix values

DB_PATH="$HOME/Documents/server/Longhorn/server/longhorn.db"

echo "=== Product Models Table Structure ==="
sqlite3 "$DB_PATH" "PRAGMA table_info(product_models);"

echo ""
echo "=== Sample Data (first 10 rows) ==="
sqlite3 "$DB_PATH" "SELECT id, name_zh, sn_prefix, product_family FROM product_models WHERE is_active=1 LIMIT 10;"

echo ""
echo "=== Count products with sn_prefix ==="
sqlite3 "$DB_PATH" "SELECT COUNT(*) as total, SUM(CASE WHEN sn_prefix IS NOT NULL AND sn_prefix != '' THEN 1 ELSE 0 END) as with_prefix FROM product_models WHERE is_active=1;"
