# ============================================================
# Simpenan Cloud — Background Transcoder Worker Dockerfile
# Native Node.js & FFmpeg multi-threaded worker
# ============================================================
FROM node:20-bookworm-slim

# Install native FFmpeg system packages (optional fallback if not using ffmpeg-static)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application files and scripts
COPY . .

# Environment
ENV NODE_ENV=production

# Start worker
CMD ["npx", "tsx", "--env-file=.env", "scripts/worker.ts"]
