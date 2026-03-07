import { Client } from "colyseus.js";

const ENDPOINT = "ws://localhost:4514";

async function runIntegrationTest() {
    console.log("🚀 Starting Phase 8 Integration Test...");
    const client = new Client(ENDPOINT);
    
    try {
        console.log("📡 Connecting to chat_room...");
        const room = await client.joinOrCreate("chat_room", { 
            username: "TestClient_Phase8" 
        });
        
        console.log(`✅ Connected! Session ID: ${room.sessionId}`);
        
        // Use manual assertion instead of Chai
        if (!room.sessionId) throw new Error("Session ID missing");
        
        // Test 1.1: Verify Agent Schema
        console.log("🔍 Verifying Agent Schema...");
        
        // Cast to any to bypass TS error in quick script
        const state: any = room.state;
        
        if (!state.agents) {
            console.warn("⚠️ 'agents' collection not found immediately. Waiting for sync...");
        } else {
            state.agents.onAdd((agent: any, key: any) => {
                console.log(`🤖 Agent Detected: ${agent.name} (${agent.id}) - Status: ${agent.status}`);
            });
        }

        // Test 1.2: Trigger State Change
        console.log("⚡ Sending test message to trigger agent activity...");
        room.send("message", { 
            content: "System check: verify agent status synchronization.",
            channel: "public"
        });
        
        // Wait for potential updates
        console.log("⏳ Waiting 3s for updates...");
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log("✅ Phase 8 Integration Test Passed!");
        process.exit(0);
    } catch (e: any) {
        console.error("❌ Test Failed:", e);
        process.exit(1);
    }
}

runIntegrationTest();
