import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";

export interface AgentConfig {
  name: string;
  role: "PM" | "ARCHITECT" | "DEV" | "QA" | "DEVOPS" | "DOC" | "COORDINATOR";
  coordinationServerUrl?: string;
  coordinationServerWsUrl?: string;
  mcpServerCommand?: string[];
}

export interface TaskforceMessage {
  type: string;
  content: any;
  timestamp: string;
  fromAgent?: string;
  toAgent?: string;
  projectId?: string;
  taskId?: string;
}

export class TaskforceAgent {
  private config: AgentConfig;
  private mcpClient?: Client;
  private wsConnection?: WebSocket;
  private agentId: string;
  private messageHandlers: Map<string, (message: TaskforceMessage) => void> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
    this.agentId = uuidv4();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize MCP client connection to coordination server
      if (this.config.mcpServerCommand) {
        await this.initializeMcpClient();
      }

      // Initialize WebSocket connection for real-time communication
      await this.initializeWebSocket();

      // Register this agent with the coordination server
      await this.registerAgent();

      console.log(`✅ Agent ${this.config.name} (${this.config.role}) initialized successfully`);
    } catch (error) {
      console.error(`❌ Failed to initialize agent ${this.config.name}:`, error);
      throw error;
    }
  }

  private async initializeMcpClient(): Promise<void> {
    if (!this.config.mcpServerCommand) return;

    this.mcpClient = new Client(
      {
        name: `${this.config.name}-mcp-client`,
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    const transport = new StdioClientTransport({
      command: this.config.mcpServerCommand[0],
      args: this.config.mcpServerCommand.slice(1),
    });

    await this.mcpClient.connect(transport);
    console.log(`🔗 MCP client connected for agent ${this.config.name}`);
  }

  private async initializeWebSocket(): Promise<void> {
    const wsUrl = this.config.coordinationServerWsUrl || "ws://localhost:3003";

    return new Promise((resolve, reject) => {
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.on("open", () => {
        console.log(`📡 WebSocket connected for agent ${this.config.name}`);

        // Register with the coordination server
        this.wsConnection!.send(
          JSON.stringify({
            type: "register",
            agentId: this.agentId,
            role: this.config.role,
            name: this.config.name,
          })
        );

        // Start heartbeat
        this.startHeartbeat();
        resolve();
      });

      this.wsConnection.on("message", (data) => {
        try {
          const message: TaskforceMessage = JSON.parse(data.toString());
          this.handleIncomingMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      });

      this.wsConnection.on("error", (error) => {
        console.error(`WebSocket error for agent ${this.config.name}:`, error);
        reject(error);
      });

      this.wsConnection.on("close", () => {
        console.log(`📡 WebSocket disconnected for agent ${this.config.name}`);
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000);
      });
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.wsConnection.send(
          JSON.stringify({
            type: "heartbeat",
            agentId: this.agentId,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }, 10000); // Send heartbeat every 10 seconds
  }

  private handleIncomingMessage(message: TaskforceMessage): void {
    console.log(`📨 Agent ${this.config.name} received message:`, message.type);

    // Call registered message handlers
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.log(`No handler registered for message type: ${message.type}`);
    }
  }

  // Register a message handler for specific message types
  onMessage(messageType: string, handler: (message: TaskforceMessage) => void): void {
    this.messageHandlers.set(messageType, handler);
  }

  // MCP tool calling methods
  async createProject(name: string, description?: string, priority?: string): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "create_project",
      arguments: { name, description, priority },
    });

    return result;
  }

  async createTask(projectId: string, title: string, description?: string, assignedTo?: string, priority?: string, estimatedHours?: number): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "create_task",
      arguments: { projectId, title, description, assignedTo, priority, estimatedHours },
    });

    return result;
  }

  async updateTaskStatus(taskId: string, status: string, actualHours?: number, notes?: string): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "update_task_status",
      arguments: { taskId, status, actualHours, notes },
    });

    return result;
  }

  async getProjectStatus(projectId: string): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "get_project_status",
      arguments: { projectId },
    });

    return result;
  }

  async getMyTasks(status?: string): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "get_agent_tasks",
      arguments: { agentRole: this.config.role, status },
    });

    return result;
  }

  async sendMessage(toAgent: string, messageType: string, content: any, projectId?: string, taskId?: string): Promise<any> {
    if (!this.mcpClient) throw new Error("MCP client not initialized");

    const result = await this.mcpClient.callTool({
      name: "send_agent_message",
      arguments: { toAgent, messageType, content, projectId, taskId },
    });

    return result;
  }

  private async registerAgent(): Promise<void> {
    if (!this.mcpClient) return;

    try {
      await this.mcpClient.callTool({
        name: "register_agent",
        arguments: {
          name: this.config.name,
          role: this.config.role,
          endpoint: this.config.coordinationServerWsUrl,
          capabilities: {
            mcpSupported: true,
            websocketSupported: true,
            agentId: this.agentId,
          },
        },
      });

      console.log(`✅ Agent ${this.config.name} registered with coordination server`);
    } catch (error) {
      console.error(`❌ Failed to register agent ${this.config.name}:`, error);
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log(`🔄 Shutting down agent ${this.config.name}...`);

    if (this.wsConnection) {
      this.wsConnection.close();
    }

    if (this.mcpClient) {
      // MCP client shutdown is handled automatically
    }

    console.log(`✅ Agent ${this.config.name} shutdown complete`);
  }

  // Getters
  get id(): string {
    return this.agentId;
  }

  get name(): string {
    return this.config.name;
  }

  get role(): string {
    return this.config.role;
  }
}

// Export types
export type { AgentConfig, TaskforceMessage };
