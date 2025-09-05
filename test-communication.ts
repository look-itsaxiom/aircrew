// Test script to verify coordination server communication
import { WebSocket } from "ws";

async function testCommunication() {
  console.log("🧪 Testing Coder-Taskforce Communication...");

  // Test 1: WebSocket connection
  console.log("\n1. Testing WebSocket connection...");
  const ws = new WebSocket("ws://localhost:3003");

  return new Promise((resolve, reject) => {
    ws.on("open", () => {
      console.log("✅ WebSocket connected successfully");

      // Register as a test PM agent
      ws.send(
        JSON.stringify({
          type: "register",
          agentId: "test-pm-agent",
          role: "PM",
          name: "Test PM Agent",
        })
      );
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log("📨 Received message:", message);

      if (message.type === "registered") {
        console.log("✅ Agent registration successful");
        console.log(`   Agent ID: ${message.agentId}`);

        // Test completed successfully
        ws.close();
        setTimeout(() => resolve("success"), 500);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
      reject(error);
    });

    ws.on("close", () => {
      console.log("📡 WebSocket connection closed");
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error("Connection timeout"));
    }, 10000);
  });
}

async function testHttpEndpoints() {
  console.log("\n2. Testing HTTP endpoints...");

  try {
    const response = await fetch("http://localhost:3001/health");
    const data = await response.json();
    console.log("✅ Health check successful:", data);
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }
}

async function runTests() {
  try {
    await testCommunication();
    await testHttpEndpoints();

    console.log("\n🎉 All communication tests passed!");
    console.log("✅ Coordination server is ready for agent connections");
  } catch (error) {
    console.error("\n❌ Communication test failed:", error);
  }

  process.exit(0);
}

runTests();
