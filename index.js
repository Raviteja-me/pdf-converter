const express = require('express');
const pdfkit = require('pdfkit');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3000;

// Add middleware to parse JSON and increase payload limit
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Test endpoint
app.get('/', (req, res) => {
    res.send('PDF Converter API is running!');
});

// Text to PDF endpoint
app.get('/create-pdf', (req, res) => {
    const text = req.query.text;
    
    if (!text) {
        return res.status(400).json({ error: 'Text parameter is required. Use ?text=YourText' });
    }

    const doc = new pdfkit();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
    doc.pipe(res);
    doc.fontSize(12).text(text);
    doc.end();
});

// Modified HTML to PDF endpoint using Puppeteer
app.post('/html-to-pdf', async (req, res) => {
    const html = req.body.html;
    
    if (!html) {
        return res.status(400).json({ error: 'HTML content is required in request body' });
    }

    try {
        // Configure Puppeteer options based on environment
        const options = process.env.K_SERVICE ? {
            // Cloud Run configuration
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ],
            headless: 'new',
            executablePath: '/usr/bin/chromium'
        } : {
            // Local configuration
            headless: 'new'
        };

        const browser = await puppeteer.launch(options);
        const page = await browser.newPage();
        
        // Add default styling
        const styledHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
                    h1 { color: #2c3e50; margin-bottom: 0.5em; }
                    h2 { color: #3498db; margin-top: 1em; }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `;

        await page.setContent(styledHtml);
        
        const pdf = await page.pdf({
            format: 'A4',
            margin: {
                top: '2cm',
                right: '2cm',
                bottom: '2cm',
                left: '2cm'
            },
            printBackground: true
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="webpage.pdf"');
        res.send(pdf);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to convert HTML to PDF' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});