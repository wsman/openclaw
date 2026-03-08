import { Request, Response, Router } from "express";
import {
  type CancelRunRequest,
  createOrchestrationService,
  type ListRunsRequest,
  type OrchestrationService,
  type ReconcileRunsRequest,
  type RetryWorkflowRequest,
  type StartWorkflowRequest,
  type WorkflowRuntimeEvent,
} from "../service/orchestration-service";

function parseListRunsQuery(query: Request["query"]): ListRunsRequest {
  return {
    workflowId: typeof query.workflowId === "string" ? query.workflowId : undefined,
    status: typeof query.status === "string" ? (query.status as ListRunsRequest["status"]) : undefined,
    limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
  };
}

export function createWorkflowInternalApiRouter(
  service: OrchestrationService = createOrchestrationService(),
): Router {
  const router = Router();

  router.post("/workflows/run", (req: Request, res: Response) => {
    try {
      const request = (req.body ?? {}) as StartWorkflowRequest;
      const result = service.startWorkflow(request);
      if (result.ignored) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ ignored: true, actions: [], message });
    }
  });

  router.post("/workflows/retry", (req: Request, res: Response) => {
    try {
      const request = (req.body ?? {}) as RetryWorkflowRequest;
      const result = service.retryWorkflow(request);
      if (result.ignored) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ ignored: true, actions: [], message });
    }
  });

  router.post("/workflows/reconcile", (req: Request, res: Response) => {
    try {
      const request = (req.body ?? {}) as ReconcileRunsRequest;
      const result = service.reconcileRuns(request);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ ok: false, scanned: 0, updated: 0, deletedTerminalRuns: 0, touchedRunIds: [], message });
    }
  });

  router.post("/workflows/event", (req: Request, res: Response) => {
    try {
      const event = (req.body ?? {}) as WorkflowRuntimeEvent;
      const result = service.handleEvent(event);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ ignored: true, actions: [], message });
    }
  });

  router.post("/workflows/cancel", (req: Request, res: Response) => {
    try {
      const request = (req.body ?? {}) as CancelRunRequest;
      const result = service.cancelRun(request);
      if (result.ignored) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ ignored: true, actions: [], message });
    }
  });

  router.get("/workflows", (req: Request, res: Response) => {
    try {
      const listQuery = parseListRunsQuery(req.query);
      const runs = service.listRuns(listQuery);
      res.json({ runs, total: runs.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ runs: [], total: 0, message });
    }
  });

  router.get("/workflows/:id", (req: Request, res: Response) => {
    try {
      const run = service.getRun(req.params.id);
      if (!run) {
        res.status(404).json({ message: `run not found: ${req.params.id}` });
        return;
      }
      res.json(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ message });
    }
  });

  router.get("/workflows/:id/log", (req: Request, res: Response) => {
    try {
      const trace = service.getRunTrace(req.params.id);
      res.json({ runId: req.params.id, trace, total: trace.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      res.status(500).json({ runId: req.params.id, trace: [], total: 0, message });
    }
  });

  return router;
}
