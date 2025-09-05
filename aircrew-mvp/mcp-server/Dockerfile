FROM node:18-alpine

WORKDIR /app

# Copy workspace root package files
COPY package*.json ./

# Install all workspace dependencies (including dev dependencies for build)
RUN npm ci

# Copy mcp-server source code
COPY mcp-server/ ./mcp-server/

# Set working directory to mcp-server
WORKDIR /app/mcp-server

# Install mcp-server specific dependencies (including TypeScript)
RUN npm install

# Build TypeScript
RUN npm run build

# Create shared directory
RUN mkdir -p /shared/database

EXPOSE 3001

CMD ["npm", "start"]
