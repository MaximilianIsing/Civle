const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

// Use persistent disk path if available (Render deployment), otherwise use relative path
// On Render, the persistent disk is mounted at /opt/render/project/src/storage
// In production, always use the persistent disk path
const STORAGE_DIR = (process.env.NODE_ENV === 'production' || fs.existsSync('/opt/render/project/src/storage'))
    ? '/opt/render/project/src/storage'
    : './storage';

// Log which storage directory is being used (for debugging)
console.log(`Using storage directory: ${STORAGE_DIR}`);
console.log(`Storage directory exists: ${fs.existsSync(STORAGE_DIR)}`);

// Ensure storage directories exist
const scoresDir = path.join(STORAGE_DIR, 'scores');
const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    console.log(`Created storage directory: ${STORAGE_DIR}`);
}
if (!fs.existsSync(scoresDir)) {
    fs.mkdirSync(scoresDir, { recursive: true });
    console.log(`Created scores directory: ${scoresDir}`);
}
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log(`Created screenshots directory: ${screenshotsDir}`);
}
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

// Function to clean up old score and setup files (keep only today and yesterday)
function cleanupOldScores() {
    try {
        // Clean up scores
        const scoresDir = path.join(STORAGE_DIR, 'scores');
        if (fs.existsSync(scoresDir)) {
            const now = new Date();
            const today = getESTDateString(now);
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getESTDateString(yesterday);

            const files = fs.readdirSync(scoresDir);
            files.forEach(file => {
                if (file.endsWith('.json') && /^\d{2}-\d{2}\.json$/.test(file)) {
                    const fileDate = file.replace('.json', '');
                    if (fileDate !== today && fileDate !== yesterdayStr) {
                        try {
                            fs.unlinkSync(`${scoresDir}/${file}`);
                            console.log(`Deleted old score file: ${file}`);
                        } catch (err) {
                            console.error(`Error deleting score file ${file}:`, err);
                        }
                    }
                }
            });
        }

        // Clean up screenshots
        const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
        if (fs.existsSync(screenshotsDir)) {
            const now = new Date();
            const today = getESTDateString(now);
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getESTDateString(yesterday);

            const files = fs.readdirSync(screenshotsDir);
            files.forEach(file => {
                if (file.endsWith('.png')) {
                    // Extract date from filename (format: MM-DD or MM-DD_(Name))
                    const dateMatch = file.match(/^(\d{2}-\d{2})(?:_\(.*?\))?\.png$/);
                    if (dateMatch) {
                        const fileDate = dateMatch[1];
                        if (fileDate !== today && fileDate !== yesterdayStr) {
                            try {
                                fs.unlinkSync(`${screenshotsDir}/${file}`);
                                console.log(`Deleted old screenshot file: ${file}`);
                            } catch (err) {
                                console.error(`Error deleting screenshot file ${file}:`, err);
                            }
                        }
                    }
                }
            });
        }
    } catch (err) {
        console.error('Error cleaning up old files:', err);
    }
}

const server = http.createServer((req, res) => {
    // Parse URL and query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const queryParams = url.searchParams;
    
    let filePath;
    
    // Health check endpoint for Render
    if (pathname === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), 'utf-8');
        return;
    }
    
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
                const screenshot = data.screenshot || null;
                
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
                const storageDir = STORAGE_DIR;
                const scoresDir = path.join(STORAGE_DIR, 'scores');
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
                
                // Check if in top 10
                const inTop10 = rank <= 10;
                
                // If rank is 1 and screenshot is provided, save it (server determines first place)
                if (rank === 1 && screenshot) {
                    try {
                        const dateString = getESTDateString();
                        const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
                        if (!fs.existsSync(screenshotsDir)) {
                            fs.mkdirSync(screenshotsDir, { recursive: true });
                        }
                        
                        // Build filename with player name if available
                        let filename = dateString;
                        if (name) {
                            // Sanitize name for filename (remove invalid characters)
                            const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
                            filename = `${dateString}_(${sanitizedName})`;
                        }
                        const screenshotPath = `${screenshotsDir}/${filename}.png`;
                        
                        // Delete old screenshot files for this date (with or without name)
                        const files = fs.readdirSync(screenshotsDir);
                        files.forEach(file => {
                            if (file.startsWith(dateString) && file.endsWith('.png')) {
                                try {
                                    fs.unlinkSync(`${screenshotsDir}/${file}`);
                                } catch (err) {
                                    // Ignore errors deleting old files
                                }
                            }
                        });
                        
                        // Convert base64 to buffer and save
                        const base64Data = screenshot.replace(/^data:image\/png;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');
                        fs.writeFileSync(screenshotPath, buffer);
                    } catch (err) {
                        console.error('Error saving screenshot:', err);
                        // Don't fail the score submission if screenshot save fails
                    }
                }
                
                // If name is being added and this entry is rank 1, rename the screenshot file
                if (name && rank === 1) {
                    try {
                        const dateString = getESTDateString();
                        const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
                        
                        // Find existing screenshot file for this date (might not have name yet)
                        const files = fs.readdirSync(screenshotsDir);
                        const existingFile = files.find(file => 
                            file.startsWith(dateString) && file.endsWith('.png') && !file.includes('_(')
                        );
                        
                        if (existingFile) {
                            // Rename to include name
                            const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
                            const newFilename = `${dateString}_(${sanitizedName}).png`;
                            const oldPath = `${screenshotsDir}/${existingFile}`;
                            const newPath = `${screenshotsDir}/${newFilename}`;
                            fs.renameSync(oldPath, newPath);
                        }
                    } catch (err) {
                        console.error('Error renaming screenshot with name:', err);
                        // Don't fail the name update if rename fails
                    }
                }
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    rank: rank,
                    inTop10: inTop10
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
            // Read the endpoint key from environment variable or file
            let endpointKey;
            if (process.env.ENDPOINT_KEY) {
                endpointKey = process.env.ENDPOINT_KEY;
            } else if (fs.existsSync('endpoint_key.txt')) {
                endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
            } else {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Endpoint key not configured' }), 'utf-8');
                return;
            }
            
            const providedKey = queryParams.get('key');
            
            // If key matches, reset the leaderboard
            if (providedKey === endpointKey) {
                // Get current date in EST timezone
                const dateString = getESTDateString();
                
                const scoresFile = path.join(STORAGE_DIR, 'scores', `${dateString}.json`);
                
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
    
    // Handle upload yesterday winner endpoint
    if (pathname === '/upload_yesterday_winner' && req.method === 'POST') {
        // Read the endpoint key from environment variable or file
        let endpointKey;
        if (process.env.ENDPOINT_KEY) {
            endpointKey = process.env.ENDPOINT_KEY;
        } else if (fs.existsSync('endpoint_key.txt')) {
            endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
        } else {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Endpoint key not configured' }), 'utf-8');
            return;
        }
        
        const providedKey = queryParams.get('key');
        
        // If key doesn't match, deny access
        if (providedKey !== endpointKey) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Invalid key' }), 'utf-8');
            return;
        }
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const image = data.image || null;
                const name = data.name || null;
                
                if (!image) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Image required' }), 'utf-8');
                    return;
                }
                
                if (!name) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Name required' }), 'utf-8');
                    return;
                }
                
                // Get yesterday's date in EST timezone
                const now = new Date();
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const dateString = getESTDateString(yesterday);
                
                // Ensure screenshots directory exists
                const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
                if (!fs.existsSync(screenshotsDir)) {
                    fs.mkdirSync(screenshotsDir, { recursive: true });
                }
                
                // Delete any existing screenshots for yesterday
                if (fs.existsSync(screenshotsDir)) {
                    const files = fs.readdirSync(screenshotsDir);
                    files.forEach(file => {
                        if (file.startsWith(dateString) && file.endsWith('.png')) {
                            try {
                                fs.unlinkSync(`${screenshotsDir}/${file}`);
                            } catch (err) {
                                // Ignore errors deleting old files
                            }
                        }
                    });
                }
                
                // Sanitize name for filename (remove invalid characters)
                const sanitizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const filename = `${dateString}_(${sanitizedName})`;
                const screenshotPath = `${screenshotsDir}/${filename}.png`;
                
                // Convert base64 to buffer and save
                const base64Data = image.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(screenshotPath, buffer);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Screenshot uploaded successfully',
                    filename: `${filename}.png`
                }), 'utf-8');
            } catch (err) {
                console.error('Error uploading yesterday winner screenshot:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Server error' }), 'utf-8');
            }
        });
        return;
    }
    
    // Handle leaderboard endpoint
    if (pathname === '/leaderboard' && req.method === 'GET') {
        try {
            // Get current date in EST timezone
            const dateString = getESTDateString();
            
            const scoresFile = path.join(STORAGE_DIR, 'scores', `${dateString}.json`);
            
            let leaderboard = [];
            if (fs.existsSync(scoresFile)) {
                const fileContent = fs.readFileSync(scoresFile, 'utf8');
                const scores = JSON.parse(fileContent);
                // Get top 10
                leaderboard = scores.slice(0, 10).map(entry => ({
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
    
    // Handle yesterday's best setup endpoint
    if (pathname === '/yesterday-best-setup' && req.method === 'GET') {
        try {
            // Get yesterday's date in EST timezone
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const dateString = getESTDateString(yesterday);
            
            const challengePath = `./day_challenges/${dateString}.civle`;
            const screenshotsDir = path.join(STORAGE_DIR, 'screenshots');
            
            let challengeData = null;
            let screenshotUrl = null;
            let playerName = null;
            
            // Read challenge if it exists
            if (fs.existsSync(challengePath)) {
                challengeData = fs.readFileSync(challengePath, 'utf8');
            }
            
            // Find screenshot file for this date (with or without name in filename)
            if (fs.existsSync(screenshotsDir)) {
                const files = fs.readdirSync(screenshotsDir);
                const screenshotFile = files.find(file => 
                    file.startsWith(dateString) && file.endsWith('.png')
                );
                
                if (screenshotFile) {
                    screenshotUrl = `/storage/screenshots/${screenshotFile}`;
                    
                    // Extract player name from filename if present (format: MM-DD_(Name).png)
                    const nameMatch = screenshotFile.match(/^\d{2}-\d{2}_\((.*?)\)\.png$/);
                    if (nameMatch) {
                        playerName = nameMatch[1].replace(/_/g, ' '); // Replace underscores with spaces
                    }
                }
            }
            
            // Return JSON with challenge, screenshot, and player name
            if (challengeData || screenshotUrl) {
                const response = {
                    success: true,
                    challenge: challengeData,
                    screenshot: screenshotUrl,
                    playerName: playerName
                };
                
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*'
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
            // Read the endpoint key from environment variable or file
            let endpointKey;
            if (process.env.ENDPOINT_KEY) {
                endpointKey = process.env.ENDPOINT_KEY;
            } else if (fs.existsSync('endpoint_key.txt')) {
                endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
            } else {
                // No key configured, deny access
                res.writeHead(302, { 'Location': '/' });
                res.end();
                return;
            }
            
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
            // Error reading key, deny access
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return;
        }
    }
    // Check if accessing custom_game with key
    else if (pathname === '/custom_game' || pathname === '/custom_game.html') {
        try {
            // Read the endpoint key from environment variable or file
            let endpointKey;
            if (process.env.ENDPOINT_KEY) {
                endpointKey = process.env.ENDPOINT_KEY;
            } else if (fs.existsSync('endpoint_key.txt')) {
                endpointKey = fs.readFileSync('endpoint_key.txt', 'utf8').trim();
            } else {
                // No key configured, deny access
                res.writeHead(302, { 'Location': '/' });
                res.end();
                return;
            }
            
            const providedKey = queryParams.get('key');
            
            // If key matches, serve custom_game.html
            if (providedKey === endpointKey) {
                filePath = './custom_game.html';
            } else {
                // Invalid key, redirect to game
                res.writeHead(302, { 'Location': '/' });
                res.end();
                return;
            }
        } catch (err) {
            // Error reading key, deny access
            res.writeHead(302, { 'Location': '/' });
            res.end();
            return;
        }
    } else {
        // Handle storage/screenshots requests
        if (pathname.startsWith('/storage/screenshots/')) {
            // Extract filename from path
            const filename = pathname.replace('/storage/screenshots/', '');
            filePath = path.join(STORAGE_DIR, 'screenshots', filename);
        }
        // Handle data folder requests (JSON files)
        else if (pathname.startsWith('/data/')) {
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
    if (process.env.NODE_ENV !== 'production') {
        console.log(`Server running at http://localhost:${PORT}/`);
        console.log(`Open http://localhost:${PORT}/public/game.html in your browser`);
    } else {
        console.log(`Server started on port ${PORT}`);
    }
    
    // Clean up old scores on server startup
    cleanupOldScores();
    
    // Also clean up old scores daily (every 24 hours)
    setInterval(cleanupOldScores, 24 * 60 * 60 * 1000);
});

