import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { z } from "zod";
import { DatabaseService } from "./database-service.js";
import { MessageQueue } from "./message-queue.js";
import { handleAICodingRequest } from "./tools/ai-coding-assistant.js";

// Use the file extension imports like in the examples
import { McpServer } from "../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js";
import { StreamableHTTPServerTransport } from "../../node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for browser clients
app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "mcp-session-id"],
  })
);

app.use(express.json());

// Initialize database and message queue
const databaseService = new DatabaseService();
const messageQueue = new MessageQueue(databaseService);

// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Create MCP server for agent communication
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "aircrew-communication-server",
    version: "1.0.0",
  });

  // Tool for sending messages between agents
  server.registerTool(
    "send_message",
    {
      title: "Send Message",
      description: "Send a message to another agent",
      inputSchema: {
        to: z.enum(["PM", "DEV"]).describe("Target agent"),
        type: z.enum(["PING", "PONG", "TASK_ASSIGNMENT", "TASK_COMPLETE", "FEEDBACK", "QUESTION"]).describe("Message type"),
        content: z.string().describe("Message content"),
        taskId: z.string().optional().describe("Task ID if related to a specific task"),
      },
    },
    async ({
      to,
      type,
      content,
      taskId,
    }: {
      to: "PM" | "DEV";
      type: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
      content: string;
      taskId?: string;
    }) => {
      try {
        const messageId = await messageQueue.sendMessage({
          to,
          type,
          content,
          taskId,
        });

        return {
          content: [
            {
              type: "text",
              text: `Message sent successfully with ID: ${messageId}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sending message: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool for receiving messages
  server.registerTool(
    "get_messages",
    {
      title: "Get Messages",
      description: "Get messages for the current agent",
      inputSchema: {
        agentRole: z.enum(["PM", "DEV"]).describe("Current agent role"),
        markAsRead: z.boolean().default(true).describe("Mark messages as read after retrieving"),
      },
    },
    async ({ agentRole, markAsRead }: { agentRole: "PM" | "DEV"; markAsRead: boolean }) => {
      try {
        const messages = await messageQueue.getMessages(agentRole, markAsRead);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(messages, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting messages: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Simple ping tool for testing
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Send a ping message for testing connectivity",
      inputSchema: {
        message: z.string().default("ping").describe("Ping message"),
      },
    },
    async ({ message }: { message: string }) => {
      return {
        content: [
          {
            type: "text",
            text: `pong: ${message}`,
          },
        ],
      };
    }
  );

  // AI Coding Assistant Tool
  server.registerTool(
    "ai_coding_assistant",
    {
      title: "AI Coding Assistant",
      description: "AI-powered coding assistance for code generation, review, testing, and refactoring",
      inputSchema: {
        task: z.enum(["generate", "review", "explain", "test", "refactor"]).describe("Type of coding assistance needed"),
        language: z.string().describe("Programming language (e.g., typescript, python, javascript)"),
        context: z.string().describe("Code context or description of what needs to be done"),
        requirements: z.string().optional().describe("Additional requirements or constraints"),
      },
    },
    async ({
      task,
      language,
      context,
      requirements,
    }: {
      task: "generate" | "review" | "explain" | "test" | "refactor";
      language: string;
      context: string;
      requirements?: string;
    }) => {
      try {
        const result = await handleAICodingRequest({ task, language, context, requirements });

        return {
          content: [
            {
              type: "text",
              text: `AI Coding Assistant Result:\n\n${result.explanation}\n\n${
                result.code ? `Generated Code:\n\`\`\`${language}\n${result.code}\n\`\`\`` : ""
              }\n\n${result.suggestions ? `Suggestions:\n${result.suggestions.map((s: string) => `• ${s}`).join("\n")}` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error with AI coding assistant: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Handle MCP requests
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
  } else {
    // Create new transport for new session
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId: string) => {
        transports[sessionId] = transport;
        console.log(`New MCP session initialized: ${sessionId}`);
      },
      enableDnsRebindingProtection: false, // Disabled for local development
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
        console.log(`MCP session closed: ${transport.sessionId}`);
      }
    };

    // Connect MCP server to transport
    const server = createMcpServer();
    await server.connect(transport);
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Handle GET requests for SSE notifications
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Handle DELETE requests for session termination
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

// Health check endpoint
app.get("/health", async (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: "connected", // Prisma handles connection automatically
  });
});

// Initialize database and start server
async function start() {
  try {
    await databaseService.connect();
    console.log("Database service ready");

    app.listen(PORT, () => {
      console.log(`Aircrew MCP Server listening on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await databaseService.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await databaseService.disconnect();
  process.exit(0);
});

start().catch(console.error);
