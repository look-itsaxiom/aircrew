import { DatabaseService, AgentMessage } from "./database-service.js";

export interface SendMessageParams {
  to: "PM" | "DEV";
  type: "PING" | "PONG" | "TASK_ASSIGNMENT" | "TASK_COMPLETE" | "FEEDBACK" | "QUESTION";
  content: string;
  taskId?: string;
}

export class MessageQueue {
  constructor(private database: DatabaseService) {}

  async sendMessage(params: SendMessageParams): Promise<string> {
    // For MVP, we'll derive the 'from' agent from context
    // In a real implementation, this would come from authentication
    const fromAgent = params.to === "PM" ? "DEV" : "PM";

    const messageId = await this.database.insertMessage({
      fromAgent,
      toAgent: params.to,
      messageType: params.type,
      content: params.content,
      taskId: params.taskId,
    });

    console.log(`Message sent from ${fromAgent} to ${params.to}: ${params.type}`);
    return messageId;
  }

  async getMessages(agentRole: "PM" | "DEV", markAsRead = true): Promise<AgentMessage[]> {
    const messages = await this.database.getMessages(agentRole, markAsRead);
    console.log(`Retrieved ${messages.length} messages for ${agentRole}`);
    return messages;
  }
}
