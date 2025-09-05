import { TaskforceAgent, AgentConfig, TaskforceMessage } from "../shared/src/agent-client.js";

/**
 * Project Manager Agent
 * Responsible for creating projects, breaking them down into tasks, and assigning work
 */
class PMAgent extends TaskforceAgent {
  constructor() {
    const config: AgentConfig = {
      name: "Project Manager",
      role: "PM",
      coordinationServerWsUrl: "ws://localhost:3003",
      mcpServerCommand: ["node", "dist/simple-server.js"], // Connect to coordination server via MCP
    };
    super(config);
  }

  async initialize(): Promise<void> {
    await super.initialize();

    // Set up message handlers
    this.onMessage("project_request", this.handleProjectRequest.bind(this));
    this.onMessage("task_completed", this.handleTaskCompletion.bind(this));

    console.log("📋 PM Agent ready to manage projects and tasks");
  }

  private async handleProjectRequest(message: TaskforceMessage): Promise<void> {
    const { description, requirements } = message.content;
    console.log(`📋 PM Agent: Creating project for "${description}"`);

    try {
      // Create project using MCP method
      const projectResult = await this.createProject(description, `Project: ${description}\nRequirements: ${requirements?.join(", ") || "Not specified"}`);

      if (projectResult && projectResult.content) {
        const project = JSON.parse(projectResult.content[0].text);
        console.log(`✅ PM Agent: Created project "${project.name}" (ID: ${project.id})`);

        // Break down project into tasks
        await this.createTasksForProject(project, requirements);
      }
    } catch (error) {
      console.error("❌ PM Agent: Failed to create project:", error);
    }
  }

  private async createTasksForProject(project: any, requirements: string[] = []): Promise<void> {
    console.log(`📋 PM Agent: Breaking down project "${project.name}" into tasks...`);

    // Basic task breakdown based on typical software development workflow
    const tasks = [
      {
        title: "Project Setup & Architecture",
        description: "Set up project structure, choose technologies, and design overall architecture",
        assignedTo: "ARCHITECT",
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

    // Add requirement-specific tasks
    if (requirements?.includes("database")) {
      tasks.unshift({
        title: "Database Design & Setup",
        description: "Design database schema and set up data layer",
        assignedTo: "DEV",
        priority: "HIGH",
      });
    }

    if (requirements?.includes("api")) {
      tasks.splice(2, 0, {
        title: "API Development",
        description: "Design and implement REST API endpoints",
        assignedTo: "DEV",
        priority: "HIGH",
      });
    }

    // Create tasks via coordination server
    for (const task of tasks) {
      try {
        const taskResult = await this.createTask(project.id, task.title, task.description, task.assignedTo, task.priority);

        if (taskResult && taskResult.content) {
          const createdTask = JSON.parse(taskResult.content[0].text);
          console.log(`✅ PM Agent: Created task "${createdTask.title}" assigned to ${task.assignedTo}`);

          // Notify assigned agent
          await this.sendMessage(
            task.assignedTo,
            "task_assignment",
            {
              taskId: createdTask.id,
              task: createdTask,
              projectId: project.id,
            },
            project.id,
            createdTask.id
          );
        }
      } catch (error) {
        console.error(`❌ PM Agent: Failed to create task "${task.title}":`, error);
      }
    }

    console.log(`📋 PM Agent: Project "${project.name}" has been fully planned and tasks assigned`);
  }

  private async handleTaskCompletion(message: TaskforceMessage): Promise<void> {
    const { taskId, agentId, result } = message.content;
    console.log(`📋 PM Agent: Task ${taskId} completed by ${agentId}`);

    // Update task status
    await this.updateTaskStatus(taskId, "DONE");

    console.log(`✅ PM Agent: Marked task ${taskId} as completed`);
  }

  /**
   * Start a new project
   */
  async startProject(description: string, requirements: string[] = []): Promise<void> {
    console.log(`📋 PM Agent: Starting new project: "${description}"`);

    await this.handleProjectRequest({
      type: "project_request",
      content: { description, requirements },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get project status
   */
  async checkAllProjects(): Promise<void> {
    console.log("📋 PM Agent: Checking all projects...");

    try {
      // For now we'll just get tasks assigned to PM role to see project status
      const tasksResult = await this.getMyTasks();
      if (tasksResult && tasksResult.content) {
        const tasks = JSON.parse(tasksResult.content[0].text);
        console.log("📊 PM Tasks:", tasks);
      }
    } catch (error) {
      console.error("❌ PM Agent: Failed to get project status:", error);
    }
  }
}

// Create and start PM Agent
async function main() {
  console.log("🚀 Starting PM Agent...");

  const pmAgent = new PMAgent();
  await pmAgent.initialize();

  console.log("✅ PM Agent is online and ready to manage projects!");

  // Demo: Start a sample project
  console.log("\n🎯 Demo: Creating a sample project...");
  await pmAgent.startProject("Task Management System", ["database", "api", "web-interface"]);

  // Check status after a moment
  setTimeout(async () => {
    await pmAgent.checkAllProjects();
  }, 2000);

  // Keep agent running
  process.on("SIGINT", async () => {
    console.log("\n🔄 PM Agent shutting down...");
    await pmAgent.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
