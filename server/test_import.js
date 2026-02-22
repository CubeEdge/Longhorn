const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function test() {
    try {
        const payload = {
            id: 1,
            username: 'admin',
            role: 'Admin',
            user_type: 'Employee'
        };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'kine_service_secret_key_2024', { expiresIn: '24h' });

        console.log('Testing URL Import...');
        const importRes = await axios.post('http://localhost:4000/api/v1/knowledge/import/url', {
            url: 'https://kinefinity.com/kineos-8-0-notes/',
            category: 'Application Note',
            product_line: 'A',
            product_models: ['MAVO Edge 8K'],
            visibility: 'Public',
            tags: []
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Import successful:', JSON.stringify(importRes.data, null, 2));
    } catch (err) {
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', JSON.stringify(err.response.data, null, 2));
        } else {
            console.error('Error Message:', err.message);
        }
    }
}

test();
