# Use Node.js with Playwright pre-installed
FROM mcr.microsoft.com/playwright:v1.49.0-noble

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY crawler/package*.json ./crawler/

# Install dependencies
WORKDIR /app/backend
RUN npm install

WORKDIR /app/crawler
RUN npm install

# Copy source code
WORKDIR /app
COPY backend ./backend
COPY crawler ./crawler

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
