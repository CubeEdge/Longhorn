const Database = require('better-sqlite3');
const db = new Database('./server/longhorn.db', { readonly: true });
console.log(db.prepare("SELECT title FROM knowledge_articles LIMIT 5").all());
