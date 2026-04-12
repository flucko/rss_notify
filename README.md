# RSS Notify

A lightweight, modern web application for monitoring RSS feeds and pushing notifications to your devices via [Pushover](https://pushover.net/).

## Features
- **Modern Web UI**: Beautiful glassmorphism UI for managing your feeds and rules.
- **Adjustable Target Filters**: Configure trigger words to precisely match against the article Title, the Description, or Both.
- **Manual Sync Previews**: Render exactly how your feeds parse by pulling fresh un-filtered data directly into a visual UI overlay before finalizing rules.
- **Exact Keyword Matching**: Allows configuring per-feed keywords to look out for. Use exact word boundaries for maximum control.
- **Deduplication Engine**: Uses SQLite to keep track of matched articles and prevent duplicated push notifications.
- **Containerized**: Built specifically to be run on home lab servers like Unraid as a fully stateless Docker container. All configurations and states are stored in an easily mountable local database.
- **Low Overhead**: Features a tiny footprint built on FastAPI and a vanilla JavaScript frontend.

## Getting Started

### Local Development
```bash
# Create and activate a Virtual Environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the uvicorn server in development mode
ENV=development uvicorn backend.main:app --reload
```

### Docker Compose
You can easily jumpstart the application using Docker Compose. A `docker-compose.yml` file is provided.
```bash
docker-compose up -d
```
Then navigate to `http://localhost:8000` to setup your Pushover details.

### Unraid Deployment
Use Community Applications to pull `python:3.11-slim` or build this image directly if using a Docker builder plugin. Ensure you map:
- **Port:** `8000`
- **Volume:** `/app/data` to a persistent directory in your AppData share.
