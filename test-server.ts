// Simple test to verify our coordination server is working
import { WebSocket } from "ws";

async function testCoordinationServer() {
  console.log("🧪 Testing Coder-Taskforce Coordination Server...");

  try {
    // Test HTTP health endpoint
    console.log("📊 Testing HTTP health endpoint...");
    const response = await fetch("http://localhost:3001/health");
    const health = await response.json();
    console.log("✅ Health check:", health);

    // Test WebSocket connection
    console.log("🔌 Testing WebSocket connection...");
    const ws = new WebSocket("ws://localhost:3003");

    ws.on("open", () => {
      console.log("✅ WebSocket connected");

      // Test agent registration
      const registrationMessage = {
        type: "register",
        agentId: "test-agent-001",
        agentType: "TEST",
        capabilities: ["testing", "communication"],
      };

      console.log("📝 Registering test agent...");
      ws.send(JSON.stringify(registrationMessage));
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      console.log("📥 Received message:", message);

      if (message.type === "registered") {
        console.log("✅ Agent registration successful!");
        ws.close();
      }
    });

    ws.on("close", () => {
      console.log("🔌 WebSocket connection closed");
      console.log("🎉 Test completed successfully!");
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
    });
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testCoordinationServer();
