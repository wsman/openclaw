import type { MemoryDuckdbRuntimeMode, MemoryRecord } from "../../types.js";
import {
  createEmptySkillCandidateLifecycleCounts,
  type MemorySkillCandidatePipelineStatus,
  type MemorySkillCandidateSyncResult,
  type MemorySkillCandidateSyncTrigger,
  type ProjectedSkillCandidate,
  type SkillCandidateMaterializeResult,
} from "./SkillCandidateTypes.js";

type SkillCandidatePipelineServiceOptions = {
  getRuntimeMode: () => MemoryDuckdbRuntimeMode;
  listSourceRecords: () => Promise<MemoryRecord[]>;
  listMaterializedSkillCandidates: () => Promise<MemoryRecord[]>;
  project: (records: readonly MemoryRecord[]) => ProjectedSkillCandidate[];
  materialize: (candidate: ProjectedSkillCandidate) => Promise<SkillCandidateMaterializeResult>;
  now?: () => Date;
  countByLifecycle: (
    records: readonly MemoryRecord[],
  ) => MemorySkillCandidatePipelineStatus["countsByLifecycle"];
};

function createInitialStatus(): MemorySkillCandidatePipelineStatus {
  return {
    state: "idle",
    lastRunAt: null,
    lastSuccessAt: null,
    lastCandidateId: null,
    generatedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    countsByLifecycle: createEmptySkillCandidateLifecycleCounts(),
    lastError: null,
  };
}

export class SkillCandidatePipelineService {
  readonly #getRuntimeMode: () => MemoryDuckdbRuntimeMode;
  readonly #listSourceRecords: () => Promise<MemoryRecord[]>;
  readonly #listMaterializedSkillCandidates: () => Promise<MemoryRecord[]>;
  readonly #project: (records: readonly MemoryRecord[]) => ProjectedSkillCandidate[];
  readonly #materialize: (
    candidate: ProjectedSkillCandidate,
  ) => Promise<SkillCandidateMaterializeResult>;
  readonly #countByLifecycle: (
    records: readonly MemoryRecord[],
  ) => MemorySkillCandidatePipelineStatus["countsByLifecycle"];
  readonly #now: () => Date;
  #status: MemorySkillCandidatePipelineStatus = createInitialStatus();

  constructor(options: SkillCandidatePipelineServiceOptions) {
    this.#getRuntimeMode = options.getRuntimeMode;
    this.#listSourceRecords = options.listSourceRecords;
    this.#listMaterializedSkillCandidates = options.listMaterializedSkillCandidates;
    this.#project = options.project;
    this.#materialize = options.materialize;
    this.#countByLifecycle = options.countByLifecycle;
    this.#now = options.now ?? (() => new Date());
  }

  getStatus(): MemorySkillCandidatePipelineStatus {
    return {
      ...this.#status,
      countsByLifecycle: { ...this.#status.countsByLifecycle },
    };
  }

  async sync(trigger: MemorySkillCandidateSyncTrigger): Promise<MemorySkillCandidateSyncResult> {
    const startedAt = this.#now().toISOString();

    if (this.#getRuntimeMode() !== "canonical") {
      this.#status = {
        ...this.#status,
        state: "disabled",
        lastRunAt: startedAt,
        lastError: null,
      };
      return {
        trigger,
        state: "disabled",
        generatedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        lastCandidateId: this.#status.lastCandidateId,
        lastError: null,
      };
    }

    this.#status = {
      ...this.#status,
      state: "syncing",
      lastRunAt: startedAt,
      lastError: null,
    };

    const projected = this.#project(await this.#listSourceRecords());
    let generatedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let lastCandidateId = this.#status.lastCandidateId;
    const errors: string[] = [];

    for (const candidate of projected) {
      try {
        const result = await this.#materialize(candidate);
        lastCandidateId = result.candidateId;
        if (result.action === "created") {
          generatedCount += 1;
        } else if (result.action === "updated") {
          updatedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        failedCount += 1;
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const completedAt = this.#now().toISOString();
    const materializedRecords = await this.#listMaterializedSkillCandidates();
    const lastError = errors.length > 0 ? errors.join("; ") : null;
    const state = failedCount > 0 ? "degraded" : "ok";

    this.#status = {
      state,
      lastRunAt: startedAt,
      lastSuccessAt:
        failedCount === projected.length && projected.length > 0
          ? this.#status.lastSuccessAt
          : completedAt,
      lastCandidateId,
      generatedCount: this.#status.generatedCount + generatedCount,
      updatedCount: this.#status.updatedCount + updatedCount,
      skippedCount: this.#status.skippedCount + skippedCount,
      failedCount: this.#status.failedCount + failedCount,
      countsByLifecycle: this.#countByLifecycle(materializedRecords),
      lastError,
    };

    return {
      trigger,
      state,
      generatedCount,
      updatedCount,
      skippedCount,
      failedCount,
      lastCandidateId,
      lastError,
    };
  }
}
