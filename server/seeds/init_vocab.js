const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const SEED_PATH = path.join(__dirname, 'vocabulary_seed.json');

const db = new Database(DB_PATH, { verbose: console.log });

console.log('Initializing vocabulary table...');

// 1. Create Table
db.prepare(`
    CREATE TABLE IF NOT EXISTS vocabulary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        level TEXT DEFAULT 'General',
        word TEXT NOT NULL,
        phonetic TEXT,
        meaning TEXT,
        meaning_zh TEXT,
        part_of_speech TEXT,
        examples TEXT, -- JSON string
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// 2. Clear existing (Optional, for dev repeatability)
// db.prepare('DELETE FROM vocabulary').run();

// 3. Load Seed
if (fs.existsSync(SEED_PATH)) {
    const seeds = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    const insert = db.prepare(`
        INSERT INTO vocabulary (language, level, word, phonetic, meaning, meaning_zh, part_of_speech, examples, image)
        VALUES (@language, @level, @word, @phonetic, @meaning, @meaning_zh, @part_of_speech, @examples, @image)
    `);

    const insertMany = db.transaction((items) => {
        for (const item of items) {
            // Check existence to prevent duplicates
            const exists = db.prepare('SELECT 1 FROM vocabulary WHERE word = ? AND language = ?').get(item.word, item.language);
            if (!exists) {
                insert.run({
                    ...item,
                    examples: JSON.stringify(item.examples),
                    image: item.image || null
                });
            }
        }
    });

    insertMany(seeds);
    console.log(`Seeded ${seeds.length} vocabulary items.`);
} else {
    console.log('No seed file found.');
}

console.log('Vocabulary initialization complete.');
db.close();
