const Database = require('better-sqlite3');
const db = new Database('./server/database.sqlite');
try {
    const likeQuery = `
        SELECT 
            tsi.id, tsi.ticket_number, tsi.title
        FROM ticket_search_index tsi
        WHERE (tsi.title LIKE @likeQuery OR tsi.description LIKE @likeQuery OR tsi.resolution LIKE @likeQuery OR tsi.tags LIKE @likeQuery)
        ORDER BY tsi.updated_at DESC
        LIMIT 5;
    `;
    const results = db.prepare(likeQuery).all({ likeQuery: '%音频%' });
    console.log("Success:", results);
} catch (e) {
    console.error("Error:", e.message);
}
