import { PrismaClient } from "@prisma/client";

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: "PM" | "DEV";
  messageType: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
  content: string;
  taskId?: string | null;
  read: boolean;
  createdAt: Date;
}

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
  }

  async connect() {
    try {
      await this.prisma.$connect();
      console.log("Database connected successfully");
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async initialize(): Promise<void> {
    try {
      // Test the connection
      await this.prisma.$connect();
      console.log("Connected to database successfully");
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw error;
    }
  }

  async insertMessage(message: {
    fromAgent: string;
    toAgent: "PM" | "DEV";
    messageType: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
    content: string;
    taskId?: string;
  }): Promise<string> {
    const created = await this.prisma.message.create({
      data: {
        fromAgent: message.fromAgent,
        toAgent: message.toAgent,
        messageType: message.messageType,
        content: message.content,
        taskId: message.taskId || null,
        read: false,
      },
    });

    return created.id;
  }

  async getMessages(agentRole: "PM" | "DEV", markAsRead = true): Promise<AgentMessage[]> {
    // Get unread messages for the agent
    const messages = await this.prisma.message.findMany({
      where: {
        toAgent: agentRole,
        read: false,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Mark messages as read if requested
    if (markAsRead && messages.length > 0) {
      const messageIds = messages.map((m) => m.id);
      await this.prisma.message.updateMany({
        where: {
          id: {
            in: messageIds,
          },
        },
        data: {
          read: true,
        },
      });
    }

    // Transform to our interface
    return messages.map((msg) => ({
      id: msg.id,
      fromAgent: msg.fromAgent,
      toAgent: msg.toAgent as "PM" | "DEV",
      messageType: msg.messageType as AgentMessage["messageType"],
      content: msg.content,
      taskId: msg.taskId,
      read: msg.read,
      createdAt: msg.createdAt,
    }));
  }

  async getAllMessages(): Promise<AgentMessage[]> {
    const messages = await this.prisma.message.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return messages.map((msg) => ({
      id: msg.id,
      fromAgent: msg.fromAgent,
      toAgent: msg.toAgent as "PM" | "DEV",
      messageType: msg.messageType as AgentMessage["messageType"],
      content: msg.content,
      taskId: msg.taskId,
      read: msg.read,
      createdAt: msg.createdAt,
    }));
  }

  async createProject(data: { name: string; description?: string; requirements?: string }) {
    return await this.prisma.project.create({
      data,
    });
  }

  async createTask(data: {
    projectId: string;
    title: string;
    description?: string;
    acceptanceCriteria?: string;
    assignedTo?: string;
    dependencies?: string[];
    filesToModify?: string[];
    estimatedLines?: number;
  }) {
    return await this.prisma.task.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        acceptanceCriteria: data.acceptanceCriteria,
        assignedTo: data.assignedTo || "DEV",
        dependencies: data.dependencies ? JSON.stringify(data.dependencies) : null,
        filesToModify: data.filesToModify ? JSON.stringify(data.filesToModify) : null,
        estimatedLines: data.estimatedLines,
      },
    });
  }

  async updateTaskStatus(taskId: string, status: string, completedAt?: Date) {
    return await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt,
        startedAt: status === "in_progress" && !completedAt ? new Date() : undefined,
      },
    });
  }

  async getProjectWithTasks(projectId: string) {
    return await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  isReady(): boolean {
    // Prisma doesn't have a simple ready check, but we can assume it's ready after initialization
    return true;
  }
}
