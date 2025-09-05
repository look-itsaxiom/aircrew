#!/usr/bin/env node

/**
 * Aircrew AI Coding Demo
 *
 * This script demonstrates how agents can use the AI coding assistant
 * through the MCP protocol for collaborative development.
 */

import fetch from "node-fetch";

const MCP_SERVER_URL = "http://localhost:3001";

// Simulate MCP tool call
async function callMCPTool(toolName, params) {
  try {
    const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": "demo-session-001",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: params,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("MCP Tool Error:", error);
    return null;
  }
}

// Demo scenarios
async function runAICodeGenDemo() {
  console.log("🤖 Aircrew AI Coding Assistant Demo\n");

  // 1. PM Agent asks for code generation
  console.log('📋 PM Agent: "We need a TypeScript service for user authentication"');
  const generateResult = await callMCPTool("ai_coding_assistant", {
    task: "generate",
    language: "typescript",
    context: "Create a user authentication service with login, register, and JWT token validation",
    requirements: "Use bcrypt for password hashing and jsonwebtoken for JWT handling",
  });

  if (generateResult?.result?.content?.[0]?.text) {
    console.log("\n🤖 AI Assistant Response:");
    console.log(generateResult.result.content[0].text);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // 2. DEV Agent asks for code review
  console.log('👨‍💻 DEV Agent: "Please review this authentication code"');
  const reviewResult = await callMCPTool("ai_coding_assistant", {
    task: "review",
    language: "typescript",
    context: "Review the authentication service code for security and best practices",
  });

  if (reviewResult?.result?.content?.[0]?.text) {
    console.log("\n🤖 AI Assistant Response:");
    console.log(reviewResult.result.content[0].text);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // 3. Generate tests
  console.log('🧪 Agent: "Generate unit tests for the authentication service"');
  const testResult = await callMCPTool("ai_coding_assistant", {
    task: "test",
    language: "typescript",
    context: "Create comprehensive unit tests for the authentication service including login, register, and token validation",
  });

  if (testResult?.result?.content?.[0]?.text) {
    console.log("\n🤖 AI Assistant Response:");
    console.log(testResult.result.content[0].text);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  // 4. Test basic communication
  console.log("📡 Testing basic connectivity...");
  const pingResult = await callMCPTool("ping", { message: "Aircrew system check" });

  if (pingResult?.result?.content?.[0]?.text) {
    console.log("\n✅ Connectivity Test:");
    console.log(pingResult.result.content[0].text);
  }

  console.log("\n🎉 Demo complete! Aircrew AI agent collaboration is working!");
}

// Run the demo
runAICodeGenDemo().catch(console.error);
