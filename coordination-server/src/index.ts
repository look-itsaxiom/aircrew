import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(morgan(process.env.LOG_FORMAT || "combined"));
app.use(express.json());

// Store active agent connections
const agentConnections = new Map<string, WebSocket>();
const agentStatus = new Map<string, { role: string; lastPing: Date }>();

// MCP Server Tools
const tools: Tool[] = [
  {
    name: "create_project",
    description: "Create a new project for the AI taskforce",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Project description" },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          description: "Project priority level",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task within a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
        title: { type: "string", description: "Task title" },
        description: { type: "string", description: "Task description" },
        assignedTo: {
          type: "string",
          enum: ["PM", "ARCHITECT", "DEV", "QA", "DEVOPS", "DOC"],
          description: "Agent role to assign task to",
        },
        priority: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          description: "Task priority level",
        },
        estimatedHours: { type: "number", description: "Estimated hours to complete" },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of a task",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "Task ID" },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "REVIEW", "TESTING", "DONE", "CANCELLED", "BLOCKED"],
          description: "New task status",
        },
        actualHours: { type: "number", description: "Actual hours spent (optional)" },
        notes: { type: "string", description: "Status update notes" },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "send_agent_message",
    description: "Send a message to another agent or broadcast to all agents",
    inputSchema: {
      type: "object",
      properties: {
        toAgent: { type: "string", description: 'Target agent role or "broadcast"' },
        messageType: { type: "string", description: "Type of message" },
        content: { type: "object", description: "Message content" },
        projectId: { type: "string", description: "Related project ID (optional)" },
        taskId: { type: "string", description: "Related task ID (optional)" },
      },
      required: ["toAgent", "messageType", "content"],
    },
  },
  {
    name: "get_project_status",
    description: "Get comprehensive status of a project",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_agent_tasks",
    description: "Get tasks assigned to a specific agent role",
    inputSchema: {
      type: "object",
      properties: {
        agentRole: {
          type: "string",
          enum: ["PM", "ARCHITECT", "DEV", "QA", "DEVOPS", "DOC"],
          description: "Agent role",
        },
        status: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "REVIEW", "TESTING", "DONE", "CANCELLED", "BLOCKED"],
          description: "Filter by task status (optional)",
        },
      },
      required: ["agentRole"],
    },
  },
  {
    name: "register_agent",
    description: "Register an agent with the coordination server",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Agent name" },
        role: {
          type: "string",
          enum: ["PM", "ARCHITECT", "DEV", "QA", "DEVOPS", "DOC", "COORDINATOR"],
          description: "Agent role",
        },
        endpoint: { type: "string", description: "Agent endpoint URL" },
        capabilities: { type: "object", description: "Agent capabilities" },
      },
      required: ["name", "role"],
    },
  },
];

// Initialize MCP Server
const server = new Server(
  {
    name: "coder-taskforce-coordination-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "create_project": {
        const project = await prisma.project.create({
          data: {
            name: args.name as string,
            description: args.description as string,
            priority: (args.priority as string) || "MEDIUM",
          },
        });

        // Broadcast project creation to all agents
        broadcastToAgents({
          type: "project_created",
          projectId: project.id,
          project: project,
        });

        return {
          content: [
            {
              type: "text",
              text: `Project "${project.name}" created successfully with ID: ${project.id}`,
            },
          ],
        };
      }

      case "create_task": {
        const task = await prisma.task.create({
          data: {
            projectId: args.projectId as string,
            title: args.title as string,
            description: args.description as string,
            assignedTo: args.assignedTo as string,
            priority: (args.priority as string) || "MEDIUM",
            estimatedHours: args.estimatedHours as number,
          },
        });

        // Send task assignment message
        if (args.assignedTo) {
          await sendMessageToAgent(args.assignedTo as string, {
            type: "task_assigned",
            taskId: task.id,
            task: task,
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `Task "${task.title}" created and assigned to ${task.assignedTo || "unassigned"}`,
            },
          ],
        };
      }

      case "update_task_status": {
        const task = await prisma.task.update({
          where: { id: args.taskId as string },
          data: {
            status: args.status as string,
            actualHours: args.actualHours as number,
            ...(args.status === "IN_PROGRESS" && { startedAt: new Date() }),
            ...(args.status === "DONE" && { completedAt: new Date() }),
          },
        });

        // Log the status update as a message
        await prisma.agentMessage.create({
          data: {
            fromAgent: "SYSTEM",
            toAgent: task.assignedTo || "UNASSIGNED",
            messageType: "task_status_update",
            content: JSON.stringify({
              taskId: task.id,
              oldStatus: args.status,
              newStatus: task.status,
              notes: args.notes,
            }),
            taskId: task.id,
            projectId: task.projectId,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `Task status updated to ${task.status}`,
            },
          ],
        };
      }

      case "send_agent_message": {
        const message = await prisma.agentMessage.create({
          data: {
            fromAgent: "SYSTEM", // This would be the calling agent in practice
            toAgent: args.toAgent as string,
            messageType: args.messageType as string,
            content: JSON.stringify(args["content"]),
            projectId: args.projectId as string,
            taskId: args.taskId as string,
          },
        });

        // Send via WebSocket if agent is connected
        if (args.toAgent === "broadcast") {
          broadcastToAgents(args["content"]);
        } else {
          await sendMessageToAgent(args.toAgent as string, args["content"]);
        }

        return {
          content: [
            {
              type: "text",
              text: `Message sent to ${args.toAgent}`,
            },
          ],
        };
      }

      case "get_project_status": {
        const project = await prisma.project.findUnique({
          where: { id: args.projectId as string },
          include: {
            tasks: true,
            _count: {
              select: { tasks: true, messages: true },
            },
          },
        });

        if (!project) {
          return {
            content: [
              {
                type: "text",
                text: "Project not found",
              },
            ],
          };
        }

        const taskStatusCounts = project.tasks.reduce((acc, task) => {
          acc[task.status] = (acc[task.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  project,
                  taskStatusCounts,
                  totalTasks: project._count.tasks,
                  totalMessages: project._count.messages,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "get_agent_tasks": {
        const whereClause: any = {
          assignedTo: args.agentRole as string,
        };
        if (args.status) {
          whereClause.status = args.status as string;
        }

        const tasks = await prisma.task.findMany({
          where: whereClause,
          include: {
            project: {
              select: { name: true, status: true },
            },
          },
          orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tasks, null, 2),
            },
          ],
        };
      }

      case "register_agent": {
        const agent = await prisma.agent.upsert({
          where: {
            name_role: {
              name: args.name as string,
              role: args.role as any,
            },
          },
          update: {
            status: "ONLINE",
            endpoint: args.endpoint as string,
            capabilities: args.capabilities as any,
            lastPing: new Date(),
          },
          create: {
            name: args.name as string,
            role: args.role as any,
            status: "ONLINE",
            endpoint: args.endpoint as string,
            capabilities: args.capabilities as any,
            lastPing: new Date(),
          },
        });

        agentStatus.set(agent.id, {
          role: agent.role,
          lastPing: new Date(),
        });

        return {
          content: [
            {
              type: "text",
              text: `Agent ${agent.name} (${agent.role}) registered successfully`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ],
      isError: true,
    };
  }
});

// WebSocket server for real-time agent communication
const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws: WebSocket, req) => {
  console.log("New agent connection established");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "register") {
        const agentId = message.agentId || uuidv4();
        agentConnections.set(agentId, ws);
        agentStatus.set(agentId, {
          role: message.role,
          lastPing: new Date(),
        });

        ws.send(
          JSON.stringify({
            type: "registered",
            agentId: agentId,
            timestamp: new Date().toISOString(),
          })
        );

        console.log(`Agent ${agentId} (${message.role}) registered via WebSocket`);
      } else if (message.type === "heartbeat") {
        const agentId = message.agentId;
        if (agentStatus.has(agentId)) {
          agentStatus.set(agentId, {
            ...agentStatus.get(agentId)!,
            lastPing: new Date(),
          });
        }

        ws.send(
          JSON.stringify({
            type: "heartbeat_ack",
            timestamp: new Date().toISOString(),
          })
        );
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    // Remove disconnected agent
    for (const [agentId, connection] of agentConnections.entries()) {
      if (connection === ws) {
        agentConnections.delete(agentId);
        agentStatus.delete(agentId);
        console.log(`Agent ${agentId} disconnected`);
        break;
      }
    }
  });
});

// Helper functions
async function sendMessageToAgent(targetRole: string, content: any) {
  // Find connected agents with the target role
  for (const [agentId, status] of agentStatus.entries()) {
    if (status.role === targetRole) {
      const connection = agentConnections.get(agentId);
      if (connection && connection.readyState === WebSocket.OPEN) {
        connection.send(
          JSON.stringify({
            type: "message",
            content: content,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }
  }
}

function broadcastToAgents(content: any) {
  const message = JSON.stringify({
    type: "broadcast",
    content: content,
    timestamp: new Date().toISOString(),
  });

  for (const connection of agentConnections.values()) {
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(message);
    }
  }
}

// REST API endpoints for debugging and monitoring
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connectedAgents: agentConnections.size,
    registeredAgents: agentStatus.size,
  });
});

app.get("/agents", async (req, res) => {
  const agents = await prisma.agent.findMany();
  const connectedAgents = Array.from(agentStatus.entries()).map(([id, status]) => ({
    id,
    ...status,
    connected: agentConnections.has(id),
  }));

  res.json({
    registeredAgents: agents,
    connectedAgents: connectedAgents,
  });
});

app.get("/projects", async (req, res) => {
  const projects = await prisma.project.findMany({
    include: {
      tasks: true,
      _count: { select: { tasks: true, messages: true } },
    },
  });
  res.json(projects);
});

app.get("/projects/:id", async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: true,
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.json(project);
});

// Start servers
async function main() {
  try {
    // Initialize database
    await prisma.$connect();
    console.log("✅ Database connected");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Coordination Server running on http://localhost:${PORT}`);
    });

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log(`🔗 MCP Server connected on stdio transport`);

    console.log(`📡 WebSocket server running on ws://localhost:${WS_PORT}`);
    console.log("🤖 Coder-Taskforce Coordination Server is ready!");
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down gracefully...");
  await prisma.$disconnect();
  process.exit(0);
});

main().catch(console.error);
