# API Endpoints

This document describes all available API endpoints for the Civle game server.

## Public Endpoints

### GET `/health`
Health check endpoint for deployment monitoring (used by Render).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-29T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Server is healthy and running

**Example:**
```
GET /health
```

---

### GET `/`
Serves the main game page (`public/game.html`).

**Response:** HTML content

---

### GET `/daily-challenge`
Returns the daily challenge file for the current date (EST timezone).

**Response:**
- **200 OK**: Challenge file content (`.civle` format)
- **404 Not Found**: Challenge not found for today

**Example:**
```
GET /daily-challenge
```

---

### GET `/leaderboard`
Returns the top 10 leaderboard entries for the current day (EST timezone).

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "name": "PlayerName",
      "score": 150
    },
    ...
  ]
}
```

**Example:**
```
GET /leaderboard
```

---

### POST `/submit-score`
Submits a score to the leaderboard.

**Request Body:**
```json
{
  "score": 150,
  "name": "PlayerName",  // Optional, only if in top 10
  "screenshot": "data:image/png;base64,..."  // Optional, base64-encoded PNG screenshot
}
```

**Response:**
```json
{
  "success": true,
  "rank": 5,
  "inTop10": true
}
```

**Errors:**
- **400 Bad Request**: 
  - `"Name already taken"` - The provided name is already in use
  - `"Name contains inappropriate content"` - The name contains blocked words
- **500 Internal Server Error**: Server error

**Example:**
```
POST /submit-score
Content-Type: application/json

{
  "score": 150,
  "screenshot": "data:image/png;base64,..."
}
```

**Notes:**
- If the submission ranks #1 and includes a screenshot, the screenshot is saved automatically
- Screenshot filename format: `MM-DD_(Name)_(Score).png` (if name and score are provided)
- If name is added later to a rank 1 entry, the screenshot file is renamed to include the name and score
- Screenshots are stored in `storage/screenshots/` directory

---

### GET `/yesterday-best-setup`
Returns yesterday's best setup (challenge file and screenshot) for display in the game.

**Response:**
```json
{
  "success": true,
  "challenge": "CIV1...",
  "screenshot": "/storage/screenshots/12-29_(PlayerName)_(150).png",
  "playerName": "PlayerName",
  "playerScore": 150
}
```

**Errors:**
- **404 Not Found**: No setup available for yesterday

**Example:**
```
GET /yesterday-best-setup
```

**Notes:**
- Returns the challenge file (`.civle` format) and screenshot URL for yesterday's date
- Extracts player name and score from the screenshot filename if present
- Filename format: `MM-DD_(Name)_(Score).png` or `MM-DD_(Name).png` or `MM-DD.png`
- `playerName` and `playerScore` will be `null` if not found in the filename

---

### POST `/report-bug`
Submits a bug report to help improve the game.

**Request Body:**
```json
{
  "description": "Description of the bug encountered"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bug report submitted successfully"
}
```

**Errors:**
- **400 Bad Request**: 
  - `"Description required"` - No description provided
- **500 Internal Server Error**: Server error

**Example:**
```
POST /report-bug
Content-Type: application/json

{
  "description": "The game crashes when placing a district on a hill tile"
}
```

**Notes:**
- Bug reports are stored in `storage/reports/bug_reports.json`
- Each report includes the description, timestamp, and user agent
- Bug reports are retained to help improve the game

---

## Protected Endpoints

These endpoints require a valid key from `endpoint_key.txt`.

### GET `/map_maker?key={key}`
Serves the map maker page.

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
- **200 OK**: Map maker HTML page
- **302 Redirect**: Redirects to `/` if key is invalid

**Example:**
```
GET /map_maker?key=your-secret-key
```

---

### GET `/custom_game?key={key}`
Serves the custom game page. This is a version of the main game that allows uploading custom challenge files but does not allow score submission.

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
- **200 OK**: Custom game HTML page
- **302 Redirect**: Redirects to `/` if key is invalid

**Features:**
- Allows uploading custom `.civle` challenge files
- Does not auto-load daily challenges
- Score submission is disabled
- "Yesterday's Best Setup" button is removed

**Example:**
```
GET /custom_game?key=your-secret-key
```

---

### GET `/today_scores?key={key}`
Returns all scores for the current day (EST timezone). This endpoint provides access to the complete list of scores, not just the top entries.

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
```json
{
  "success": true,
  "date": "12-31",
  "scores": [
    {
      "score": 150,
      "name": "PlayerName",
      "timestamp": "2024-12-31T12:00:00.000Z"
    },
    {
      "score": 140,
      "name": null,
      "timestamp": "2024-12-31T12:05:00.000Z"
    },
    ...
  ]
}
```

**Errors:**
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
GET /today_scores?key=your-secret-key
```

**Notes:**
- Returns all scores for today (up to 100 entries, as stored in the scores file)
- Scores are sorted by score (descending), then by timestamp (ascending - older scores rank higher in ties)
- Entries may have `name: null` if the player hasn't submitted a name yet

---

### GET `/yesterday_scores?key={key}`
Returns all scores for yesterday (EST timezone). This endpoint provides access to the complete list of scores from the previous day.

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
```json
{
  "success": true,
  "date": "12-30",
  "scores": [
    {
      "score": 150,
      "name": "PlayerName",
      "timestamp": "2024-12-30T12:00:00.000Z"
    },
    {
      "score": 140,
      "name": null,
      "timestamp": "2024-12-30T12:05:00.000Z"
    },
    ...
  ]
}
```

**Errors:**
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
GET /yesterday_scores?key=your-secret-key
```

**Notes:**
- Returns all scores for yesterday (up to 100 entries, as stored in the scores file)
- Scores are sorted by score (descending), then by timestamp (ascending - older scores rank higher in ties)
- Entries may have `name: null` if the player hasn't submitted a name yet
- Returns empty array if yesterday's score file doesn't exist

---

### GET `/num_today_submissions?key={key}`
Returns the number of score submissions for the current day (EST timezone).

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
```json
{
  "success": true,
  "date": "12-31",
  "count": 42
}
```

**Errors:**
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
GET /num_today_submissions?key=your-secret-key
```

**Notes:**
- Returns the total count of submissions for today
- Returns 0 if no scores exist for today

---

### GET `/num_yesterday_submissions?key={key}`
Returns the number of score submissions for yesterday (EST timezone).

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
```json
{
  "success": true,
  "date": "12-30",
  "count": 38
}
```

**Errors:**
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
GET /num_yesterday_submissions?key=your-secret-key
```

**Notes:**
- Returns the total count of submissions for yesterday
- Returns 0 if no scores exist for yesterday

---

### GET `/reset_leaderboard?key={key}`
Resets the leaderboard for the current day (EST timezone).

**Query Parameters:**
- `key` (required): Authentication key

**Response:**
```json
{
  "success": true,
  "message": "Leaderboard reset successfully"
}
```

**Errors:**
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
GET /reset_leaderboard?key=your-secret-key
```

---

### POST `/upload_yesterday_winner?key={key}`
Uploads or replaces yesterday's winner screenshot. This endpoint allows manually setting the screenshot for yesterday's challenge.

**Query Parameters:**
- `key` (required): Authentication key

**Request Body:**
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANS...",
  "name": "PlayerName",
  "score": 150  // Optional, score of the winner
}
```

**Response:**
```json
{
  "success": true,
  "message": "Screenshot uploaded successfully",
  "filename": "12-29_(PlayerName)_(150).png"
}
```

**Errors:**
- **400 Bad Request**: 
  - `"Image required"` - No image provided
  - `"Name required"` - No name provided
- **403 Forbidden**: Invalid key
- **500 Internal Server Error**: Server error

**Example:**
```
POST /upload_yesterday_winner?key=your-secret-key
Content-Type: application/json

{
  "image": "data:image/png;base64,...",
  "name": "PlayerName",
  "score": 150
}
```

**Notes:**
- The image should be a base64-encoded PNG image (with or without the `data:image/png;base64,` prefix)
- The name will be sanitized for use in the filename (invalid characters replaced with underscores)
- If score is provided, the screenshot will be saved as `MM-DD_(Name)_(Score).png`
- If score is not provided, the screenshot will be saved as `MM-DD_(Name).png`
- Any existing screenshot for yesterday's date will be replaced
- The screenshot will be saved in the `storage/screenshots/` directory

---

## Static File Endpoints

### GET `/data/*`
Serves JSON data files from the `data/` directory.

**Example:**
```
GET /data/adjacency_database.json
GET /data/placement_database.json
GET /data/resources_database.json
```

---

### GET `/assets/*`
Serves static assets (images, fonts, etc.) from the `public/assets/` directory.

**Example:**
```
GET /assets/yields/Science.webp
GET /assets/yields/Score.webp
```

---

## Notes

- All dates are calculated using **EST (America/New_York) timezone**
- Score files are stored in `scores/MM-DD.json` format
- The server runs on port **8000** by default
- Leaderboard entries are sorted by score (descending), then by timestamp (ascending - older scores rank higher in ties)
- Only the top 100 scores are kept per day
- Names are limited to 20 characters and are checked against a bad words filter
- Each user can only submit once per day (enforced client-side via localStorage)

