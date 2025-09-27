# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create directory for static files if it doesn't exist
RUN mkdir -p public

# Expose port (Render will set PORT env variable)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]