import { ClusterNodeRecord, ClusterTaskRequest, ClusterTaskResponse } from './types';

export interface ClusterTaskHandlerContext {
  localNode: ClusterNodeRecord;
  topology: ClusterNodeRecord[];
}

export type ClusterTaskHandler = (
  request: ClusterTaskRequest,
  context: ClusterTaskHandlerContext,
) => Promise<unknown> | unknown;

export class ClusterTaskDispatcher {
  private readonly handlers = new Map<string, ClusterTaskHandler>();

  constructor(
    private readonly getLocalNode: () => ClusterNodeRecord,
    private readonly getTopology: () => ClusterNodeRecord[],
  ) {
    this.registerBuiltinHandlers();
  }

  registerHandler(type: string, handler: ClusterTaskHandler): void {
    this.handlers.set(type, handler);
  }

  async execute(request: ClusterTaskRequest): Promise<ClusterTaskResponse> {
    const startedAt = Date.now();
    const handler = this.handlers.get(request.type);
    if (!handler) {
      return {
        taskId: request.taskId,
        ok: false,
        executedBy: this.getLocalNode().nodeId,
        durationMs: Date.now() - startedAt,
        error: `Unsupported task type: ${request.type}`,
      };
    }

    try {
      const result = await handler(request, {
        localNode: this.getLocalNode(),
        topology: this.getTopology(),
      });

      return {
        taskId: request.taskId,
        ok: true,
        executedBy: this.getLocalNode().nodeId,
        durationMs: Date.now() - startedAt,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        taskId: request.taskId,
        ok: false,
        executedBy: this.getLocalNode().nodeId,
        durationMs: Date.now() - startedAt,
        error: message,
      };
    }
  }

  private registerBuiltinHandlers(): void {
    this.registerHandler('echo', async (request, context) => ({
      payload: request.payload ?? null,
      nodeId: context.localNode.nodeId,
      clusterId: context.localNode.clusterId,
      receivedAt: new Date().toISOString(),
    }));

    this.registerHandler('health-check', async (_request, context) => ({
      node: context.localNode,
      topologySize: context.topology.length,
      timestamp: Date.now(),
    }));

    this.registerHandler('topology-snapshot', async (_request, context) => ({
      nodes: context.topology,
      generatedAt: Date.now(),
    }));
  }
}

