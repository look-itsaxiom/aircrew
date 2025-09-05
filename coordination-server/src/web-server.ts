import { PrismaClient } from "@prisma/client";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

// Initialize Prisma Client
const prisma = new PrismaClient();

// Express app
const app = express();
const PORT = 3001;
const WS_PORT = 3003;

app.use(cors());
app.use(express.json());

// Store active agent connections
const agentConnections = new Map();

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    connectedAgents: agentConnections.size,
  });
});

// REST endpoints for debugging
app.get("/projects", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: { tasks: true },
    });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/projects", async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: "active",
      },
    });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.get("/tasks", async (_req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { project: true },
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/tasks", async (req, res) => {
  try {
    const { projectId, title, description, assignedTo } = req.body;
    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        description,
        assignedTo,
        status: "TODO",
      },
    });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// WebSocket server for agent communication
const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws) => {
  console.log("New agent connection established");

  ws.on("message", async (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === "register") {
        const { agentId, agentType, capabilities } = message;
        agentConnections.set(agentId, ws);

        // Store agent registration in database
        await prisma.agent.upsert({
          where: { id: agentId },
          update: {
            status: "ONLINE",
            lastPing: new Date(),
          },
          create: {
            id: agentId,
            name: agentId,
            role: agentType,
            capabilities: JSON.stringify(capabilities),
            status: "ONLINE",
            lastPing: new Date(),
          },
        });

        console.log(`Agent ${agentId} registered with type ${agentType}`);
        ws.send(JSON.stringify({ type: "registered", agentId }));
      }

      if (message.type === "task_update") {
        const { taskId, status } = message;

        await prisma.task.update({
          where: { id: taskId },
          data: {
            status,
            completedAt: status === "DONE" ? new Date() : null,
          },
        });

        console.log(`Task ${taskId} updated to status: ${status}`);

        // Broadcast update to all connected agents
        const updateMessage = JSON.stringify({
          type: "task_updated",
          taskId,
          status,
        });

        agentConnections.forEach((conn) => {
          if (conn.readyState === 1) {
            // WebSocket.OPEN
            conn.send(updateMessage);
          }
        });
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", () => {
    // Remove disconnected agent
    for (const [agentId, connection] of agentConnections.entries()) {
      if (connection === ws) {
        agentConnections.delete(agentId);

        // Update agent status in database
        prisma.agent
          .update({
            where: { id: agentId },
            data: { status: "OFFLINE" },
          })
          .catch(console.error);

        console.log(`Agent ${agentId} disconnected`);
        break;
      }
    }
  });
});

async function main() {
  try {
    // Connect to database
    await prisma.$connect();
    console.log("✅ Database connected");

    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Coordination Server running on http://localhost:${PORT}`);
    });

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
