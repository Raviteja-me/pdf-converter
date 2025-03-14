# PDF Converter API

A simple API that converts text to PDF using Node.js and PDFKit.

## Endpoints

### POST /create-pdf
Converts text to PDF

Request body:
```json
{
    "text": "Your text here"
}