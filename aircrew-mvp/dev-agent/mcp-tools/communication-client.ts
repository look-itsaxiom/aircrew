#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:3001";
const AGENT_ROLE = process.env.AGENT_ROLE || "DEV";

// Create MCP server for the DEV agent
const server = new McpServer({
  name: `aircrew-${AGENT_ROLE.toLowerCase()}-tools`,
  version: "1.0.0",
});

// Tool to send messages to PM
server.registerTool(
  "send_message_to_pm",
  {
    title: "Send Message to PM Agent",
    description: "Send a message to the PM agent",
    inputSchema: {
      type: z.enum(["PING", "PONG", "TASK_ASSIGNMENT", "TASK_COMPLETE", "FEEDBACK", "QUESTION"]).describe("Message type"),
      content: z.string().describe("Message content"),
      taskId: z.string().optional().describe("Task ID if related to a specific task"),
    },
  },
  async ({ type, content, taskId }) => {
    try {
      const response = await axios.post(
        `${MCP_SERVER_URL}/mcp`,
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: {
              to: "PM",
              type,
              content,
              taskId,
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Message sent to PM: ${type} - ${content}`,
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

// Tool to get messages from PM
server.registerTool(
  "get_messages",
  {
    title: "Get Messages",
    description: "Get messages sent to this agent",
    inputSchema: {
      markAsRead: z.boolean().default(true).describe("Mark messages as read after retrieving"),
    },
  },
  async ({ markAsRead }) => {
    try {
      const response = await axios.post(
        `${MCP_SERVER_URL}/mcp`,
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "get_messages",
            arguments: {
              agentRole: AGENT_ROLE,
              markAsRead,
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const messages = JSON.parse(response.data.result.content[0].text);

      if (messages.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No new messages",
            },
          ],
        };
      }

      const messageText = messages.map((msg: any) => `From: ${msg.from}\nType: ${msg.type}\nContent: ${msg.content}\nTime: ${msg.timestamp}\n---`).join("\n");

      return {
        content: [
          {
            type: "text",
            text: `Received ${messages.length} message(s):\n\n${messageText}`,
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
  "ping_pm",
  {
    title: "Ping PM Agent",
    description: "Send a ping to test connectivity with PM agent",
    inputSchema: {
      message: z.string().default("Hello from DEV!").describe("Ping message"),
    },
  },
  async ({ message }) => {
    try {
      const response = await axios.post(
        `${MCP_SERVER_URL}/mcp`,
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: {
              to: "PM",
              type: "PING",
              content: message,
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Ping sent to PM: "${message}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error pinging PM: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Auto-respond to pings with pongs
server.registerTool(
  "respond_to_ping",
  {
    title: "Respond to Ping",
    description: "Automatically respond to a ping message with a pong",
    inputSchema: {
      originalMessage: z.string().describe("The original ping message to respond to"),
    },
  },
  async ({ originalMessage }) => {
    try {
      const response = await axios.post(
        `${MCP_SERVER_URL}/mcp`,
        {
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "send_message",
            arguments: {
              to: "PM",
              type: "PONG",
              content: `Pong! Responding to: "${originalMessage}"`,
            },
          },
          id: Date.now(),
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return {
        content: [
          {
            type: "text",
            text: `Pong sent in response to: "${originalMessage}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending pong: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Connect to stdio transport
const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {
    console.error(`DEV Agent MCP tools ready (connecting to ${MCP_SERVER_URL})`);
  })
  .catch((error) => {
    console.error("Failed to start DEV agent MCP tools:", error);
    process.exit(1);
  });
