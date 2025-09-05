# Aircrew MVP Implementation Plan

## Phase 1: Foundation & Communication (Week 1)

### Goal: Get PM and DEV agents talking to each other

### 1.1 Project Structure Setup

```
aircrew-mvp/
├── docker-compose.yml
├── .env.example
├── shared/
│   ├── git-repo/          # Shared git repository
│   ├── database/          # SQLite database file
│   └── mcp-socket/        # Unix socket for MCP communication
├── pm-agent/
│   ├── Dockerfile
│   ├── package.json
│   ├── copilot-instructions.md
│   └── mcp-tools/
│       └── communication.ts
├── dev-agent/
│   ├── Dockerfile
│   ├── package.json
│   ├── copilot-instructions.md
│   └── mcp-tools/
│       └── communication.ts
└── mcp-server/
    ├── package.json
    ├── src/
    │   ├── index.ts         # Main MCP server
    │   ├── database.ts      # SQLite operations
    │   └── message-queue.ts # Message routing
    └── schemas/
        └── messages.ts      # TypeScript interfaces
```

### 1.2 Docker Setup

**docker-compose.yml**:

```yaml
version: "3.8"
services:
  mcp-server:
    build: ./mcp-server
    volumes:
      - ./shared:/shared
    ports:
      - "3001:3001"
    environment:
      - DATABASE_PATH=/shared/database/aircrew.db

  pm-agent:
    build: ./pm-agent
    volumes:
      - ./shared:/shared
    ports:
      - "8080:8080" # code-server port
    environment:
      - MCP_SERVER_URL=http://mcp-server:3001
      - AGENT_ROLE=PM
    depends_on:
      - mcp-server

  dev-agent:
    build: ./dev-agent
    volumes:
      - ./shared:/shared
    ports:
      - "8081:8080" # code-server port
    environment:
      - MCP_SERVER_URL=http://mcp-server:3001
      - AGENT_ROLE=DEV
    depends_on:
      - mcp-server
    profiles:
      - task-active # Only start when task assigned
```

### 1.3 MCP Server Implementation

**Goal**: Simple message passing between agents

```typescript
// mcp-server/src/index.ts
interface AgentMessage {
  id: string;
  from: "PM" | "DEV";
  to: "PM" | "DEV";
  type: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE";
  content: string;
  timestamp: Date;
}

// Start with basic HTTP endpoints:
// POST /message - Send message
// GET /messages/:agent - Get messages for agent
// DELETE /messages/:id - Mark message as read
```

### 1.4 Agent MCP Tools

**pm-agent/mcp-tools/communication.ts**:

```typescript
// Tools PM can use:
// - send_message_to_dev(content: string)
// - get_messages_from_dev()
// - ping_dev() // For testing
```

**dev-agent/mcp-tools/communication.ts**:

```typescript
// Tools DEV can use:
// - send_message_to_pm(content: string)
// - get_messages_from_pm()
// - ping_pm() // For testing
```

### 1.5 Basic Dockerfile (code-server + Node.js)

```dockerfile
FROM codercom/code-server:latest

USER root
RUN apt-get update && apt-get install -y \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

USER coder
WORKDIR /home/coder

# Install VS Code extensions
RUN code-server --install-extension GitHub.copilot
RUN code-server --install-extension ms-vscode.vscode-typescript-next

# Copy MCP tools and agent-specific config
COPY package.json ./
COPY mcp-tools/ ./mcp-tools/
COPY copilot-instructions.md ./

RUN npm install

EXPOSE 8080
CMD ["code-server", "--bind-addr", "0.0.0.0:8080", "--auth", "none"]
```

---

## Phase 1 Success Criteria

✅ **Environment Test**: Both PM and DEV containers start successfully  
✅ **Basic Communication**: PM can send "ping" → DEV responds "pong"  
✅ **MCP Integration**: Agents can call MCP tools from VS Code  
✅ **Git Access**: Both agents can access shared git repository  
✅ **Database Connection**: MCP server can read/write SQLite

---

## Phase 1 Implementation Complete! ✅

### What We've Built

**Core Infrastructure:**

- ✅ Docker Compose setup with 3 services
- ✅ MCP Server with SQLite database and message queue
- ✅ PM Agent container with code-server + MCP tools
- ✅ DEV Agent container with code-server + MCP tools
- ✅ Shared volume for database and future git repo

**Communication Layer:**

- ✅ MCP-based message passing between agents
- ✅ SQLite message persistence and retrieval
- ✅ HTTP/JSON API for tool calls
- ✅ Session management for MCP connections

**Agent Tools:**

- ✅ PM Agent: `ping_dev`, `send_message_to_dev`, `get_messages`
- ✅ DEV Agent: `ping_pm`, `send_message_to_pm`, `get_messages`, `respond_to_ping`
- ✅ Both agents can send PING/PONG/TASK_ASSIGNMENT/FEEDBACK messages

### How to Test

1. **Start the system:** `docker-compose up --build`
2. **Access agents:** PM (localhost:8080), DEV (localhost:8081)
3. **Test ping/pong:** Use MCP tools in VS Code command palette
4. **Verify communication:** Check message history and database

### Next Phase: Task Assignment & Git Integration

Now that communication works, we can move to:

1. PM breaking down real tasks
2. DEV creating git branches for work
3. Code implementation and review cycles
4. Automated feedback loops

The foundation is solid - agents can communicate reliably through the MCP layer!
