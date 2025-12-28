const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
    // Parse URL and query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const queryParams = url.searchParams;
    
    let filePath;
    
    // Check if accessing map_maker with key
    if (pathname === '/map_maker' || pathname === '/map_maker.html') {
        try {
            // Read the endpoint key from file
            const endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
            const providedKey = queryParams.get('key');
            
            // If key matches, serve map_maker.html
            if (providedKey === endpointKey) {
                filePath = './map_maker.html';
            } else {
                // Invalid key, redirect to game
                res.writeHead(302, { 'Location': '/' });
                res.end();
                return;
            }
        } catch (err) {
            // If endpoint_key.txt doesn't exist or can't be read, deny access
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return;
        }
    } else {
        // Handle data folder requests (JSON files)
        if (pathname.startsWith('/data/')) {
            filePath = '.' + pathname;
        }
        // Handle assets folder (served from public/assets)
        else if (pathname.startsWith('/assets/')) {
            filePath = './public' + pathname;
        }
        // Handle public folder requests (HTML files)
        else if (pathname.startsWith('/public/')) {
            filePath = '.' + pathname;
        }
        // Default to public/game.html if root
        else if (pathname === '/' || pathname === '/index.html') {
            filePath = './public/game.html';
        }
        // Other requests go to public folder
        else {
            filePath = './public' + pathname;
        }
    }
    
    // Get file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    // Read and serve file
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    console.log(`Open http://localhost:${PORT}/public/game.html in your browser`);
});

