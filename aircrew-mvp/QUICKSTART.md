# Aircrew MVP - Quick Start Guide

## Getting Started

This is the MVP implementation of Aircrew focusing on PM and DEV agent communication.

### Prerequisites

- Docker and Docker Compose
- Git

### 1. Build and Start the System

```bash
# Clone and navigate to the directory
cd aircrew-mvp

# Build and start all services
docker-compose up --build
```

This will start:

- **MCP Server** (port 3001) - Communication hub
- **PM Agent** (port 8080) - Project Manager interface
- **DEV Agent** (port 8081) - Developer interface

### 2. Access the Agents

- **PM Agent**: http://localhost:8080 (VS Code interface)
- **DEV Agent**: http://localhost:8081 (VS Code interface)
- **MCP Server Health**: http://localhost:3001/health

### 3. Test Communication (Ping/Pong)

#### In PM Agent (port 8080):

1. Open VS Code in browser
2. Open the Command Palette (Ctrl+Shift+P)
3. Look for MCP tools or use the terminal
4. Use the `ping_dev` tool to send a ping to DEV agent

#### In DEV Agent (port 8081):

1. Open VS Code in browser
2. Use `get_messages` tool to see the ping from PM
3. Use `respond_to_ping` tool to send a pong back
4. Or use `ping_pm` to initiate communication

### 4. Expected Workflow

```
PM: ping_dev("Hello DEV!")
   ↓
DEV: get_messages() → sees ping
   ↓
DEV: respond_to_ping("Hello DEV!") → sends pong
   ↓
PM: get_messages() → sees pong response
```

### 5. Troubleshooting

**Check MCP Server Health:**

```bash
curl http://localhost:3001/health
```

**View Container Logs:**

```bash
docker-compose logs mcp-server
docker-compose logs pm-agent
docker-compose logs dev-agent
```

**Rebuild if needed:**

```bash
docker-compose down
docker-compose up --build
```

### 6. Development

The TypeScript files have some lint errors because dependencies aren't installed in the development environment, but they should work inside the containers.

#### File Structure:

```
aircrew-mvp/
├── docker-compose.yml
├── shared/                 # Shared storage
│   ├── database/          # SQLite database
│   └── git-repo/          # Future: shared git repository
├── mcp-server/            # Communication hub
├── pm-agent/              # Project Manager agent
└── dev-agent/             # Developer agent
```

### 7. Success Criteria

✅ All containers start successfully  
✅ PM can ping DEV agent  
✅ DEV receives ping and responds with pong  
✅ PM receives pong response  
✅ Message history is stored in database

This validates the core communication infrastructure for the Aircrew system!

---

## Next Steps (Future Phases)

Once ping/pong works:

1. **Task Assignment**: PM sends actual coding tasks to DEV
2. **Git Integration**: DEV creates branches and commits code
3. **Feedback Loop**: PM reviews DEV output and provides feedback
4. **Add QA Agent**: Automated testing and validation
5. **Add Architect Agent**: Complex planning and design
