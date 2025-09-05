# Aircrew + Coder Tasks Integration Plan

## 🎯 Why Coder Tasks is Perfect for Aircrew

Coder Tasks solves all our authentication and AI integration issues by providing:

### ✅ Native Features We Need:

- **Built-in AI Agent Support**: Claude, Aider, Goose, custom agents
- **MCP Protocol Integration**: Perfect for our existing MCP architecture
- **Chat-Based UI**: Natural interface for agent communication
- **Workspace Isolation**: Each agent runs in isolated environment
- **Self-Hosted**: No external auth requirements
- **AgentAPI Integration**: Enhanced status reporting and UI

## 🔄 Migration Strategy

### Phase 1: Setup Coder Tasks Infrastructure

1. **Install Coder Server** (replaces code-server containers)
2. **Create Task Templates** for PM and DEV agent roles
3. **Integrate AgentAPI** for enhanced agent communication
4. **Migrate MCP Tools** to work with Coder Tasks

### Phase 2: Agent Template Configuration

```hcl
# PM Agent Task Template
data "coder_parameter" "ai_prompt" {
    name = "AI Prompt"
    type = "string"
}

resource "coder_ai_task" "pm_agent" {
    count = data.coder_parameter.ai_prompt.value != "" ? 1 : 0

    sidebar_app {
        id = coder_app.pm_dashboard.id
    }
}

# DEV Agent Task Template
resource "coder_ai_task" "dev_agent" {
    count = data.coder_parameter.ai_prompt.value != "" ? 1 : 0

    sidebar_app {
        id = coder_app.dev_environment.id
    }
}
```

### Phase 3: Enhanced Agent Capabilities

- **Claude Code Integration**: Advanced code generation and review
- **Aider Integration**: Git-aware AI coding assistant
- **Custom Aircrew Agents**: Our specialized PM/DEV agents via AgentAPI
- **Enterprise LLM Support**: AWS Bedrock, GCP Vertex, self-hosted models

## 🚀 Benefits Over Current Approach

| Current (code-server)        | With Coder Tasks                 |
| ---------------------------- | -------------------------------- |
| ❌ Auth issues with Copilot  | ✅ Self-hosted, no auth needed   |
| ❌ Limited AI extensions     | ✅ Full agent ecosystem          |
| ❌ Manual agent coordination | ✅ Native agent orchestration    |
| ❌ Basic MCP tools           | ✅ AgentAPI + MCP integration    |
| ❌ Static environments       | ✅ Dynamic task-based workspaces |

## 🛠 Implementation Steps

### 1. Install Coder Server

```bash
# Replace Docker Compose with Coder deployment
curl -fsSL https://coder.com/install.sh | sh
coder server --access-url http://localhost:7080
```

### 2. Create Aircrew Task Templates

- Import base task template from Coder Registry
- Customize for PM and DEV agent roles
- Add our MCP tools and database integration
- Configure AgentAPI for agent communication

### 3. Agent Integration

- **PM Agent**: Project management + Claude Code for planning
- **DEV Agent**: Development + Aider for coding + our MCP tools
- **Communication**: AgentAPI + our existing MCP message queue

### 4. Testing & Validation

- Verify agent isolation and communication
- Test AI coding capabilities (Claude, Aider)
- Validate project/task management workflows
- Ensure database persistence works

## 🌟 Expected Outcomes

1. **No More Auth Issues**: Self-hosted agents, no OAuth required
2. **Superior AI Capabilities**: Claude Code, Aider, custom agents
3. **Native Agent Orchestration**: Built for multi-agent workflows
4. **Scalable Architecture**: Easy to add more agent types
5. **Enterprise Ready**: Support for enterprise LLM providers

## 📋 Next Actions

1. **Evaluate Current Setup**: Keep existing MCP server and database
2. **Install Coder Server**: Replace code-server containers
3. **Create Task Templates**: Start with simple PM/DEV templates
4. **Migrate & Test**: Move existing tools to Coder Tasks
5. **Enhance**: Add Claude Code, Aider, and advanced features

This approach transforms Aircrew from a proof-of-concept into a production-ready AI agent orchestration platform! 🚀
