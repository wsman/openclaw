/**
 * @constitution
 * §101 同步公理: 协作总线实现与真理源文档保持同步
 * §110 协作效率公理: 协作总线需保持消息流转高效
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename CollaborationBus.ts
 * @version 1.0.0
 * @category choreography
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import {
  AgentEnvelope,
  AuthorityEventRecord,
  DirectMessageInput,
  TopicPublicationInput,
  TopicSubscriptionInput,
} from "../authority/types";

interface StoredSubscription {
  subscriptionId: string;
  topic: string;
  agentId: string;
  requiredCapabilities: string[];
  createdAt: number;
}

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export class CollaborationBus {
  constructor(
    private readonly state: AuthorityState,
    private readonly mutationPipeline: MutationPipeline,
    private readonly eventStore: EventStore,
  ) {}

  subscribe(input: TopicSubscriptionInput, proposer = input.agentId): StoredSubscription {
    this.ensureAgentAvailable(input.agentId);
    if (!input.topic?.trim()) {
      throw new Error("subscription topic is required");
    }

    const subscription: StoredSubscription = {
      subscriptionId: createId("sub"),
      topic: input.topic,
      agentId: input.agentId,
      requiredCapabilities: input.requiredCapabilities || [],
      createdAt: Date.now(),
    };

    this.writeCollaboration(
      proposer,
      `collaboration.subscriptions.${subscription.subscriptionId}`,
      JSON.stringify(subscription),
      "collaboration_subscription_create",
    );
    this.upsertTopicMetadata(input.topic, { lastSubscriber: input.agentId });
    this.appendAudit("collaboration.subscription.created", {
      subscriptionId: subscription.subscriptionId,
      topic: input.topic,
      agentId: input.agentId,
    });

    return subscription;
  }

  unsubscribe(subscriptionId: string, proposer = "system"): boolean {
    if (!this.state.collaboration.subscriptions.has(subscriptionId)) {
      return false;
    }
    const raw = this.state.collaboration.subscriptions.get(subscriptionId)!;
    const subscription = JSON.parse(raw) as StoredSubscription;

    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `collaboration.subscriptions.${subscriptionId}`,
      operation: "remove",
      reason: "collaboration_subscription_remove",
    });
    if (!result.ok) {
      throw new Error(result.error || "failed to remove collaboration subscription");
    }

    this.upsertTopicMetadata(subscription.topic, { lastUnsubscribeAt: Date.now() });
    this.appendAudit("collaboration.subscription.removed", {
      subscriptionId,
      topic: subscription.topic,
      agentId: subscription.agentId,
    });

    return true;
  }

  publish(input: TopicPublicationInput): { envelope: AgentEnvelope; recipients: string[] } {
    if (!input.topic?.trim()) {
      throw new Error("publication topic is required");
    }
    this.ensureAgentAvailable(input.from, true);

    const subscriptions = this.listSubscriptions()
      .filter((subscription) => subscription.topic === input.topic)
      .filter((subscription) => this.matchesCapabilities(subscription.agentId, input.requiredCapabilities || []))
      .filter((subscription) => this.matchesCapabilities(subscription.agentId, subscription.requiredCapabilities));

    const recipients = [...new Set(subscriptions.map((subscription) => subscription.agentId))];
    const envelope: AgentEnvelope = {
      envelopeId: createId("env"),
      traceId: input.traceId || createId("trace"),
      kind: "topic",
      from: input.from,
      topic: input.topic,
      requiredCapabilities: input.requiredCapabilities || [],
      payload: input.payload,
      timestamp: Date.now(),
    };

    this.writeCollaboration(
      input.from,
      `collaboration.lastMessages.${this.encodeKey(input.topic)}`,
      JSON.stringify({ envelope, recipients }),
      "collaboration_message_publish",
    );
    this.upsertTopicMetadata(input.topic, {
      lastEnvelopeId: envelope.envelopeId,
      lastPublishedAt: envelope.timestamp,
      recipients: recipients.length,
    });
    this.appendAudit("collaboration.message.published", {
      topic: input.topic,
      from: input.from,
      recipients,
      envelopeId: envelope.envelopeId,
    });

    return { envelope, recipients };
  }

  sendDirect(input: DirectMessageInput): AgentEnvelope {
    this.ensureAgentAvailable(input.from, true);
    this.ensureAgentAvailable(input.to);

    const envelope: AgentEnvelope = {
      envelopeId: createId("env"),
      traceId: input.traceId || createId("trace"),
      kind: "direct",
      from: input.from,
      to: input.to,
      requiredCapabilities: [],
      payload: input.payload,
      timestamp: Date.now(),
    };

    this.writeCollaboration(
      input.from,
      `collaboration.lastMessages.${this.encodeKey(`direct:${input.to}`)}`,
      JSON.stringify(envelope),
      "collaboration_message_direct",
    );
    this.appendAudit("collaboration.message.direct", {
      from: input.from,
      to: input.to,
      envelopeId: envelope.envelopeId,
    });

    return envelope;
  }

  bridgeWorkflow(workflowId: string, topic: string, payload: unknown, proposer = "system"): { envelope: AgentEnvelope; recipients: string[] } {
    return this.publish({
      topic,
      from: `workflow:${workflowId}`,
      payload,
      traceId: `${proposer}:${workflowId}`,
    });
  }

  getSnapshot(): {
    topics: Record<string, unknown>;
    subscriptions: StoredSubscription[];
    lastMessages: Record<string, unknown>;
  } {
    return {
      topics: [...this.state.collaboration.topics.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        acc[String(parsed.topic || this.decodeKey(key))] = parsed;
        return acc;
      }, {}),
      subscriptions: this.listSubscriptions(),
      lastMessages: [...this.state.collaboration.lastMessages.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
        const parsed = JSON.parse(value) as Record<string, any>;
        const envelope = parsed.envelope || parsed;
        const resolvedKey =
          typeof envelope?.topic === "string" ? envelope.topic : this.decodeKey(key);
        acc[resolvedKey] = parsed;
        return acc;
      }, {}),
    };
  }

  private listSubscriptions(): StoredSubscription[] {
    return [...this.state.collaboration.subscriptions.values()].map((entry) => JSON.parse(entry) as StoredSubscription);
  }

  private ensureAgentAvailable(agentId: string, allowWorkflow = false): void {
    if (allowWorkflow && agentId.startsWith("workflow:")) {
      return;
    }
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      throw new Error(`agent not registered: ${agentId}`);
    }
    if (!agent.available || agent.connectionStatus !== "connected") {
      throw new Error(`agent unavailable: ${agentId}`);
    }
  }

  private matchesCapabilities(agentId: string, requiredCapabilities: string[] = []): boolean {
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      return false;
    }
    return requiredCapabilities.every((capability) => agent.capabilities.has(capability) || agent.capabilities.has("*"));
  }

  private upsertTopicMetadata(topic: string, patch: Record<string, unknown>): void {
    const current = this.state.collaboration.topics.get(this.encodeKey(topic));
    const metadata = current ? (JSON.parse(current) as Record<string, unknown>) : { topic, createdAt: Date.now() };
    const subscriptions = this.listSubscriptions().filter((entry) => entry.topic === topic).length;
    const next = {
      ...metadata,
      ...patch,
      subscriptions,
      updatedAt: Date.now(),
    };

    this.writeCollaboration(
      "system",
      `collaboration.topics.${this.encodeKey(topic)}`,
      JSON.stringify(next),
      "collaboration_topic_upsert",
    );
  }

  private writeCollaboration(proposer: string, targetPath: string, payload: string, reason: string): void {
    const result = this.mutationPipeline.propose({
      proposer,
      targetPath,
      operation: "set",
      payload,
      reason,
    });
    if (!result.ok) {
      throw new Error(result.error || `failed to write collaboration state: ${targetPath}`);
    }
  }

  private appendAudit(type: AuthorityEventRecord["type"], payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("collaboration"),
      type,
      timestamp: Date.now(),
      payload,
    });
  }

  private encodeKey(key: string): string {
    return key.replaceAll(".", "__dot__");
  }

  private decodeKey(key: string): string {
    return key.replaceAll("__dot__", ".");
  }
}
