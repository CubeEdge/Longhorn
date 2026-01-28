const https = require('https');

const HOST = 'opware.kineraw.com';

const testCombos = [
    { lang: 'en', level: 'Advanced' },
    { lang: 'en', level: 'Intermediate' },
    { lang: 'en', level: 'Common Phrases' }, // Space!
    { lang: 'zh', level: 'Idioms' },
    { lang: 'de', level: 'A1' }
];

function test(lang, level) {
    const safeLevel = level.charAt(0).toUpperCase() + level.slice(1);
    const path = `/api/vocabulary/batch?language=${lang}&level=${encodeURIComponent(safeLevel)}&count=5`;

    const options = {
        hostname: HOST,
        path: path,
        method: 'GET',
        headers: {
            'User-Agent': 'NodeTest'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.log(`[FAIL] ${lang}/${level} -> Status: ${res.statusCode}`);
            } else {
                try {
                    const json = JSON.parse(data);
                    console.log(`[PASS] ${lang}/${level} -> Count: ${json.length}`);
                    if (json.length === 0) console.warn(`      WARNING: Empty array returned!`);
                } catch (e) {
                    console.log(`[FAIL] ${lang}/${level} -> JSON Parse Error. Data: ${data.substring(0, 50)}...`);
                }
            }
        });
    });

    req.on('error', (e) => {
        console.error(`[ERR] ${lang}/${level} -> ${e.message}`);
    });

    req.end();
}

testCombos.forEach(c => test(c.lang, c.level));
