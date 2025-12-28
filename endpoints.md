# API Endpoints

This document describes all available API endpoints for the Civle game server.

## Public Endpoints

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
Returns the top 20 leaderboard entries for the current day (EST timezone).

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
  "name": "PlayerName"  // Optional, only if in top 20
}
```

**Response:**
```json
{
  "success": true,
  "rank": 5,
  "inTop20": true
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
  "score": 150
}
```

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

