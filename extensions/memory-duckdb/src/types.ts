import type { MemoryControlPlaneAlignmentStatus } from "./capability/smallpond/ControlPlaneAlignment.js";
import type {
  MemorySkillCandidatePipelineStatus,
  MemorySkillCandidateSyncResult,
  MemorySkillCandidateSyncTrigger,
} from "./capability/smallpond/SkillCandidateTypes.js";
import type { DuckDbNativeBindingStatus } from "./diagnostics/DuckDbNativeBinding.js";
import type { IngestCheckpoint, JsonlIngestSpoolDiagnostics } from "./ingest/types.js";

export const MEMORY_DUCKDB_RUNTIME_MODES = ["canonical", "shadow-read"] as const;

export type MemoryDuckdbRuntimeMode = (typeof MEMORY_DUCKDB_RUNTIME_MODES)[number];

export type MemoryDuckdbConfig = {
  storagePath: string;
  duckdbPath: string;
  runtimeMode: MemoryDuckdbRuntimeMode;
  native: {
    required: boolean;
  };
  ingest: {
    maxActiveBytes: number;
  };
  replay: {
    batchSize: number;
  };
  shadow: {
    maxCheckpointAgeSeconds: number;
    requireParityZeroMismatch: boolean;
  };
  diagnostics: {
    enableHttpRoutes: boolean;
  };
};

export type MemoryRecord = {
  id: string;
  text: string;
  normalizedText: string;
  tags: string[];
  source: string;
  dedupKey: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  ingestSequence: number;
};

export type MemoryWriteRequest = {
  text: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type MemoryStoreResult = {
  record: MemoryRecord;
  duplicate: boolean;
  ingestId: string;
  idempotencyKey: string;
  shadowCompared: boolean;
  shadowParityState: ShadowParityState;
};

export type MemorySearchResult = {
  record: MemoryRecord;
  score: number;
  reason: string;
};

export type ShadowParityState = "ok" | "mismatch" | "pending";

export type ShadowReplayResult = {
  appliedCount: number;
  parityState: ShadowParityState;
  mismatchCount: number;
  checkpointAdvanced: boolean;
  checkpoint: IngestCheckpoint | null;
};

export const MEMORY_BUSINESS_SYNC_STATES = [
  "idle",
  "syncing",
  "ok",
  "degraded",
  "disabled",
] as const;

export type MemoryBusinessSyncState = (typeof MEMORY_BUSINESS_SYNC_STATES)[number];

export type MemoryBusinessSyncTrigger = "startup" | "manual";

export type MemoryBusinessSyncStatus = {
  state: MemoryBusinessSyncState;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastArtifactId: string | null;
  lastArtifactType: string | null;
  syncedArtifactCount: number;
  skippedArtifactCount: number;
  failedArtifactCount: number;
  lagSeconds: number | null;
  lastError: string | null;
};

export type MemoryBusinessSyncResult = {
  trigger: MemoryBusinessSyncTrigger;
  state: MemoryBusinessSyncState;
  syncedArtifactCount: number;
  skippedArtifactCount: number;
  failedArtifactCount: number;
  lastArtifactId: string | null;
  lastArtifactType: string | null;
  lagSeconds: number | null;
  lastError: string | null;
};

export type MemoryRuntimeStatus = {
  pluginId: "memory-duckdb";
  slotOwnerCandidate: true;
  runtimeMode: MemoryDuckdbRuntimeMode;
  storagePath: string;
  duckdbPath: string;
  native: DuckDbNativeBindingStatus;
  ingest: {
    spool: JsonlIngestSpoolDiagnostics;
    canonicalRecordCount: number;
  };
  shadow: {
    parityState: ShadowParityState;
    mismatchCount: number;
    checkpoint: IngestCheckpoint | null;
    checkpointAgeSeconds: number | null;
    checkpointStale: boolean;
  };
  readFacade: {
    sqlGuard: "select-only";
    nativeAvailable: boolean;
  };
  reflection: {
    summary: string;
    recentTagCounts: Record<string, number>;
  };
  governance: {
    flaggedCount: number;
    flaggedIds: string[];
  };
  businessSync: MemoryBusinessSyncStatus;
  skillCandidates: MemorySkillCandidatePipelineStatus;
  controlPlaneAlignment: MemoryControlPlaneAlignmentStatus;
};

export type {
  MemoryControlPlaneAlignmentStatus,
  MemorySkillCandidatePipelineStatus,
  MemorySkillCandidateSyncResult,
  MemorySkillCandidateSyncTrigger,
};
