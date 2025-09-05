import { WebSocket } from "ws";

/**
 * Simple PM Agent using WebSocket communication
 * Responsible for creating projects, breaking them down into tasks, and assigning work
 */
class SimplePMAgent {
  private ws?: WebSocket;
  private agentId: string;
  private name: string;
  private role: string;

  constructor() {
    this.agentId = "pm-agent-001";
    this.name = "Project Manager";
    this.role = "PM";
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket("ws://localhost:3003");

      this.ws.on("open", () => {
        console.log("📡 PM Agent connected to coordination server");

        // Register with the coordination server
        this.ws!.send(
          JSON.stringify({
            type: "register",
            agentId: this.agentId,
            agentType: this.role,
            capabilities: ["project_management", "task_creation", "team_coordination"],
          })
        );

        resolve();
      });

      this.ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      });

      this.ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        reject(error);
      });

      this.ws.on("close", () => {
        console.log("📡 PM Agent disconnected from coordination server");
      });
    });
  }

  private handleMessage(message: any): void {
    console.log("📨 PM Agent received message:", message);

    switch (message.type) {
      case "registered":
        console.log("✅ PM Agent registration confirmed");
        break;
      case "task_assignment":
        console.log("📋 PM Agent: Task assignment acknowledgment");
        break;
      default:
        console.log("📋 PM Agent: Unknown message type:", message.type);
    }
  }

  async createProject(name: string, description: string): Promise<void> {
    console.log(`📋 PM Agent: Creating project "${name}"`);

    try {
      // Use the coordination server REST API to create project
      const response = await fetch("http://localhost:3001/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
        }),
      });

      if (response.ok) {
        const project = await response.json();
        console.log(`✅ PM Agent: Created project "${project.name}" (ID: ${project.id})`);

        // Break down project into tasks
        await this.createTasksForProject(project);
        return project;
      } else {
        throw new Error(`Failed to create project: ${response.statusText}`);
      }
    } catch (error) {
      console.error("❌ PM Agent: Failed to create project:", error);
      throw error;
    }
  }

  private async createTasksForProject(project: any): Promise<void> {
    console.log(`📋 PM Agent: Breaking down project "${project.name}" into tasks...`);

    // Basic task breakdown based on typical software development workflow
    const tasks = [
      {
        title: "Database Design & Setup",
        description: "Design database schema and set up data layer",
        assignedTo: "DEV",
        priority: "HIGH",
      },
      {
        title: "Project Setup & Architecture",
        description: "Set up project structure, choose technologies, and design overall architecture",
        assignedTo: "ARCHITECT",
        priority: "HIGH",
      },
      {
        title: "API Development",
        description: "Design and implement REST API endpoints",
        assignedTo: "DEV",
        priority: "HIGH",
      },
      {
        title: "Core Implementation",
        description: "Implement main features and functionality",
        assignedTo: "DEV",
        priority: "HIGH",
      },
      {
        title: "Testing & Quality Assurance",
        description: "Write tests, perform code review, and ensure quality",
        assignedTo: "QA",
        priority: "MEDIUM",
      },
      {
        title: "Documentation",
        description: "Create user documentation and technical documentation",
        assignedTo: "DOC",
        priority: "MEDIUM",
      },
    ];

    // Create tasks via coordination server REST API
    for (const task of tasks) {
      try {
        const response = await fetch("http://localhost:3001/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            projectId: project.id,
            title: task.title,
            description: task.description,
            assignedTo: task.assignedTo,
            priority: task.priority,
          }),
        });

        if (response.ok) {
          const createdTask = await response.json();
          console.log(`✅ PM Agent: Created task "${createdTask.title}" assigned to ${task.assignedTo}`);

          // Notify assigned agent via WebSocket
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(
              JSON.stringify({
                type: "task_assignment",
                taskId: createdTask.id,
                task: createdTask,
                assignedTo: task.assignedTo,
                projectId: project.id,
                fromAgent: this.agentId,
              })
            );
          }
        } else {
          console.error(`❌ PM Agent: Failed to create task "${task.title}": ${response.statusText}`);
        }
      } catch (error) {
        console.error(`❌ PM Agent: Failed to create task "${task.title}":`, error);
      }
    }

    console.log(`📋 PM Agent: Project "${project.name}" has been fully planned and tasks assigned`);
  }

  async startProject(description: string): Promise<void> {
    console.log(`📋 PM Agent: Starting new project: "${description}"`);
    await this.createProject(description, `Project: ${description}`);
  }

  async checkProjects(): Promise<void> {
    console.log("📋 PM Agent: Checking all projects...");

    try {
      const response = await fetch("http://localhost:3001/projects");
      if (response.ok) {
        const projects = await response.json();
        console.log("📊 Current Projects:", projects);
      } else {
        console.error("❌ Failed to fetch projects:", response.statusText);
      }
    } catch (error) {
      console.error("❌ PM Agent: Failed to get projects:", error);
    }
  }

  async checkTasks(): Promise<void> {
    console.log("📋 PM Agent: Checking all tasks...");

    try {
      const response = await fetch("http://localhost:3001/tasks");
      if (response.ok) {
        const tasks = await response.json();
        console.log("📊 Current Tasks:", tasks);
      } else {
        console.error("❌ Failed to fetch tasks:", response.statusText);
      }
    } catch (error) {
      console.error("❌ PM Agent: Failed to get tasks:", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Create and start Simple PM Agent
async function main() {
  console.log("🚀 Starting Simple PM Agent...");

  const pmAgent = new SimplePMAgent();
  await pmAgent.connect();

  console.log("✅ Simple PM Agent is online and ready to manage projects!");

  // Demo: Start a sample project
  console.log("\n🎯 Demo: Creating a sample project...");
  await pmAgent.startProject("Task Management System");

  // Check status after a moment
  setTimeout(async () => {
    console.log("\n📊 Checking project and task status...");
    await pmAgent.checkProjects();
    await pmAgent.checkTasks();
  }, 3000);

  // Keep agent running
  process.on("SIGINT", async () => {
    console.log("\n🔄 Simple PM Agent shutting down...");
    await pmAgent.disconnect();
    process.exit(0);
  });
}

main().catch(console.error);
