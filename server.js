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

// Function to get date string in EST timezone
function getESTDateString(date = new Date()) {
    const estDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const month = String(estDate.getMonth() + 1).padStart(2, '0');
    const day = String(estDate.getDate()).padStart(2, '0');
    return `${month}-${day}`;
}

// Function to clean up old score files (keep only today and yesterday)
function cleanupOldScores() {
    try {
        const scoresDir = './storage/scores';
        if (!fs.existsSync(scoresDir)) {
            return; // Directory doesn't exist, nothing to clean
        }

        // Get today and yesterday's date strings
        const now = new Date();
        const today = getESTDateString(now);
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = getESTDateString(yesterday);

        // Read all files in scores directory
        const files = fs.readdirSync(scoresDir);
        
        files.forEach(file => {
            // Only process JSON files that match the date format (MM-DD.json)
            if (file.endsWith('.json') && /^\d{2}-\d{2}\.json$/.test(file)) {
                const fileDate = file.replace('.json', '');
                
                // Delete if file is not today or yesterday
                if (fileDate !== today && fileDate !== yesterdayStr) {
                    const filePath = `${scoresDir}/${file}`;
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`Deleted old score file: ${file}`);
                    } catch (err) {
                        console.error(`Error deleting score file ${file}:`, err);
                    }
                }
            }
        });
    } catch (err) {
        console.error('Error cleaning up old scores:', err);
    }
}

const server = http.createServer((req, res) => {
    // Parse URL and query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const queryParams = url.searchParams;
    
    let filePath;
    
    // Handle score submission endpoint
    if (pathname === '/submit-score' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const score = data.score;
                const name = data.name || null;
                
                // If no score provided, this is just a name update - skip duplicate check
                if (score === undefined && name) {
                    // This shouldn't happen, but handle it gracefully
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Score required' }), 'utf-8');
                    return;
                }
                
                // If score is provided, check if this is a duplicate submission
                if (score !== undefined) {
                    // Note: We can't perfectly prevent duplicate submissions without user identification,
                    // but we'll rely on client-side localStorage to prevent multiple submissions per day
                }
                
                // Get current date in EST timezone
                const dateString = getESTDateString();
                
                // Ensure storage/scores directory exists
                const storageDir = './storage';
                const scoresDir = './storage/scores';
                if (!fs.existsSync(storageDir)) {
                    fs.mkdirSync(storageDir, { recursive: true });
                }
                if (!fs.existsSync(scoresDir)) {
                    fs.mkdirSync(scoresDir, { recursive: true });
                }
                
                const scoresFile = `${scoresDir}/${dateString}.json`;
                
                // Read existing scores or create new array
                let scores = [];
                if (fs.existsSync(scoresFile)) {
                    const fileContent = fs.readFileSync(scoresFile, 'utf8');
                    scores = JSON.parse(fileContent);
                }
                
                // Check for duplicate name if name is provided
                if (name) {
                    // Check for inappropriate words
                    let badWords = [];
                    try {
                        const badWordsContent = fs.readFileSync('./data/bad-words.txt', 'utf8');
                        badWords = badWordsContent.split('\n')
                            .map(word => word.trim().toLowerCase())
                            .filter(word => word.length > 0);
                    } catch (err) {
                        console.error('Error reading bad-words.txt:', err);
                    }
                    
                    const nameLower = name.toLowerCase();
                    const containsBadWord = badWords.some(word => nameLower.includes(word));
                    if (containsBadWord) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Name contains inappropriate content' }), 'utf-8');
                        return;
                    }
                    
                    const nameExists = scores.some(e => e.name && e.name.toLowerCase() === name.toLowerCase());
                    if (nameExists) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Name already taken' }), 'utf-8');
                        return;
                    }
                }
                
                // Add new score entry
                const entry = {
                    score: score,
                    name: name,
                    timestamp: new Date().toISOString()
                };
                
                // If name is provided, try to update most recent entry with same score and no name
                if (name) {
                    // Find the most recent entry with same score and no name
                    // We iterate backwards to find the most recently added entry with this score
                    let found = false;
                    for (let i = scores.length - 1; i >= 0; i--) {
                        if (scores[i].score === score && !scores[i].name) {
                            scores[i].name = name;
                            // Don't update timestamp - keep original timestamp for tie-breaking
                            // This ensures older scores rank higher in ties
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        scores.push(entry);
                    }
                } else {
                    scores.push(entry);
                }
                
                // Sort by score (descending), then by timestamp (ascending - older first)
                scores.sort((a, b) => {
                    if (b.score !== a.score) {
                        return b.score - a.score;
                    }
                    // Tie: older timestamp (smaller value) comes first
                    return new Date(a.timestamp) - new Date(b.timestamp);
                });
                
                // Keep only top 100 scores
                scores = scores.slice(0, 100);
                
                // Write back to file
                fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
                
                // Find rank - find the first entry with matching score and name (or no name if name not provided)
                let rank = scores.length;
                if (name) {
                    // Find entry with this score and name
                    const index = scores.findIndex(e => e.score === score && e.name === name);
                    if (index !== -1) {
                        rank = index + 1;
                    }
                } else {
                    // Find the most recent entry (last in array before sorting) with this score and no name
                    // Since we just added it, it should be the last one with this score and no name
                    for (let i = scores.length - 1; i >= 0; i--) {
                        if (scores[i].score === score && !scores[i].name) {
                            rank = i + 1;
                            break;
                        }
                    }
                }
                
                // Check if in top 20
                const inTop20 = rank <= 20;
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    rank: rank,
                    inTop20: inTop20
                }), 'utf-8');
            } catch (err) {
                console.error('Error submitting score:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
            }
        });
        return;
    }
    
    // Handle reset leaderboard endpoint
    if (pathname === '/reset_leaderboard' && req.method === 'GET') {
        try {
            // Read the endpoint key from file
            const endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
            const providedKey = queryParams.get('key');
            
            // If key matches, reset the leaderboard
            if (providedKey === endpointKey) {
                // Get current date in EST timezone
                const dateString = getESTDateString();
                
                const scoresFile = `./storage/scores/${dateString}.json`;
                
                // Delete the scores file if it exists
                if (fs.existsSync(scoresFile)) {
                    fs.unlinkSync(scoresFile);
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Leaderboard reset successfully' }), 'utf-8');
            } else {
                // Invalid key
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid key' }), 'utf-8');
            }
        } catch (err) {
            console.error('Error resetting leaderboard:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
        }
        return;
    }
    
    // Handle leaderboard endpoint
    if (pathname === '/leaderboard' && req.method === 'GET') {
        try {
            // Get current date in EST timezone
            const dateString = getESTDateString();
            
            const scoresFile = `./storage/scores/${dateString}.json`;
            
            let leaderboard = [];
            if (fs.existsSync(scoresFile)) {
                const fileContent = fs.readFileSync(scoresFile, 'utf8');
                const scores = JSON.parse(fileContent);
                // Get top 20
                leaderboard = scores.slice(0, 20).map(entry => ({
                    name: entry.name || null,
                    score: entry.score
                }));
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                leaderboard: leaderboard 
            }), 'utf-8');
        } catch (err) {
            console.error('Error loading leaderboard:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
        }
        return;
    }
    
    // Handle first place screenshot submission
    if (pathname === '/submit-first-place-screenshot' && req.method === 'POST') {
        // Get current date in EST timezone
        const dateString = getESTDateString();
        
        // Ensure storage/screenshots directory exists
        const storageDir = './storage';
        const screenshotsDir = './storage/screenshots';
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        
        const screenshotPath = `${screenshotsDir}/${dateString}.png`;
        
        // Delete old screenshot if it exists (only one first place setup per day)
        if (fs.existsSync(screenshotPath)) {
            fs.unlinkSync(screenshotPath);
        }
        
        // Read multipart form data
        const chunks = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                
                // Parse multipart form data manually
                const contentType = req.headers['content-type'] || '';
                const boundaryMatch = contentType.match(/boundary=(.+)$/);
                if (!boundaryMatch) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid content type' }), 'utf-8');
                    return;
                }
                
                const boundary = '--' + boundaryMatch[1];
                const parts = buffer.toString('binary').split(boundary);
                
                for (let part of parts) {
                    if (part.includes('Content-Type: image/png') || part.includes('Content-Type: image/png')) {
                        // Extract image data - find the double CRLF that separates headers from body
                        const headerEnd = part.indexOf('\r\n\r\n');
                        if (headerEnd !== -1) {
                            const imageStart = headerEnd + 4;
                            // Find the end of this part (before the next boundary or end marker)
                            let imageEnd = part.length;
                            const nextBoundary = part.indexOf('\r\n--', imageStart);
                            if (nextBoundary !== -1) {
                                imageEnd = nextBoundary;
                            }
                            
                            if (imageStart < imageEnd) {
                                const imageData = part.substring(imageStart, imageEnd);
                                const imageBuffer = Buffer.from(imageData, 'binary');
                                
                                // Save screenshot
                                fs.writeFileSync(screenshotPath, imageBuffer);
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: true }), 'utf-8');
                                return;
                            }
                        }
                    }
                }
                
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No image data found' }), 'utf-8');
            } catch (err) {
                console.error('Error saving screenshot:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
            }
        });
        return;
    }
    
    // Handle yesterday's best setup endpoint
    if (pathname === '/yesterday-best-setup' && req.method === 'GET') {
        try {
            // Get yesterday's date in EST timezone
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const dateString = getESTDateString(yesterday);
            
            const screenshotPath = `./storage/screenshots/${dateString}.png`;
            const challengePath = `./day_challenges/${dateString}.civle`;
            
            let challengeData = null;
            let screenshotData = null;
            
            // Read challenge if it exists
            if (fs.existsSync(challengePath)) {
                challengeData = fs.readFileSync(challengePath, 'utf8');
            }
            
            // Read screenshot if it exists
            if (fs.existsSync(screenshotPath)) {
                screenshotData = fs.readFileSync(screenshotPath);
            }
            
            // Return JSON with both challenge and screenshot
            if (challengeData || screenshotData) {
                const response = {
                    success: true,
                    challenge: challengeData,
                    hasScreenshot: screenshotData !== null
                };
                
                // If screenshot exists, convert to base64 data URL
                if (screenshotData) {
                    response.screenshotUrl = `data:image/png;base64,${screenshotData.toString('base64')}`;
                }
                
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                });
                res.end(JSON.stringify(response), 'utf-8');
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'No setup available for yesterday' }), 'utf-8');
            }
        } catch (err) {
            console.error('Error loading yesterday\'s best setup:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
        }
        return;
    }
    
    // Handle daily challenge endpoint
    if (pathname === '/daily-challenge') {
        try {
            // Get current date in EST timezone
            const dateString = getESTDateString();
            
            // Try to read the challenge file for today's date
            const challengePath = `./day_challenges/${dateString}.civle`;
            
            if (fs.existsSync(challengePath)) {
                const challengeContent = fs.readFileSync(challengePath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(challengeContent, 'utf-8');
            } else {
                // Challenge not found for today
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Challenge not found for today' }), 'utf-8');
            }
        } catch (err) {
            console.error('Error serving daily challenge:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Server error loading challenge' }), 'utf-8');
        }
        return;
    }
    // Check if accessing map_maker with key
    else if (pathname === '/map_maker' || pathname === '/map_maker.html') {
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
    
    // Clean up old scores on server startup
    cleanupOldScores();
    
    // Also clean up old scores daily (every 24 hours)
    setInterval(cleanupOldScores, 24 * 60 * 60 * 1000);
});

