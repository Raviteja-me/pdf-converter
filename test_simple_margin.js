const http = require('http');

// Test with a simple HTML that should clearly show margins
const testData = {
    html: '<!DOCTYPE html><html><head><style>body { background: blue; color: white; font-size: 24px; margin: 0; padding: 20px; }</style></head><body><h1>API Test with 0.5 inch margins</h1><p>If you see white margins around this blue background, it works!</p></body></html>',
    options: {
        margin: 0.5
    }
};

const postData = JSON.stringify(testData);

console.log('Sending request with data:', JSON.stringify(testData, null, 2));

const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/html-to-pdf',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
        });
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            require('fs').writeFileSync('api_test_margin.pdf', buffer);
            console.log(`✅ PDF saved as: api_test_margin.pdf`);
            console.log(`📄 File size: ${buffer.length} bytes`);
        });
    } else {
        let errorData = '';
        res.on('data', (chunk) => {
            errorData += chunk;
        });
        res.on('end', () => {
            console.log(`❌ Error: ${errorData}`);
        });
    }
});

req.on('error', (err) => {
    console.log(`❌ Request error: ${err.message}`);
});

req.write(postData);
req.end(); 