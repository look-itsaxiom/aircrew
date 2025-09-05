import { TaskforceAgent, TaskforceMessage } from "@coder-taskforce/shared";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  console.log("🎯 Starting PM Agent for Coder-Taskforce...");

  // Create PM agent instance
  const pmAgent = new TaskforceAgent({
    name: "PM-Agent-01",
    role: "PM",
    coordinationServerUrl: process.env.COORDINATION_SERVER_URL || "http://localhost:3001",
    coordinationServerWsUrl: process.env.COORDINATION_SERVER_WS_URL || "ws://localhost:3003",
    mcpServerCommand: ["node", process.env.MCP_SERVER_PATH || "../../coordination-server/dist/index.js"],
  });

  // Set up message handlers
  pmAgent.onMessage("task_completed", (message: TaskforceMessage) => {
    console.log("✅ Task completed notification:", message.content);
    // PM agent can update project status, reassign tasks, etc.
  });

  pmAgent.onMessage("progress_update", (message: TaskforceMessage) => {
    console.log("📊 Progress update from agent:", message.content);
    // Track progress and update stakeholders
  });

  pmAgent.onMessage("help_request", (message: TaskforceMessage) => {
    console.log("🆘 Help request from agent:", message.content);
    // PM can provide guidance or reassign tasks
  });

  try {
    // Initialize the agent
    await pmAgent.initialize();

    console.log(`🚀 PM Agent ${pmAgent.name} is ready!`);
    console.log(`Agent ID: ${pmAgent.id}`);
    console.log(`Role: ${pmAgent.role}`);

    // Demo: Create a test project
    await demoProjectCreation(pmAgent);
  } catch (error) {
    console.error("❌ Failed to start PM Agent:", error);
    process.exit(1);
  }
}

async function demoProjectCreation(agent: TaskforceAgent) {
  try {
    console.log("\n🎬 Running PM Agent Demo...");

    // 1. Create a new project
    console.log("1. Creating new project...");
    const projectResult = await agent.createProject("Website Redesign", "Redesign the company website with modern UI/UX", "HIGH");
    console.log("Project created:", projectResult);

    // Extract project ID from the result (this would be more robust in production)
    const projectIdMatch = projectResult.content[0]?.text?.match(/ID: (\w+)/);
    if (!projectIdMatch) {
      console.error("Could not extract project ID from result");
      return;
    }
    const projectId = projectIdMatch[1];
    console.log(`Using project ID: ${projectId}`);

    // 2. Break down project into tasks
    console.log("\n2. Creating tasks for the project...");

    await agent.createTask(
      projectId,
      "Design new homepage mockups",
      "Create wireframes and high-fidelity mockups for the new homepage",
      "ARCHITECT",
      "HIGH",
      8
    );

    await agent.createTask(projectId, "Implement responsive navigation", "Build responsive navigation component with mobile support", "DEV", "MEDIUM", 12);

    await agent.createTask(projectId, "Set up testing framework", "Configure unit and integration testing for the new website", "QA", "MEDIUM", 6);

    console.log("✅ Tasks created successfully!");

    // 3. Get project status
    console.log("\n3. Checking project status...");
    const statusResult = await agent.getProjectStatus(projectId);
    console.log("Project status:", JSON.parse(statusResult.content[0]?.text || "{}"));

    // 4. Get tasks assigned to DEV role
    console.log("\n4. Getting DEV agent tasks...");
    const devTasksResult = await agent.getMyTasks();
    console.log("PM tasks:", JSON.parse(devTasksResult.content[0]?.text || "[]"));

    // 5. Send a message to DEV agent
    console.log("\n5. Sending message to DEV agent...");
    await agent.sendMessage(
      "DEV",
      "project_kickoff",
      {
        message: "New project started! Please review your assigned tasks.",
        projectId: projectId,
        priority: "high",
      },
      projectId
    );

    console.log("🎉 PM Agent demo completed successfully!");
  } catch (error) {
    console.error("❌ Demo failed:", error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔄 Shutting down PM Agent...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🔄 Shutting down PM Agent...");
  process.exit(0);
});

main().catch(console.error);
