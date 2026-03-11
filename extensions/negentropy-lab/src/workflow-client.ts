import type {
  WorkflowEventPayload,
  WorkflowListResponse,
  WorkflowRunResponse,
  WorkflowRunView,
  WorkflowTraceResponse,
} from "./workflow-types.js";

export type WorkflowClientConfig = {
  baseUrl: string;
  timeoutMs: number;
};

export type StartWorkflowInput = {
  workflowId: string;
  trigger?: {
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
  };
  retryOfRunId?: string;
};

export type RetryWorkflowInput = {
  runId: string;
  trigger?: {
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
  };
};

export type CancelWorkflowInput = {
  runId: string;
  reason?: string;
  emergency?: boolean;
};

export class WorkflowClient {
  constructor(
    private readonly config: WorkflowClientConfig,
    private readonly fetchImpl: typeof fetch = globalThis.fetch,
  ) {}

  async runWorkflow(input: StartWorkflowInput): Promise<WorkflowRunResponse> {
    return this.post<WorkflowRunResponse>("/run", input);
  }

  async retryWorkflow(input: RetryWorkflowInput): Promise<WorkflowRunResponse> {
    return this.post<WorkflowRunResponse>("/retry", input);
  }

  async sendEvent(payload: WorkflowEventPayload): Promise<WorkflowRunResponse> {
    return this.post<WorkflowRunResponse>("/event", payload);
  }

  async cancelWorkflow(input: CancelWorkflowInput): Promise<WorkflowRunResponse> {
    return this.post<WorkflowRunResponse>("/cancel", input);
  }

  async listRuns(params: {
    workflowId?: string;
    status?: string;
    limit?: number;
  } = {}): Promise<WorkflowListResponse> {
    const search = new URLSearchParams();
    if (params.workflowId) {
      search.set("workflowId", params.workflowId);
    }
    if (params.status) {
      search.set("status", params.status);
    }
    if (typeof params.limit === "number" && Number.isFinite(params.limit)) {
      search.set("limit", String(Math.floor(params.limit)));
    }

    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.get<WorkflowListResponse>(`${suffix}`);
  }

  async getRun(runId: string): Promise<WorkflowRunView> {
    return this.get<WorkflowRunView>(`/${encodeURIComponent(runId)}`);
  }

  async getRunTrace(runId: string): Promise<WorkflowTraceResponse> {
    return this.get<WorkflowTraceResponse>(`/${encodeURIComponent(runId)}/log`);
  }

  private async get<T>(suffix: string): Promise<T> {
    return this.request<T>("GET", suffix);
  }

  private async post<T>(suffix: string, body: unknown): Promise<T> {
    return this.request<T>("POST", suffix, body);
  }

  private async request<T>(method: "GET" | "POST", suffix: string, body?: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.config.baseUrl}${suffix}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    const raw = await response.text();
    let json: (T & { message?: string }) | undefined;

    if (raw.length > 0) {
      try {
        json = JSON.parse(raw) as T & { message?: string };
      } catch {
        if (response.ok) {
          throw new Error(`Workflow API returned non-JSON payload: ${raw.slice(0, 120)}`);
        }
      }
    }

    if (!response.ok) {
      throw new Error(json?.message || `Workflow API request failed: HTTP ${response.status}`);
    }

    if (json === undefined) {
      throw new Error("Workflow API returned empty payload.");
    }

    return json;
  }
}

export function createWorkflowClient(
  config: WorkflowClientConfig,
  fetchImpl?: typeof fetch,
): WorkflowClient {
  return new WorkflowClient(config, fetchImpl);
}
