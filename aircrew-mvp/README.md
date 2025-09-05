# Aircrew MVP Architecture

A proof-of-concept implementation of the Aircrew system focusing on PM (Project Manager) and DEV (Developer) agent coordination.

## Overview

This MVP validates the core thesis that AI agents can effectively coordinate to complete multi-step development tasks through role-based specialization and structured communication.

## Technology Stack & Decisions

- **Runtime**: TypeScript/Node.js for MCP communication and tooling
- **Agent Environment**: code-server (VS Code in browser) with GitHub Copilot
- **Database**: SQLite for simplicity and file-based storage
- **Orchestration**: Docker Compose (K8s complexity not needed for MVP)
- **Version Control**: Git-based collaboration with shared repository
- **Communication**: MCP (Model Context Protocol) for inter-agent messaging

### Agent Lifecycle Strategy

- **PM Agent**: Project-scoped lifecycle (exists from project creation to completion)
- **DEV Agent**: Task-scoped lifecycle (spun up per task, persists until QA validation complete)
- **Context Management**: Fresh chat sessions per task to reduce cognitive load
- **Git Strategy**: Branch-per-task workflow, PM handles merge conflict resolution

## Architecture

### Core Components

```
┌─────────────────┐    ┌─────────────────┐
│   PM Agent      │◄──►│   DEV Agent     │
│ (Project Scope) │    │  (Task Scope)   │
│   code-server   │    │   code-server   │
└─────────────────┘    └─────────────────┘
        │                       │
        └───────┬───────────────┘
                │
        ┌─────────────────┐
        │  Shared State   │
        │   Git Repo +    │
        │   SQLite DB     │
        └─────────────────┘
```

### Git Workflow Strategy

```
main branch (PM manages)
├── feature/task-001-html-structure (DEV creates/works)
├── feature/task-002-css-styling   (DEV creates/works)
└── feature/task-003-js-functionality (DEV creates/works)

Flow:
1. PM creates task → DEV gets fresh branch
2. DEV implements → commits to feature branch
3. DEV signals completion → PM reviews branch
4. PM merges (handles any conflicts) → DEV container destroyed
```

### 1. PM Agent Environment

- **Container**: code-server with PM-specific tools
- **Role**: Requirements gathering, task breakdown, validation, coordination
- **Tools**:
  - Task breakdown and management
  - Requirements validation
  - Progress tracking
  - Basic project planning
  - MCP client for DEV communication
- **Specialized Instructions**:
  - Break complex requests into <150 line code tasks
  - Validate DEV output against requirements
  - Maintain project context and decisions
  - Focus on coordination, not implementation

### 2. DEV Agent Environment

- **Container**: code-server with full development stack
- **Role**: Code implementation, testing, technical execution
- **Tools**:
  - Full development stack (Node.js, Python, etc.)
  - GitHub Copilot
  - File system access to shared workspace
  - Testing frameworks
  - MCP client for PM communication
- **Specialized Instructions**:
  - Focus only on assigned task
  - Follow coding best practices
  - Report implementation status clearly
  - Ask PM for clarification when requirements are unclear

## Communication Protocol

### Message Schema

```typescript
interface TaskMessage {
  id: string;
  type: "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
  from: "PM" | "DEV";
  to: "PM" | "DEV";
  task_id: string;
  content: string;
  files_changed?: string[];
  status?: "pending" | "in_progress" | "complete" | "needs_revision";
  timestamp: string;
}
```

### Communication Flow

1. **User → PM**: Project request via chat interface
2. **PM → DEV**: Task assignment with detailed requirements
3. **DEV → PM**: Implementation completion or questions
4. **PM → DEV**: Validation feedback or next task assignment

## Data Schema

### Database Structure (SQLite)

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Tasks table
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  assigned_to TEXT DEFAULT 'DEV',
  status TEXT DEFAULT 'pending',
  dependencies TEXT, -- JSON array of task IDs
  files_to_modify TEXT, -- JSON array of file paths
  estimated_lines INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (project_id) REFERENCES projects (id)
);

-- Messages table (audit trail)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  task_id TEXT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT,
  metadata TEXT, -- JSON for additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects (id),
  FOREIGN KEY (task_id) REFERENCES tasks (id)
);
```

## MVP Workflow

### Phase 1: Requirements Gathering

1. User describes project to PM via chat interface
2. PM asks clarifying questions to understand scope and requirements
3. PM creates project record with structured requirements
4. PM analyzes requirements and creates initial task breakdown (2-4 tasks)

### Phase 2: Task Assignment

```json
{
  "type": "TASK_ASSIGNMENT",
  "task": {
    "id": "task_001",
    "title": "Create basic HTML structure",
    "description": "Create index.html with semantic HTML5 structure including header, main content area, and footer",
    "acceptance_criteria": [
      "Valid HTML5 document structure",
      "Responsive meta tags included",
      "Semantic HTML elements (header, main, footer, nav)",
      "Basic accessibility attributes"
    ],
    "files_to_create": ["index.html"],
    "estimated_scope": "~30 lines",
    "dependencies": []
  }
}
```

### Phase 3: Implementation & Feedback Loop

```json
{
  "type": "TASK_COMPLETE",
  "task_id": "task_001",
  "status": "complete",
  "files_changed": ["index.html"],
  "summary": "Created semantic HTML5 structure with accessibility features",
  "implementation_notes": "Added ARIA labels and semantic structure as requested",
  "next_dependencies_ready": ["task_002"]
}
```

### Phase 4: Validation & Iteration

1. PM reviews DEV output against acceptance criteria
2. **If satisfactory**: Mark task complete, assign next dependent task
3. **If needs revision**: Provide specific feedback and reassign with corrections
4. Continue until all project tasks are complete

## Success Metrics

### Primary Goals

- **End-to-End Completion**: PM can coordinate DEV to complete a 3-4 task project without human intervention
- **Quality Maintenance**: Output meets specified requirements and coding standards
- **Effective Communication**: Agents can clarify requirements and provide meaningful feedback

### Test Project Examples

1. **Basic Landing Page**: HTML structure + CSS styling + contact form
2. **Simple API**: Express.js server with 2-3 endpoints and basic validation
3. **Static Site Generator**: Basic blog with markdown processing

### Validation Criteria

- ✅ Project completes successfully
- ✅ Code quality meets standards
- ✅ Requirements are satisfied
- ✅ Task dependencies are properly managed
- ✅ Communication is clear and effective

## Technical Implementation Plan

### Project Structure

```
aircrew-mvp/
├── docker-compose.yml           # Container orchestration
├── shared-workspace/            # Mounted volume for file sharing
│   ├── projects/               # Generated project files
│   └── state/                  # SQLite database
├── pm-agent/
│   ├── Dockerfile
│   ├── copilot-instructions.md # PM role definition
│   ├── tools/                  # PM-specific MCP tools
│   └── src/                    # PM logic implementation
├── dev-agent/
│   ├── Dockerfile
│   ├── copilot-instructions.md # DEV role definition
│   ├── tools/                  # DEV-specific MCP tools
│   └── src/                    # DEV logic implementation
├── mcp-server/
│   ├── communication.ts        # Message passing system
│   ├── state-management.ts     # Database operations
│   └── schemas.ts              # Type definitions
└── web-interface/
    ├── pm-chat.html            # User interface for PM interaction
    └── project-dashboard.html  # Project monitoring interface
```

### Implementation Phases

#### Phase 1: Infrastructure Setup (Week 1-2)

- [ ] Docker containers for PM and DEV agents
- [ ] Shared workspace configuration
- [ ] Basic SQLite database setup
- [ ] Container networking and communication

#### Phase 2: MCP Communication Layer (Week 2-3)

- [ ] Message queue implementation
- [ ] MCP server for inter-agent communication
- [ ] Basic message routing and delivery
- [ ] Error handling and retry logic

#### Phase 3: PM Agent Implementation (Week 3-4)

- [ ] Requirements gathering logic
- [ ] Task breakdown algorithms
- [ ] Dependency management
- [ ] Validation and feedback systems

#### Phase 4: DEV Agent Implementation (Week 4-5)

- [ ] Task execution framework
- [ ] Code generation and modification
- [ ] Progress reporting
- [ ] Quality checks and testing

#### Phase 5: Integration & Testing (Week 5-6)

- [ ] End-to-end workflow testing
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Documentation and examples

## What This Proves

### Core Validations

1. **Agent Coordination**: Two specialized AI agents can collaborate effectively on software development tasks
2. **Task Decomposition**: PM can break down complex requests into manageable, implementable tasks
3. **Quality Control**: Feedback loops maintain output quality without human intervention
4. **State Management**: Shared context and project state can be maintained across agent interactions
5. **Scalability Foundation**: Architecture supports future expansion to additional agent roles

### Risk Mitigation

- **Communication Overhead**: Structured message protocol prevents chatty or unclear communication
- **Context Drift**: Database state management maintains project context across interactions
- **Quality Degradation**: Explicit validation steps ensure output meets requirements
- **Infinite Loops**: Task status tracking and retry limits prevent endless revision cycles

## Future Expansion Path

Once MVP validates core concepts:

1. **Add QA Agent**: Automated testing and validation
2. **Add Architect Agent**: Complex system design and technical planning
3. **Add Documentation Agent**: Automated documentation generation
4. **Enhanced PM**: More sophisticated project management and planning
5. **Multi-Project Support**: Parallel project coordination
6. **Learning System**: Improvement based on project success patterns

---

_This MVP serves as the foundation for validating that AI agents can effectively coordinate on complex, multi-step development tasks through role specialization and structured communication._
