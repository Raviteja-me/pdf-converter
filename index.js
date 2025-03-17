const express = require('express');
const pdfkit = require('pdfkit');
const pdf = require('html-pdf');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Add middleware to parse JSON and increase payload limit
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Test endpoint
app.get('/', (req, res) => {
    res.send('PDF Converter API is running!');
});

// Text to PDF endpoint (unchanged)
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

// Modified HTML to PDF endpoint with enhanced styling
app.post('/html-to-pdf', (req, res) => {
    const html = req.body.html;
    
    if (!html) {
        return res.status(400).json({ error: 'HTML content is required in request body' });
    }

    // Default styling for better PDF output
    const defaultStyle = `
        <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; }
            h1 { color: #2c3e50; margin-bottom: 0.5em; }
            h2 { color: #3498db; margin-top: 1em; }
            .section { margin: 1em 0; }
            .header { text-align: center; margin-bottom: 2em; }
            .contact-info { color: #666; }
            ul { padding-left: 20px; }
            li { margin-bottom: 0.5em; }
            .skills { display: flex; flex-wrap: wrap; gap: 10px; }
            .skill-tag { 
                background: #f0f0f0; 
                padding: 5px 10px; 
                border-radius: 15px; 
                font-size: 0.9em; 
            }
        </style>
    `;

    // Wrap HTML content with default styling
    const enhancedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            ${defaultStyle}
        </head>
        <body>
            ${html}
        </body>
        </html>
    `;

    const options = {
        format: 'A4',
        border: {
            top: '2cm',
            right: '2cm',
            bottom: '2cm',
            left: '2cm'
        },
        timeout: '120000',
        footer: {
            height: '1cm',
            contents: {
                default: '<div style="text-align: center; color: #888; font-size: 8pt;">Page {{page}} of {{pages}}</div>'
            }
        }
    };

    pdf.create(enhancedHtml, options).toBuffer((err, buffer) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to convert HTML to PDF' });
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="resume.pdf"');
        res.send(buffer);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});