#!/usr/bin/env node

/**
 * Simple MCP Test
 * Test the basic MCP protocol communication
 */

import fetch from "node-fetch";

async function testMCP() {
  console.log("🔍 Testing MCP Server...\n");

  // Test health endpoint first
  try {
    const healthResponse = await fetch("http://localhost:3001/health");
    const healthData = await healthResponse.json();
    console.log("✅ Health Check:", healthData);
  } catch (error) {
    console.error("❌ Health Check Failed:", error.message);
    return;
  }

  // Test MCP endpoint structure
  try {
    console.log("\n🔌 Testing MCP endpoint...");
    const mcpResponse = await fetch("http://localhost:3001/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
        },
      }),
    });

    console.log("Response Status:", mcpResponse.status);
    console.log("Response Headers:", Object.fromEntries(mcpResponse.headers));

    if (mcpResponse.ok) {
      const mcpData = await mcpResponse.json();
      console.log("✅ MCP Response:", JSON.stringify(mcpData, null, 2));
    } else {
      const errorText = await mcpResponse.text();
      console.log("❌ MCP Error Response:", errorText);
    }
  } catch (error) {
    console.error("❌ MCP Test Failed:", error.message);
  }
}

testMCP().catch(console.error);
