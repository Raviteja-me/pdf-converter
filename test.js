const fs = require('fs');
const https = require('https');
const http = require('http');

// Read the HTML file
const htmlContent = fs.readFileSync('test.html', 'utf8');

// Test cases
const testCases = [
    {
        name: 'no_margins',
        data: {
            html: htmlContent,
            options: {
                margin: null
            }
        }
    },
    {
        name: 'default_margins',
        data: {
            html: htmlContent
        }
    },
    {
        name: 'custom_margins',
        data: {
            html: htmlContent,
            options: {
                margin: {
                    top: '1in',
                    right: '0.5in',
                    bottom: '1in',
                    left: '0.5in'
                }
            }
        }
    }
];

// Function to make HTTP request
function makeRequest(testCase) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(testCase.data);
        
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
            console.log(`\n=== Testing ${testCase.name} ===`);
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, res.headers);
            
            if (res.statusCode === 200) {
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const filename = `${testCase.name}.pdf`;
                    fs.writeFileSync(filename, buffer);
                    console.log(`✅ PDF saved as: ${filename}`);
                    console.log(`📄 File size: ${buffer.length} bytes`);
                    resolve(filename);
                });
            } else {
                let errorData = '';
                res.on('data', (chunk) => {
                    errorData += chunk;
                });
                res.on('end', () => {
                    console.log(`❌ Error: ${errorData}`);
                    reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
                });
            }
        });

        req.on('error', (err) => {
            console.log(`❌ Request error: ${err.message}`);
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// Run all tests
async function runTests() {
    console.log('🚀 Starting PDF Converter Tests...\n');
    
    for (const testCase of testCases) {
        try {
            await makeRequest(testCase);
        } catch (error) {
            console.log(`❌ Test ${testCase.name} failed: ${error.message}`);
        }
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Generated files:');
    testCases.forEach(testCase => {
        console.log(`   - ${testCase.name}.pdf`);
    });
}

// Run the tests
runTests().catch(console.error); 