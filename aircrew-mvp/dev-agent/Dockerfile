FROM codercom/code-server:latest

USER root

# Install Node.js and development tools
RUN apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install VS Code extensions for development
USER coder
RUN code-server --install-extension ms-vscode.vscode-typescript-next
RUN code-server --install-extension ms-python.python
RUN code-server --install-extension bradlc.vscode-tailwindcss

# Set up workspace
WORKDIR /home/coder/workspace

# Copy package.json and install dependencies  
USER root
COPY package*.json ./
RUN chown coder:coder package*.json
USER coder
RUN npm install

# Copy MCP tools and configuration
USER root
COPY dev-agent/mcp-tools/ ./mcp-tools/
COPY dev-agent/copilot-instructions.md ./
COPY dev-agent/tsconfig.json ./
RUN chown -R coder:coder /home/coder/workspace
USER coder

# Create settings for VS Code
RUN mkdir -p .vscode && echo '{ \
  "mcp.servers": { \
    "aircrew-communication": { \
      "command": "node", \
      "args": ["./mcp-tools/communication-client.js"], \
      "env": { \
        "MCP_SERVER_URL": "$MCP_SERVER_URL", \
        "AGENT_ROLE": "$AGENT_ROLE" \
      } \
    } \
  } \
}' > .vscode/settings.json

EXPOSE 8080

CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none", "."]
