const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const SEED_PATH = path.join(__dirname, '../seeds/vocabulary_seed.json');

function reseed() {
    console.log('Opening database:', DB_PATH);
    const db = new Database(DB_PATH);

    console.log('Reading seed file:', SEED_PATH);
    const seeds = JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));

    console.log(`Found ${seeds.length} entries in seed file.`);

    // Check if table exists
    const tableExists = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='vocabulary'").get();
    if (!tableExists || tableExists.c === 0) {
        console.log('Vocabulary table does not exist. Please run the server to initialize schema first.');
        process.exit(1);
    }

    // Clear table
    console.log('Clearing vocabulary table...');
    const deleteResult = db.prepare('DELETE FROM vocabulary').run();
    console.log(`Deleted ${deleteResult.changes} rows.`);

    // Reset sequence if needed (optional)
    try {
        db.prepare("DELETE FROM sqlite_sequence WHERE name='vocabulary'").run();
    } catch (e) {
        // ignore
    }

    // Insert seeds
    console.log('Inserting new data...');
    const insertStmt = db.prepare(`
        INSERT INTO vocabulary (language, level, word, phonetic, meaning, meaning_zh, part_of_speech, examples, image)
        VALUES (@language, @level, @word, @phonetic, @meaning, @meaning_zh, @part_of_speech, @examples, @image)
    `);

    const insertTransaction = db.transaction((data) => {
        let count = 0;
        for (const item of data) {
            insertStmt.run({
                language: item.language,
                level: item.level,
                word: item.word,
                phonetic: item.phonetic || '',
                meaning: item.meaning || '',
                meaning_zh: item.meaning_zh || '',
                part_of_speech: item.part_of_speech || '',
                examples: JSON.stringify(item.examples || []),
                image: item.image || ''
            });
            count++;
            if (count % 1000 === 0) process.stdout.write(`Inserted ${count}...\r`);
        }
    });

    try {
        insertTransaction(seeds);
        console.log('\nReseed completed successfully.');
    } catch (err) {
        console.error('Transaction failed:', err);
    }

    db.close();
}

reseed();
