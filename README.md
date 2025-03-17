# PDF Converter API

A simple and lightweight API that converts text and HTML to PDF using Node.js.

## Features
- Text to PDF conversion
- HTML to PDF conversion with styling
- Lightweight and optimized

## Endpoints

### GET /create-pdf
Converts text to PDF using query parameters

Example:
```http
GET /create-pdf?text=Hello World
```

Example:
```json
{
    "text": "Your text here"
}