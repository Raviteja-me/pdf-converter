const express = require('express');
const pdfkit = require('pdfkit');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Test endpoint
app.get('/', (req, res) => {
    res.send('PDF Converter API is running!');
});

// Modified PDF generation endpoint to use query parameters
app.get('/create-pdf', (req, res) => {
    const text = req.query.text;
    
    if (!text) {
        return res.status(400).json({ error: 'Text parameter is required. Use ?text=YourText' });
    }

    const doc = new pdfkit();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');

    doc.pipe(res);

    // Add the received text to the PDF
    doc.fontSize(12).text(text);

    doc.end();
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});