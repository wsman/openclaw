import { Client, Room } from "colyseus";
import { AuthorityState } from "../schema/AuthorityState";
import { bindAuthorityRoom, getAuthorityRuntime } from "../runtime/authorityRuntime";
import { activeRooms } from "../runtime/activeRooms";
import { logger } from "../utils/logger";

export class AuthorityRoom extends Room<AuthorityState> {
  onCreate(_options: unknown): void {
    const runtime = bindAuthorityRoom(this.roomId);
    this.setState(runtime.state);
    this.setPatchRate(1000);
    this.setSimulationInterval(() => this.updateAuthorityState(), 1000);
    this.setupMessageHandlers();
    activeRooms.add(this);
    logger.info(`[AuthorityRoom] Authority room ready ${this.roomId}`);
  }

  private setupMessageHandlers(): void {
    this.onMessage("propose_mutation", (client, message) => {
      const runtime = getAuthorityRuntime();
      const result = runtime.mutationPipeline.propose({
        proposer: client.sessionId,
        targetPath: String(message?.targetPath || ""),
        operation: message?.operation || "set",
        payload: message?.payload,
        requiredCapabilities: Array.isArray(message?.requiredCapabilities) ? message.requiredCapabilities : [],
        riskLevel: message?.riskLevel || "low",
        expectedDeltaEntropy: Number(message?.expectedDeltaEntropy || 0),
        reason: String(message?.reason || "authority_room_request"),
        traceId: typeof message?.traceId === "string" ? message.traceId : undefined,
      });
      client.send("mutation_result", result);
    });

    this.onMessage("query_state", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("authority_state", {
        state: runtime.state,
        timestamp: Date.now(),
      });
    });

    this.onMessage("query_projection", (client, message) => {
      const runtime = getAuthorityRuntime();
      const roomType = String(message?.roomType || "control");
      let projection: unknown;
      switch (roomType) {
        case "agent":
          projection = runtime.projectionService.getAgentRoomProjection();
          break;
        case "task":
          projection = runtime.projectionService.getTaskRoomProjection();
          break;
        default:
          projection = runtime.projectionService.getControlRoomProjection();
          break;
      }
      client.send("projection_result", {
        roomType,
        projection,
        timestamp: Date.now(),
      });
    });

    this.onMessage("register_agent", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const session = runtime.agentSessionRegistry.registerSession(
          {
            agentId: String(message?.agentId || client.sessionId),
            name: String(message?.name || message?.agentId || client.sessionId),
            department: String(message?.department || "OFFICE"),
            role: String(message?.role || "worker"),
            model: String(message?.model || ""),
            provider: String(message?.provider || ""),
            capabilities: Array.isArray(message?.capabilities) ? message.capabilities : Object.keys(message?.capabilities || {}),
            trustLevel: Number(message?.trustLevel || 0.5),
            lane: String(message?.lane || "default"),
            sessionId: client.sessionId,
            capacity: Number(message?.capacity || 1),
            metadata: {
              roomId: this.roomId,
            },
          },
          client.sessionId,
        );
        client.send("agent_registered", {
          ok: true,
          session,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("agent_registered", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("heartbeat", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const session = runtime.agentSessionRegistry.heartbeat(
          {
            agentId: String(message?.agentId || client.sessionId),
            sessionId: client.sessionId,
            load: Number(message?.load ?? 0),
            pendingTasks: Number(message?.pendingTasks ?? 0),
            healthStatus: message?.healthStatus || "healthy",
          },
          client.sessionId,
        );
        client.send("heartbeat_ack", {
          ok: true,
          session,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("heartbeat_ack", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("unregister_agent", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const session = runtime.agentSessionRegistry.unregisterSession(
          String(message?.agentId || client.sessionId),
          client.sessionId,
          String(message?.reason || "manual"),
        );
        client.send("agent_unregistered", {
          ok: true,
          session,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("agent_unregistered", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("query_sessions", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("sessions_result", {
        sessions: runtime.agentSessionRegistry.listSessions(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("select_agent", (client, message) => {
      const runtime = getAuthorityRuntime();
      const selected = runtime.agentSessionRegistry.selectAgent(
        Array.isArray(message?.requiredCapabilities) ? message.requiredCapabilities : [],
        typeof message?.department === "string" ? message.department : undefined,
      );
      client.send("agent_selected", {
        selected,
        timestamp: Date.now(),
      });
    });

    this.onMessage("register_tool", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        runtime.toolCallBridge.registerToolDefinition(
          {
            toolName: String(message?.toolName || ""),
            source: String(message?.source || "builtin"),
            category: typeof message?.category === "string" ? message.category : undefined,
            allowedDepartments: Array.isArray(message?.allowedDepartments) ? message.allowedDepartments : ["*"],
            requiredCapabilities: Array.isArray(message?.requiredCapabilities) ? message.requiredCapabilities : [],
            quotaKey: typeof message?.quotaKey === "string" ? message.quotaKey : undefined,
            metadata: message?.metadata || {},
          },
          async (args) => ({ accepted: true, echo: args }),
        );
        client.send("tool_registered", {
          ok: true,
          tool: runtime.toolCallBridge.getToolDefinition(String(message?.toolName || "")),
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("tool_registered", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("query_tools", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("tools_result", {
        tools: runtime.toolCallBridge.getToolCatalog(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("call_tool", async (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const result = await runtime.toolCallBridge.callToolWithContext({
          toolName: String(message?.toolName || ""),
          args: message?.args,
          agentId: String(message?.agentId || client.sessionId),
          sessionId: client.sessionId,
        });
        client.send("tool_result", {
          ok: true,
          result,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("tool_result", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("query_governance", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("governance_result", {
        proposals: runtime.conflictResolver.list(),
        entropy: runtime.entropyEngine.getReport(),
        breaker: runtime.breakerService.evaluate(runtime.entropyEngine.getReport().forecastGlobal),
        timestamp: Date.now(),
      });
    });

    this.onMessage("propose_conflict", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const proposal = runtime.conflictResolver.createProposal({
          title: String(message?.title || ""),
          proposer: String(message?.proposer || client.sessionId),
          department: typeof message?.department === "string" ? message.department : undefined,
          type: typeof message?.type === "string" ? message.type : undefined,
          options: Array.isArray(message?.options) ? message.options : [],
          rationale: typeof message?.rationale === "string" ? message.rationale : undefined,
          metadata: message?.metadata || {},
        });
        client.send("conflict_proposed", {
          ok: true,
          proposal,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("conflict_proposed", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("vote_conflict", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const proposal = runtime.conflictResolver.vote({
          proposalId: String(message?.proposalId || ""),
          voterAgentId: String(message?.voterAgentId || client.sessionId),
          option: String(message?.option || ""),
          rationale: typeof message?.rationale === "string" ? message.rationale : undefined,
        });
        client.send("conflict_voted", {
          ok: true,
          proposal,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("conflict_voted", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("resolve_conflict", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const proposal = runtime.conflictResolver.resolve(
          String(message?.proposalId || ""),
          String(message?.decider || client.sessionId),
        );
        client.send("conflict_resolved", {
          ok: true,
          proposal,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("conflict_resolved", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("run_morning_brief", (client) => {
      const runtime = getAuthorityRuntime();
      const brief = runtime.pilotWorkflowService.runMorningBrief(client.sessionId);
      client.send("morning_brief_result", {
        ok: true,
        brief,
        timestamp: Date.now(),
      });
    });

    this.onMessage("run_entropy_drill", (client) => {
      const runtime = getAuthorityRuntime();
      const drill = runtime.pilotWorkflowService.runEntropyDrill(client.sessionId);
      client.send("entropy_drill_result", {
        ok: true,
        drill,
        timestamp: Date.now(),
      });
    });

    this.onMessage("subscribe_topic", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const subscription = runtime.collaborationBus.subscribe(
          {
            topic: String(message?.topic || ""),
            agentId: String(message?.agentId || client.sessionId),
            requiredCapabilities: Array.isArray(message?.requiredCapabilities) ? message.requiredCapabilities : [],
          },
          client.sessionId,
        );
        client.send("subscription_result", {
          ok: true,
          subscription,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("subscription_result", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("publish_topic", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const publication = runtime.collaborationBus.publish({
          topic: String(message?.topic || ""),
          from: String(message?.from || client.sessionId),
          payload: message?.payload,
          requiredCapabilities: Array.isArray(message?.requiredCapabilities) ? message.requiredCapabilities : [],
          traceId: typeof message?.traceId === "string" ? message.traceId : undefined,
        });
        client.send("publication_result", {
          ok: true,
          ...publication,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("publication_result", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("send_direct", (client, message) => {
      try {
        const runtime = getAuthorityRuntime();
        const envelope = runtime.collaborationBus.sendDirect({
          from: String(message?.from || client.sessionId),
          to: String(message?.to || ""),
          payload: message?.payload,
          traceId: typeof message?.traceId === "string" ? message.traceId : undefined,
        });
        client.send("direct_result", {
          ok: true,
          envelope,
          timestamp: Date.now(),
        });
      } catch (error: any) {
        client.send("direct_result", {
          ok: false,
          error: error.message,
          timestamp: Date.now(),
        });
      }
    });

    this.onMessage("query_collaboration", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("collaboration_result", {
        ...runtime.collaborationBus.getSnapshot(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("query_replication", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("replication_result", {
        ...runtime.replicationService.getStatus(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("query_monitoring", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("monitoring_result", {
        ...runtime.monitoringService.getSnapshot(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("snapshot_replication", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("replication_snapshot_result", {
        ok: true,
        snapshot: runtime.replicationService.snapshot(),
        timestamp: Date.now(),
      });
    });

    this.onMessage("recover_replication", (client) => {
      const runtime = getAuthorityRuntime();
      client.send("replication_recover_result", {
        ok: true,
        recovery: runtime.replicationService.recover(),
        timestamp: Date.now(),
      });
    });
  }

  private updateAuthorityState(): void {
    const runtime = getAuthorityRuntime();
    runtime.state.system.systemTime = Date.now();
    runtime.agentSessionRegistry.cleanupExpiredSessions("system");
    runtime.entropyEngine.recalculate();
    runtime.breakerService.evaluate(runtime.entropyEngine.getReport().forecastGlobal);
    runtime.replicationService.maintain();
    runtime.state.lastUpdate = Date.now();
  }

  onJoin(client: Client): void {
    logger.info(`[AuthorityRoom] Client ${client.sessionId} joined`);
    client.send("authority_ready", {
      roomId: this.roomId,
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client): void {
    logger.info(`[AuthorityRoom] Client ${client.sessionId} left`);
  }

  onDispose(): void {
    activeRooms.delete(this);
    logger.info(`[AuthorityRoom] Disposing authority room ${this.roomId}`);
  }
}

export default AuthorityRoom;
