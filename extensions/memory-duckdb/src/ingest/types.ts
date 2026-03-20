export const INGEST_SCHEMA_VERSION = "e1";
export const SHADOW_CHECKPOINT_BACKEND = "memory-duckdb-shadow";

export type IngestSpoolRecord<TPayload = Record<string, unknown>> = {
  sequence: number;
  ingestId: string;
  idempotencyKey: string;
  sourceEventId: string;
  pipeline: string;
  action: string;
  entityKind: string;
  entityId: string;
  scope: string;
  payload: TPayload;
  createdAt: string;
  schemaVersion: string;
  parentIngestId?: string;
  supersedes?: string;
  correlationId?: string;
};

export type IngestCheckpoint = {
  backend: string;
  sequence: number;
  ingestId: string;
  updatedAt: string;
  state: "applied" | "compared";
  details?: Record<string, unknown>;
};

export type JsonlIngestSpoolDiagnostics = {
  rootDir: string;
  checkpointsDir: string;
  segmentCount: number;
  activeSegmentBytes: number;
  activeSegmentStartSequence: number | null;
  lastSequence: number;
};
