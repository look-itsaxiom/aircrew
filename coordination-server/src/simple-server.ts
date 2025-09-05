// Simplified Coder-Taskforce Coordination Server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from "@prisma/client";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Express app
const app = express();
const PORT = parseInt(process.env["PORT"] || "3001");
const WS_PORT = parseInt(process.env["WS_PORT"] || "3003");

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Store active agent connections
const agentConnections = new Map();
const agentStatus = new Map();

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

  if (!args) {
    return {
      content: [{ type: "text", text: "No arguments provided" }],
      isError: true,
    };
  }

  try {
    switch (name) {
      case "create_project": {
        const project = await prisma.project.create({
          data: {
            name: args["name"] as string,
            description: (args["description"] as string) || "",
            priority: (args["priority"] as string) || "MEDIUM",
          },
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
            projectId: args["projectId"] as string,
            title: args["title"] as string,
            description: (args["description"] as string) || "",
            assignedTo: args["assignedTo"] as string,
            priority: (args["priority"] as string) || "MEDIUM",
            estimatedHours: args["estimatedHours"] as number,
          },
        });

        return {
          content: [
            {
              type: "text",
              text: `Task "${task.title}" created and assigned to ${task.assignedTo || "unassigned"}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// WebSocket server for real-time agent communication
const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws: WebSocket) => {
  console.log("New agent connection established");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "register") {
        const agentId = message.agentId || "agent-" + Date.now();
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

// REST API endpoints
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connectedAgents: agentConnections.size,
  });
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

    console.log(`📡 WebSocket server running on ws://localhost:${WS_PORT}`);
    console.log("🤖 Coder-Taskforce Coordination Server is ready!");
    console.log("📋 Available via MCP protocol on stdio");
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
