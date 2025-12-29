# Civle Game

A daily puzzle game inspired by Civilization district placement mechanics.

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Create `endpoint_key.txt` file with your secret key (or set `ENDPOINT_KEY` environment variable)

3. Start the server:
```bash
npm start
```

4. Open `http://localhost:8000` in your browser

## Render Deployment

### Prerequisites
- Render account
- Git repository

### Setup Steps

1. **Create a new Web Service on Render**
   - Connect your Git repository
   - Set the following:
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Environment**: Node

2. **Add Environment Variables**
   - `ENDPOINT_KEY`: Your secret key for protected endpoints (map maker, reset leaderboard)
   - `NODE_ENV`: `production`

3. **Add Persistent Disk (Optional but Recommended)**
   - Go to your service settings
   - Add a disk:
     - **Name**: `civle-storage`
     - **Mount Path**: `/opt/render/project/src/storage`
     - **Size**: 1 GB (or as needed)
   
   This ensures scores and screenshots persist across deployments.

4. **Deploy**
   - Render will automatically deploy on push to your main branch
   - The server will be available at your Render URL

### File Structure
- `storage/scores/` - Daily leaderboard files (auto-cleaned, keeps only today and yesterday)
- `storage/screenshots/` - First place setup screenshots (auto-cleaned, keeps only today and yesterday)
- `day_challenges/` - Daily challenge files (committed to git)
- `data/` - Game data files (committed to git)
- `public/` - Static assets and game HTML

### Notes
- The server automatically cleans up old score files (keeps only today and yesterday)
- Scores and screenshots are stored in the `storage/` directory
- For production, use environment variables instead of `endpoint_key.txt`

