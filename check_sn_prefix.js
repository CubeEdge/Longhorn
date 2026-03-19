// Check sn_prefix values in product_models
const db = require('better-sqlite3')('./server/database.sqlite');

const products = db.prepare(`
    SELECT id, name_zh, sn_prefix, product_family 
    FROM product_models 
    WHERE is_active = 1 
    LIMIT 30
`).all();

console.log('\n=== Product Models with sn_prefix ===\n');
products.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name_zh}, SN_PREFIX: "${p.sn_prefix || 'NULL'}", Family: ${p.product_family}`);
});

// Count products with/without sn_prefix
const withPrefix = products.filter(p => p.sn_prefix).length;
const withoutPrefix = products.filter(p => !p.sn_prefix).length;
console.log(`\n=== Summary ===`);
console.log(`Total: ${products.length}, With sn_prefix: ${withPrefix}, Without: ${withoutPrefix}`);

// Check if any starts with 'K' or 'KV'
const kPrefix = products.filter(p => p.sn_prefix && p.sn_prefix.toUpperCase().startsWith('K'));
console.log(`\nProducts with sn_prefix starting with 'K': ${kPrefix.length}`);
kPrefix.forEach(p => console.log(`  - ${p.name_zh}: "${p.sn_prefix}"`));

db.close();
