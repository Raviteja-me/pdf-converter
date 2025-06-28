const http = require('http');

const testData = {
    html: '<!DOCTYPE html><html><head><style>body { background: red; color: white; font-size: 24px; padding: 20px; }</style></head><body><h1>Test with 0.5 inch margins</h1><p>This should have white margins around the red background.</p></body></html>',
    options: {
        margin: 0.5
    }
};

const postData = JSON.stringify(testData);

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
    console.log(`Headers:`, res.headers);
    
    if (res.statusCode === 200) {
        const chunks = [];
        res.on('data', (chunk) => {
            chunks.push(chunk);
        });
        res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            require('fs').writeFileSync('test_margin_0.5.pdf', buffer);
            console.log(`✅ PDF saved as: test_margin_0.5.pdf`);
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