const express = require('express');
const pdfkit = require('pdfkit');
const htmlPdf = require('html-pdf-node');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

app.get('/', (req, res) => {
    res.send('PDF Converter API is running!');
});

// Text to PDF endpoint (unchanged)
app.get('/create-pdf', (req, res) => {
    const text = req.query.text;
    
    if (!text) {
        return res.status(400).json({ error: 'Text parameter is required' });
    }

    const doc = new pdfkit();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
    doc.pipe(res);
    doc.fontSize(12).text(text);
    doc.end();
});

// Simplified HTML to PDF endpoint
app.post('/html-to-pdf', async (req, res) => {
    const html = req.body.html;
    
    if (!html) {
        return res.status(400).json({ error: 'HTML content is required' });
    }

    try {
        const options = {
            format: 'A4',
            margin: { top: 20, right: 20, bottom: 20, left: 20 }
        };
        
        const file = { content: html };
        const pdfBuffer = await htmlPdf.generatePdf(file, options);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="webpage.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ error: 'Failed to convert HTML to PDF' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});