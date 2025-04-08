const express = require('express');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const Handlebars = require('handlebars');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080; // Updated to standard GCP port

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize puppeteer browser with more robust options
let browser;
(async () => {
    browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
            '--font-render-hinting=none'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080,
            deviceScaleFactor: 2
        }
    });
})();

// Enhanced HTML to PDF conversion
app.post('/html-to-pdf', async (req, res) => {
    const { html, options = {} } = req.body;

    if (!html) {
        return res.status(400).json({ error: 'HTML content is required' });
    }

    let page;
    try {
        // Ensure browser is available
        if (!browser) {
            browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage'
                ]
            });
        }

        page = await browser.newPage();
        
        // Set content directly without viewport manipulation
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Generate PDF with simplified options
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true
        });

        // Clear any previous headers
        res.removeHeader('Content-Type');
        res.removeHeader('Content-Disposition');
        
        // Set binary response headers
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length,
            'Content-Disposition': 'attachment; filename="document.pdf"'
        });
        
        // End response with buffer
        res.end(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to convert HTML to PDF',
                details: error.message
            });
        }
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (e) {
                console.error('Error closing page:', e);
            }
        }
    }
});

// Text to PDF with enhanced features
app.post('/text-to-pdf', async (req, res) => {
    const { text, options = {} } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text content is required' });
    }

    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
        
        const { fontSize = 12, fontFamily = 'Helvetica' } = options;
        
        page.drawText(text, {
            x: 50,
            y: page.getHeight() - 50,
            size: fontSize,
            maxWidth: page.getWidth() - 100
        });

        const pdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${options.filename || 'document.pdf'}"`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({
            error: 'Failed to convert text to PDF',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (!res.headersSent) {
        res.status(500).json({
            error: 'Something went wrong!',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

app.listen(port, () => {
    console.log(`Enhanced PDF Converter running at http://localhost:${port}`);
});