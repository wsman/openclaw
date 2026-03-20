import type {
  MemoryBusinessSyncResult,
  MemoryBusinessSyncStatus,
  MemoryBusinessSyncTrigger,
  MemoryDuckdbRuntimeMode,
} from "../../types.js";
import type { SmallpondClient, SmallpondClientReadFailure } from "./SmallpondClient.js";
import { buildSmallpondReadDiagnostics } from "./SmallpondDiagnostics.js";
import type { SmallpondMaterializationInput } from "./SmallpondMaterialization.js";

export type BusinessKnowledgeMaterializeAction = "created" | "updated" | "duplicate" | "stale";

export type BusinessKnowledgeMaterializeResult = {
  action: BusinessKnowledgeMaterializeAction;
  artifactId: string;
  artifactType: string;
  sourceTimestamp: string;
};

type BusinessKnowledgeSyncServiceOptions = {
  client: SmallpondClient;
  getRuntimeMode: () => MemoryDuckdbRuntimeMode;
  materialize: (
    artifact: SmallpondMaterializationInput,
  ) => Promise<BusinessKnowledgeMaterializeResult>;
  now?: () => Date;
};

function createInitialStatus(): MemoryBusinessSyncStatus {
  return {
    state: "idle",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastArtifactId: null,
    lastArtifactType: null,
    syncedArtifactCount: 0,
    skippedArtifactCount: 0,
    failedArtifactCount: 0,
    lagSeconds: null,
    lastError: null,
  };
}

function joinFailureMessages(failures: SmallpondClientReadFailure[]): string | null {
  if (failures.length === 0) {
    return null;
  }
  return failures.map((failure) => `${failure.sourceView}: ${failure.errorMessage}`).join("; ");
}

function computeLagSeconds(sourceTimestamp: string | null, now: Date): number | null {
  if (!sourceTimestamp) {
    return null;
  }
  const parsed = Date.parse(sourceTimestamp);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor((now.getTime() - parsed) / 1000));
}

export class BusinessKnowledgeSyncService {
  readonly #client: SmallpondClient;
  readonly #getRuntimeMode: () => MemoryDuckdbRuntimeMode;
  readonly #materialize: (
    artifact: SmallpondMaterializationInput,
  ) => Promise<BusinessKnowledgeMaterializeResult>;
  readonly #now: () => Date;
  #status: MemoryBusinessSyncStatus = createInitialStatus();
  #latestSourceTimestamp: string | null = null;

  constructor(options: BusinessKnowledgeSyncServiceOptions) {
    this.#client = options.client;
    this.#getRuntimeMode = options.getRuntimeMode;
    this.#materialize = options.materialize;
    this.#now = options.now ?? (() => new Date());
  }

  getStatus(): MemoryBusinessSyncStatus {
    return { ...this.#status };
  }

  async sync(trigger: MemoryBusinessSyncTrigger): Promise<MemoryBusinessSyncResult> {
    const attemptedAt = this.#now();
    if (this.#getRuntimeMode() !== "canonical") {
      this.#status = {
        ...this.#status,
        state: "disabled",
        lastAttemptAt: attemptedAt.toISOString(),
        lastError: null,
      };
      return {
        trigger,
        state: "disabled",
        syncedArtifactCount: 0,
        skippedArtifactCount: 0,
        failedArtifactCount: 0,
        lastArtifactId: this.#status.lastArtifactId,
        lastArtifactType: this.#status.lastArtifactType,
        lagSeconds: this.#status.lagSeconds,
        lastError: null,
      };
    }

    this.#status = {
      ...this.#status,
      state: "syncing",
      lastAttemptAt: attemptedAt.toISOString(),
      lastError: null,
    };

    const readResult = await this.#client.readMaterializationInputs();
    let syncedArtifactCount = 0;
    let skippedArtifactCount = 0;
    let failedArtifactCount = readResult.failures.length;
    let lastArtifactId = this.#status.lastArtifactId;
    let lastArtifactType = this.#status.lastArtifactType;
    const failureMessages = [...readResult.failures];

    for (const artifact of readResult.artifacts) {
      try {
        const result = await this.#materialize(artifact);
        lastArtifactId = result.artifactId;
        lastArtifactType = result.artifactType;
        if (
          !this.#latestSourceTimestamp ||
          Date.parse(result.sourceTimestamp) > Date.parse(this.#latestSourceTimestamp)
        ) {
          this.#latestSourceTimestamp = result.sourceTimestamp;
        }
        if (result.action === "duplicate" || result.action === "stale") {
          skippedArtifactCount += 1;
        } else {
          syncedArtifactCount += 1;
        }
      } catch (error) {
        failedArtifactCount += 1;
        failureMessages.push({
          sourceView: artifact.readArtifact.sourceView,
          errorMessage: error instanceof Error ? error.message : String(error),
          diagnostics: buildSmallpondReadDiagnostics({
            sourceView: artifact.readArtifact.sourceView,
            error,
          }),
        });
      }
    }

    const completedAt = this.#now();
    const lastError = joinFailureMessages(failureMessages);
    const state = failedArtifactCount > 0 ? "degraded" : "ok";
    const lastSuccessAt =
      failedArtifactCount === readResult.artifacts.length + readResult.failures.length &&
      syncedArtifactCount === 0 &&
      skippedArtifactCount === 0
        ? this.#status.lastSuccessAt
        : completedAt.toISOString();

    this.#status = {
      state,
      lastAttemptAt: attemptedAt.toISOString(),
      lastSuccessAt,
      lastArtifactId,
      lastArtifactType,
      syncedArtifactCount: this.#status.syncedArtifactCount + syncedArtifactCount,
      skippedArtifactCount: this.#status.skippedArtifactCount + skippedArtifactCount,
      failedArtifactCount: this.#status.failedArtifactCount + failedArtifactCount,
      lagSeconds: computeLagSeconds(this.#latestSourceTimestamp, completedAt),
      lastError,
    };

    return {
      trigger,
      state,
      syncedArtifactCount,
      skippedArtifactCount,
      failedArtifactCount,
      lastArtifactId,
      lastArtifactType,
      lagSeconds: this.#status.lagSeconds,
      lastError,
    };
  }
}
