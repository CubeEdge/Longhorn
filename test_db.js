const Database = require('better-sqlite3');
const db = new Database('./server/longhorn.db');

const query = '"' + "Edge支持的色温是多少？".replace(/"/g, '""') + '"';

const searchQuery = `
    SELECT 
        tsi.ticket_number,
        tsi.ticket_type,
        tsi.ticket_id,
        tsi.title,
        tsi.resolution,
        tsi.product_model,
        tsi.account_id,
        fts.rank
    FROM ticket_search_index tsi
    INNER JOIN ticket_search_fts fts ON tsi.id = fts.rowid
    WHERE fts MATCH @query
        AND tsi.closed_at IS NOT NULL
    ORDER BY fts.rank
    LIMIT @limit
`;

try {
    const results = db.prepare(searchQuery).all({ query, limit: 3 });
    console.log(results);
} catch (err) {
    console.error("ERROR", err);
}
