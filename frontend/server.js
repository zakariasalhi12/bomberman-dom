const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3030;
const baseDir = __dirname;

const server = http.createServer((req, res) => {
    let filePath = path.join(baseDir, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath).toLowerCase();

    // Content-Type map
    const contentTypeMap = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    };

    const contentType = contentTypeMap[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            // Fallback only for routes without a file extension
            if (req.url !== '/' && !path.extname(req.url)) {
                const fallbackPath = path.join(baseDir, 'index.html');
                fs.readFile(fallbackPath, (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

});

server.listen(PORT, () => {
    console.log(`Frontend server running at http://localhost:${PORT}`);
});
