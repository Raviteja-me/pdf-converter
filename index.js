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
        endpoints: ['/html-to-pdf', '/measure', '/text-to-pdf']
    });
});

// 初始化 Puppeteer 浏览器
let browser;
// A single in-flight initialisation, awaited by everyone who needs the browser.
// This used to be a boolean that made concurrent callers give up: on a cold
// start the browser takes several seconds to come up, so every request in that
// window — the requests that caused the cold start — was answered with
// "Failed to initialize browser".
let browserInitPromise = null;

const initBrowser = async () => {
    if (browserInitPromise) return browserInitPromise;
    browserInitPromise = launchBrowser().finally(() => {
        browserInitPromise = null;
    });
    return browserInitPromise;
};

const launchBrowser = async () => {
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
        return browser;
    } catch (error) {
        console.error('Failed to initialize Puppeteer browser:', error);
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
        // Ensure browser is available. Checked for a live connection, not just
        // for existence: a crashed Chromium left a truthy handle behind and
        // every request after it failed until the instance was replaced.
        if (browser && browser.connected === false) {
            console.log('Browser connection lost, discarding it');
            browser = null;
        }
        if (!browser) {
            console.log('Browser not initialized, attempting to initialize now...');
            browser = await initBrowser();
            if (!browser) {
                return res.status(500).json({ error: 'Failed to initialize browser' });
            }
        }

        page = await browser.newPage();
        
        // Set content directly without viewport manipulation.
        //
        // networkidle0 is the right wait for a document that pulls in remote
        // images, stylesheets or web fonts. For a self-contained document it is
        // the wrong one: there is no network activity to go idle, and on some
        // Chrome builds the wait simply never resolves and the request dies on
        // the navigation timeout. Callers that inline everything ask for the
        // load event instead with fast: true.
        await page.setContent(html, {
            waitUntil: options.fast === true ? 'load' : 'networkidle0',
            timeout: 30000
        });

        // A fixed settle delay for documents that pull in remote assets. Every
        // caller that inlines everything it needs can skip it with fast: true,
        // which matters when one request renders a document more than once.
        if (options.fast !== true) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Ensure all content is properly rendered
        await page.evaluateHandle('document.fonts.ready');
        
        // Prepare PDF options
        const pdfOptions = {
            format: options.format || 'A4',
            // Backgrounds print unless a caller explicitly turns them off.
            // Resume designs are largely coloured panels and rules, so this
            // defaulting to true is load-bearing.
            printBackground: options.printBackground !== false
        };

        // Handle margin configuration
        console.log('=== MARGIN DEBUGGING ===');
        console.log('options:', options);
        console.log('options.margin:', options.margin);
        console.log('typeof options.margin:', typeof options.margin);
        
        if (options.margin) {
            if (typeof options.margin === 'number') {
                // Single number - apply to all sides
                const marginValue = options.margin + 'in';
                pdfOptions.margin = {
                    top: marginValue,
                    right: marginValue,
                    bottom: marginValue,
                    left: marginValue
                };
                console.log('✅ Setting numeric margin:', marginValue, 'on all sides');
            } else if (typeof options.margin === 'object') {
                // Object with specific values
                pdfOptions.margin = options.margin;
                console.log('✅ Setting custom margin object:', options.margin);
            }
            pdfOptions.preferCSSPageSize = options.preferCSSPageSize === true;
        } else {
            // Default: No margins
            pdfOptions.margin = {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            };
            // The page's own @page rule wins. A document that declares its
            // margins in CSS gets them on every page, which is the only way a
            // second page opens with a top margin instead of flush against the
            // paper edge.
            pdfOptions.preferCSSPageSize = options.preferCSSPageSize !== false;
            console.log('✅ Using default: NO MARGINS');
        }

        if (options.pageRanges) pdfOptions.pageRanges = String(options.pageRanges);
        
        console.log('Final PDF options:', JSON.stringify(pdfOptions, null, 2));
        console.log('=== END MARGIN DEBUGGING ===');
        
        // Generate PDF with configured options
        const pdfBuffer = await page.pdf(pdfOptions);

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

// ---------------------------------------------------------------------------
// Layout measurement, for Magic CV.
//
// Added because the caller previously had no way to find out whether the HTML
// it sent would fit on a page. It had to guess the rendered height with a
// hand-written model in Node, render, count pages in the PDF bytes, shrink and
// render again — three round trips to answer a question the browser already
// knows the answer to. This endpoint asks Chromium directly.
//
// The viewport is set to the page's own content box (A4 minus its margins), so
// what is measured is the print layout rather than a 1920px-wide web layout.
// Anything the document marks with data-fit is measured as the real content
// bottom, which matters for layouts whose wrapper is stretched by a background
// panel and would otherwise always report a full page.
// ---------------------------------------------------------------------------

const MM_TO_PX = 96 / 25.4;

async function measureDocument(page, html, widthMm, heightMm) {
    const widthPx = Math.round(widthMm * MM_TO_PX);
    const heightPx = Math.round(heightMm * MM_TO_PX);

    await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');

    return page.evaluate((availableHeightPx) => {
        const doc = document.documentElement;

        // Elements the document nominates as its content roots. Their own box
        // includes their padding, which is where the page margin lives in the
        // full-bleed layouts.
        const roots = Array.from(document.querySelectorAll('[data-fit]'));
        let contentBottomPx = 0;
        for (const el of roots) {
            const rect = el.getBoundingClientRect();
            contentBottomPx = Math.max(contentBottomPx, rect.bottom + window.scrollY);
        }
        if (!roots.length) contentBottomPx = doc.scrollHeight;

        // Anything sticking out sideways: a long unbroken URL or email address
        // in a narrow column is the usual cause, and it silently clips in print.
        const overflows = [];
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
            if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                overflows.push({
                    tag: el.tagName.toLowerCase(),
                    cls: String(el.className || '').slice(0, 60),
                    by: el.scrollWidth - el.clientWidth,
                });
                if (overflows.length >= 5) break;
            }
        }

        return {
            contentBottomPx: Math.ceil(contentBottomPx),
            scrollHeightPx: doc.scrollHeight,
            availableHeightPx,
            pages: Math.max(1, Math.ceil(contentBottomPx / availableHeightPx - 0.002)),
            // How full the final page is. This is the number that tells the
            // caller whether it produced a well-set page or one with a large
            // blank foot, and it is what the old page-count-only feedback could
            // never express.
            lastPageFill:
                Math.round(
                    ((contentBottomPx % availableHeightPx) / availableHeightPx || 1) * 1000
                ) / 1000,
            fillRatio: Math.round((contentBottomPx / availableHeightPx) * 1000) / 1000,
            overflows,
        };
    }, heightPx);
}

app.post('/measure', async (req, res) => {
    const { html, htmls, widthMm = 182, heightMm = 267 } = req.body || {};
    const documents = Array.isArray(htmls) ? htmls : html ? [html] : [];

    if (!documents.length) {
        return res.status(400).json({ error: 'html or htmls is required' });
    }
    if (documents.length > 8) {
        return res.status(400).json({ error: 'At most 8 documents per request' });
    }

    let page;
    try {
        if (browser && browser.connected === false) browser = null;
        if (!browser) {
            browser = await initBrowser();
            if (!browser) return res.status(500).json({ error: 'Failed to initialize browser' });
        }

        page = await browser.newPage();
        // Print media, so @media print rules and page-break properties are the
        // ones in force — measuring the screen layout would measure the wrong
        // document. The method was renamed between Puppeteer majors, so both
        // spellings are tried rather than pinning this file to one version.
        if (typeof page.emulateMediaType === 'function') {
            await page.emulateMediaType('print');
        } else if (typeof page.emulateMedia === 'function') {
            await page.emulateMedia({ media: 'print' });
        }

        // Several candidate documents share one page and one browser, which is
        // what makes a search over type sizes cheap: the caller can bracket the
        // fit in a single request instead of one request per attempt.
        const results = [];
        for (const doc of documents) {
            results.push(await measureDocument(page, doc, Number(widthMm), Number(heightMm)));
        }

        res.json(Array.isArray(htmls) ? { results } : results[0]);
    } catch (error) {
        console.error('Measure Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to measure document', details: error.message });
        }
    } finally {
        if (page) {
            try { await page.close(); } catch (e) { console.error('Error closing page:', e); }
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