const express = require('express');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const Handlebars = require('handlebars');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

// 中间件
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 添加健康检查端点
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 添加根端点
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'PDF Converter API',
        status: 'running',
        endpoints: ['/html-to-pdf', '/text-to-pdf']
    });
});

// 初始化 Puppeteer 浏览器
let browser;
let browserInitializing = false;
const initBrowser = async () => {
    if (browserInitializing) return null;
    
    browserInitializing = true;
    try {
        console.log('Initializing Puppeteer browser...');
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
        console.log('Puppeteer browser initialized successfully');
        browserInitializing = false;
        return browser;
    } catch (error) {
        console.error('Failed to initialize Puppeteer browser:', error);
        browserInitializing = false;
        return null;
    }
};

// HTML 转 PDF 端点
app.post('/html-to-pdf', async (req, res) => {
    const { html, options = {} } = req.body;

    if (!html) {
        return res.status(400).json({ error: 'HTML content is required' });
    }

    let page;
    try {
        // Ensure browser is available
        if (!browser) {
            console.log('Browser not initialized, attempting to initialize now...');
            browser = await initBrowser();
            if (!browser) {
                return res.status(500).json({ error: 'Failed to initialize browser' });
            }
        }

        page = await browser.newPage();
        
        // Set content directly without viewport manipulation
        await page.setContent(html, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Replace waitForTimeout with a compatible delay method
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Ensure all content is properly rendered
        await page.evaluateHandle('document.fonts.ready');
        
        // Generate PDF with enhanced options for background rendering
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in'
            }
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

// Start the server first, then initialize browser
const server = app.listen(port, '0.0.0.0', () => {
    console.log(`PDF Converter running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Puppeteer executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    
    // Initialize browser after server is started, but don't wait for it
    setTimeout(() => {
        console.log('Starting browser initialization...');
        initBrowser().catch(error => {
            console.error('Failed to initialize browser, but server is running:', error);
        });
    }, 2000);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(async () => {
        console.log('HTTP server closed');
        if (browser) {
            await browser.close();
            console.log('Browser closed');
        }
        process.exit(0);
    });
    
    // Force exit after timeout
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
});