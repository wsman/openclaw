import { randomUUID } from "node:crypto";
import { BusinessKnowledgeSyncService } from "../capability/smallpond/BusinessKnowledgeSyncService.js";
import { evaluateControlPlaneAlignment } from "../capability/smallpond/ControlPlaneAlignment.js";
import {
  buildSkillCandidateRecordMetadata,
  buildSkillCandidateRecordText,
  buildSkillCandidateRevisionKey,
  countSkillCandidateLifecycleStates,
  readSkillCandidateRecordMetadata,
  updateSkillCandidateRecordMetadata,
} from "../capability/smallpond/SkillCandidateMaterializer.js";
import { SkillCandidatePipelineService } from "../capability/smallpond/SkillCandidatePipelineService.js";
import { projectSkillCandidates } from "../capability/smallpond/SkillCandidateProjector.js";
import { transitionSkillCandidateLifecycle } from "../capability/smallpond/SkillCandidateStateMachine.js";
import type {
  ProjectedSkillCandidate,
  SkillCandidateTransitionAction,
} from "../capability/smallpond/SkillCandidateTypes.js";
import { SmallpondClient } from "../capability/smallpond/SmallpondClient.js";
import {
  buildSmallpondRecordMetadata,
  buildSmallpondRecordText,
  buildSmallpondSyncKey,
  compareIsoTimestamp,
  readSmallpondRecordMetadata,
  type SmallpondMaterializationInput,
} from "../capability/smallpond/SmallpondMaterialization.js";
import { SmallpondArtifactReadAccess } from "../capability/smallpond/SmallpondReadAccess.js";
import { getDuckDbNativeBindingStatus } from "../diagnostics/DuckDbNativeBinding.js";
import { GovernanceRuntime } from "../governance/GovernanceRuntime.js";
import { JsonlIngestSpool } from "../ingest/JsonlIngestSpool.js";
import { SingleWriterQueue } from "../ingest/SingleWriterQueue.js";
import { stableStringify } from "../ingest/stable-json.js";
import { INGEST_SCHEMA_VERSION } from "../ingest/types.js";
import { ReflectionRuntime } from "../reflection/ReflectionRuntime.js";
import { CanonicalMemoryRepository } from "../repository/compat/CanonicalMemoryRepository.js";
import { DuckDbReadFacade } from "../repository/duckdb/DuckDbReadFacade.js";
import { MemoryRetriever } from "../retrieval/MemoryRetriever.js";
import { ShadowReplayManager } from "../shadow/ShadowReplayManager.js";
import type {
  MemoryBusinessSyncResult,
  MemoryBusinessSyncTrigger,
  MemoryDuckdbConfig,
  MemoryRecord,
  MemoryRuntimeStatus,
  MemorySearchResult,
  MemorySkillCandidateSyncResult,
  MemorySkillCandidateSyncTrigger,
  MemoryStoreResult,
  MemoryWriteRequest,
} from "../types.js";

type MemoryDuckdbRuntimeDeps = {
  now?: () => Date;
  smallpondQueryRunner?: (sql: string, params: unknown[]) => Promise<Record<string, unknown>[]>;
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/gu, " ").trim();
}

function extractTags(text: string): string[] {
  const tags = new Set<string>();
  for (const token of normalizeText(text).split(/[^a-z0-9]+/iu)) {
    if (token.length >= 5) {
      tags.add(token);
    }
  }
  return [...tags].slice(0, 8);
}

function buildDedupKey(text: string, metadata: Record<string, unknown>): string {
  return stableStringify({
    text: normalizeText(text),
    metadata,
  });
}

function checkpointAgeSeconds(updatedAt: string | undefined): number | null {
  if (!updatedAt) {
    return null;
  }
  const parsed = Date.parse(updatedAt);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function isCheckpointStale(
  checkpointAge: number | null,
  maxCheckpointAgeSeconds: number,
  hasCanonicalRecords: boolean,
): boolean {
  if (checkpointAge == null) {
    return hasCanonicalRecords;
  }
  return checkpointAge > maxCheckpointAgeSeconds;
}

function readCandidateSummary(text: string): string {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const summary = lines.find(
    (line) =>
      !line.startsWith("[") &&
      !line.startsWith("artifact=") &&
      !line.startsWith("candidate=") &&
      !line.startsWith("trigger=") &&
      !line.startsWith("steps=") &&
      !line.startsWith("priority=") &&
      !line.startsWith("confidence=") &&
      !line.startsWith("lifecycle=") &&
      !line.startsWith("sourcePromotionStatus=") &&
      !line.startsWith("{"),
  );

  return summary ?? lines.at(0) ?? "skill candidate";
}

export class MemoryDuckdbRuntime {
  readonly #config: MemoryDuckdbConfig;
  readonly #queue: SingleWriterQueue;
  readonly #spool: JsonlIngestSpool;
  readonly #canonicalRepository: CanonicalMemoryRepository;
  readonly #shadowReplayManager: ShadowReplayManager;
  readonly #retriever: MemoryRetriever;
  readonly #reflection: ReflectionRuntime;
  readonly #governance: GovernanceRuntime;
  readonly #duckDbReadFacade: DuckDbReadFacade;
  readonly #smallpondClient: SmallpondClient;
  readonly #businessKnowledgeSyncService: BusinessKnowledgeSyncService;
  readonly #skillCandidatePipelineService: SkillCandidatePipelineService;
  readonly #now: () => Date;
  #started = false;

  constructor(config: MemoryDuckdbConfig, deps: MemoryDuckdbRuntimeDeps = {}) {
    this.#config = config;
    this.#now = deps.now ?? (() => new Date());
    this.#queue = new SingleWriterQueue();
    this.#spool = new JsonlIngestSpool({
      rootDir: `${config.storagePath}/spool`,
      maxActiveBytes: config.ingest.maxActiveBytes,
    });
    this.#canonicalRepository = new CanonicalMemoryRepository(config.storagePath);
    this.#shadowReplayManager = new ShadowReplayManager({
      storagePath: config.storagePath,
      spool: this.#spool,
      canonicalRepository: this.#canonicalRepository,
      batchSize: config.replay.batchSize,
      requireParityZeroMismatch: config.shadow.requireParityZeroMismatch,
    });
    this.#retriever = new MemoryRetriever();
    this.#reflection = new ReflectionRuntime();
    this.#governance = new GovernanceRuntime();
    this.#duckDbReadFacade = new DuckDbReadFacade(config.duckdbPath);
    const queryRunner =
      deps.smallpondQueryRunner ??
      ((sql: string, params: unknown[]) => this.#duckDbReadFacade.query(sql, params));
    this.#smallpondClient = new SmallpondClient({
      readAccess: new SmallpondArtifactReadAccess(queryRunner),
      now: this.#now,
    });
    this.#businessKnowledgeSyncService = new BusinessKnowledgeSyncService({
      client: this.#smallpondClient,
      getRuntimeMode: () => this.#config.runtimeMode,
      materialize: (artifact) => this.#materializeSmallpondArtifact(artifact),
      now: this.#now,
    });
    this.#skillCandidatePipelineService = new SkillCandidatePipelineService({
      getRuntimeMode: () => this.#config.runtimeMode,
      listSourceRecords: async () => this.#canonicalRepository.list(),
      listMaterializedSkillCandidates: async () => this.#listSkillCandidateRecords(),
      project: (records) => projectSkillCandidates(records),
      materialize: (candidate) => this.#materializeSkillCandidate(candidate),
      countByLifecycle: (records) => countSkillCandidateLifecycleStates(records),
      now: this.#now,
    });
  }

  async start(): Promise<void> {
    if (this.#started) {
      return;
    }
    await this.#spool.initialize();
    this.#started = true;
  }

  stop() {
    this.#duckDbReadFacade.close();
    this.#started = false;
  }

  #assertWriteAllowed() {
    if (this.#config.runtimeMode === "shadow-read") {
      throw new Error(
        "memory-duckdb runtimeMode=shadow-read is read-only; select runtimeMode=canonical to store memory",
      );
    }
  }

  async store(request: MemoryWriteRequest): Promise<MemoryStoreResult> {
    return this.#queue.enqueue(async () => {
      await this.start();
      this.#assertWriteAllowed();
      const text = request.text.trim();
      if (!text) {
        throw new Error("memory-duckdb store requires non-empty text");
      }

      const metadata = request.metadata ?? {};
      const dedupKey = buildDedupKey(text, metadata);
      const existing = this.#canonicalRepository.findByDedupKey(dedupKey);
      if (existing) {
        return {
          record: existing,
          duplicate: true,
          ingestId: existing.id,
          idempotencyKey: dedupKey,
          shadowCompared: true,
          shadowParityState: this.#shadowReplayManager.getLastParityState(),
        };
      }

      const ingestId = randomUUID();
      const createdAt = new Date().toISOString();
      const nextSequence = (await this.#spool.getCurrentSequence()) + 1;
      const record: MemoryRecord = {
        id: randomUUID(),
        text,
        normalizedText: normalizeText(text),
        tags: extractTags(text),
        source: request.source ?? "manual",
        dedupKey,
        metadata,
        createdAt,
        updatedAt: createdAt,
        ingestSequence: nextSequence,
      };

      const spoolRecord = await this.#spool.append<MemoryRecord>({
        ingestId,
        idempotencyKey: dedupKey,
        sourceEventId: record.id,
        pipeline: "canonical-memory",
        action: "memory.store",
        entityKind: "memory-record",
        entityId: record.id,
        scope: "global",
        payload: record,
        createdAt,
        schemaVersion: INGEST_SCHEMA_VERSION,
      });
      this.#canonicalRepository.upsert(record);

      const shadow = await this.#shadowReplayManager.replayPending();
      return {
        record,
        duplicate: false,
        ingestId: spoolRecord.ingestId,
        idempotencyKey: dedupKey,
        shadowCompared: shadow.parityState === "ok" || shadow.parityState === "mismatch",
        shadowParityState: shadow.parityState,
      };
    });
  }

  async syncBusinessKnowledge(
    trigger: MemoryBusinessSyncTrigger = "manual",
  ): Promise<MemoryBusinessSyncResult> {
    await this.start();
    return this.#businessKnowledgeSyncService.sync(trigger);
  }

  async syncSkillCandidates(
    trigger: MemorySkillCandidateSyncTrigger = "manual",
  ): Promise<MemorySkillCandidateSyncResult> {
    await this.start();
    return this.#skillCandidatePipelineService.sync(trigger);
  }

  async search(query: string, limit = 5): Promise<MemorySearchResult[]> {
    await this.start();
    return this.#retriever.search(this.#canonicalRepository.list(), query, limit);
  }

  async getById(id: string): Promise<MemoryRecord | null> {
    await this.start();
    return this.#canonicalRepository.findById(id);
  }

  async list(): Promise<MemoryRecord[]> {
    await this.start();
    return this.#canonicalRepository.list();
  }

  async listSkillCandidates(): Promise<MemoryRecord[]> {
    await this.start();
    return this.#listSkillCandidateRecords();
  }

  async getSkillCandidate(candidateId: string): Promise<MemoryRecord | null> {
    await this.start();
    return this.#findSkillCandidateRecordByCandidateId(candidateId);
  }

  async transitionSkillCandidate(candidateId: string, action: SkillCandidateTransitionAction) {
    return this.#queue.enqueue(async () => {
      await this.start();
      this.#assertWriteAllowed();

      const existing = this.#findSkillCandidateRecordByCandidateId(candidateId);
      if (!existing) {
        throw new Error(`No skill candidate found for ${candidateId}`);
      }

      const metadata = readSkillCandidateRecordMetadata(existing);
      if (!metadata) {
        throw new Error(`Memory record ${existing.id} is missing skill candidate metadata`);
      }

      const nextLifecycle = transitionSkillCandidateLifecycle(metadata.lifecycleState, action);
      const updatedAt = this.#now().toISOString();
      const updatedMetadata = updateSkillCandidateRecordMetadata(existing, {
        lifecycleState: nextLifecycle,
        updatedAt,
      });
      const nextSequence = (await this.#spool.getCurrentSequence()) + 1;
      const text = buildSkillCandidateRecordText({
        candidateId: metadata.candidateId,
        title: metadata.title,
        summary: readCandidateSummary(existing.text),
        trigger: metadata.trigger,
        steps: metadata.steps,
        priority: metadata.priority,
        confidence: metadata.confidence,
        lifecycleState: nextLifecycle,
        sourcePromotionStatus: metadata.sourcePromotionStatus,
      });
      const record: MemoryRecord = {
        ...existing,
        text,
        normalizedText: normalizeText(text),
        tags: extractTags(text),
        dedupKey: buildSkillCandidateRevisionKey({
          candidateId: metadata.candidateId,
          updatedAt,
        }),
        metadata: updatedMetadata,
        updatedAt,
        ingestSequence: nextSequence,
      };

      const spoolRecord = await this.#spool.append<MemoryRecord>({
        ingestId: randomUUID(),
        idempotencyKey: record.dedupKey,
        sourceEventId: metadata.candidateId,
        pipeline: "skill-candidate-sync",
        action: `memory.skill-candidate.${action}`,
        entityKind: "memory-record",
        entityId: record.id,
        scope: "global",
        payload: record,
        createdAt: updatedAt,
        schemaVersion: INGEST_SCHEMA_VERSION,
      });
      this.#canonicalRepository.upsert(record);
      await this.#shadowReplayManager.replayPending();

      return {
        candidateId: metadata.candidateId,
        action,
        lifecycleState: nextLifecycle,
        ingestId: spoolRecord.ingestId,
        record,
      };
    });
  }

  async queryDuckDb(sql: string): Promise<Record<string, unknown>[]> {
    await this.start();
    return this.#duckDbReadFacade.query(sql);
  }

  async getStatus(): Promise<MemoryRuntimeStatus> {
    await this.start();
    const records = this.#canonicalRepository.list();
    const skillCandidateRecords = this.#listSkillCandidateRecords();
    const alignment = evaluateControlPlaneAlignment(records, this.#now());
    const reflection = this.#reflection.summarize(records);
    const governance = this.#governance.inspect(records);
    const checkpoint = this.#shadowReplayManager.getCheckpoint();
    const checkpointAge = checkpointAgeSeconds(checkpoint?.updatedAt);
    const native = getDuckDbNativeBindingStatus();

    if (this.#config.native.required && !native.bindingAvailable) {
      native.errorMessage =
        native.errorMessage ??
        "DuckDB native binding required by config but unavailable on this host.";
    }

    return {
      pluginId: "memory-duckdb",
      slotOwnerCandidate: true,
      runtimeMode: this.#config.runtimeMode,
      storagePath: this.#config.storagePath,
      duckdbPath: this.#config.duckdbPath,
      native,
      ingest: {
        spool: this.#spool.getDiagnostics(),
        canonicalRecordCount: records.length,
      },
      shadow: {
        parityState: this.#shadowReplayManager.getLastParityState(),
        mismatchCount: this.#shadowReplayManager.getLastMismatchCount(),
        checkpoint,
        checkpointAgeSeconds: checkpointAge,
        checkpointStale: isCheckpointStale(
          checkpointAge,
          this.#config.shadow.maxCheckpointAgeSeconds,
          records.length > 0,
        ),
      },
      readFacade: {
        sqlGuard: "select-only",
        nativeAvailable: native.bindingAvailable,
      },
      reflection,
      governance,
      businessSync: this.#businessKnowledgeSyncService.getStatus(),
      skillCandidates: {
        ...this.#skillCandidatePipelineService.getStatus(),
        countsByLifecycle: countSkillCandidateLifecycleStates(skillCandidateRecords),
      },
      controlPlaneAlignment: alignment.status,
    };
  }

  async #materializeSmallpondArtifact(input: SmallpondMaterializationInput) {
    return this.#queue.enqueue(async () => {
      await this.start();
      this.#assertWriteAllowed();

      const syncKey = buildSmallpondSyncKey({
        artifactType: input.readArtifact.artifactType,
        artifactId: input.readArtifact.artifactId,
        sourceTimestamp: input.sourceTimestamp,
      });
      const duplicate = this.#findSmallpondRecordBySyncKey(syncKey);
      if (duplicate) {
        return {
          action: "duplicate" as const,
          artifactId: input.readArtifact.artifactId,
          artifactType: input.readArtifact.artifactType,
          sourceTimestamp: input.sourceTimestamp,
        };
      }

      const existing = this.#findLatestSmallpondRecord(
        input.readArtifact.artifactType,
        input.readArtifact.artifactId,
      );
      const existingMetadata = existing ? readSmallpondRecordMetadata(existing) : null;
      if (
        existingMetadata &&
        compareIsoTimestamp(existingMetadata.smallpond.sourceTimestamp, input.sourceTimestamp) >= 0
      ) {
        return {
          action: "stale" as const,
          artifactId: input.readArtifact.artifactId,
          artifactType: input.readArtifact.artifactType,
          sourceTimestamp: input.sourceTimestamp,
        };
      }

      const materializedAt = this.#now().toISOString();
      const metadata = buildSmallpondRecordMetadata(input, materializedAt);
      const text = buildSmallpondRecordText(input);
      const nextSequence = (await this.#spool.getCurrentSequence()) + 1;
      const record: MemoryRecord = {
        id: existing?.id ?? randomUUID(),
        text,
        normalizedText: normalizeText(text),
        tags: extractTags(text),
        source: "smallpond-sync",
        dedupKey: buildDedupKey(text, metadata),
        metadata,
        createdAt: existing?.createdAt ?? materializedAt,
        updatedAt: materializedAt,
        ingestSequence: nextSequence,
      };
      const spoolRecord = await this.#spool.append<MemoryRecord>({
        ingestId: randomUUID(),
        idempotencyKey: syncKey,
        sourceEventId: `${input.readArtifact.artifactType}:${input.readArtifact.artifactId}`,
        pipeline: "smallpond-business-sync",
        action: existing ? "memory.business-sync.update" : "memory.business-sync.materialize",
        entityKind: "memory-record",
        entityId: record.id,
        scope: "global",
        payload: record,
        createdAt: materializedAt,
        schemaVersion: INGEST_SCHEMA_VERSION,
      });
      this.#canonicalRepository.upsert(record);
      await this.#shadowReplayManager.replayPending();

      return {
        action: existing ? ("updated" as const) : ("created" as const),
        artifactId: input.readArtifact.artifactId,
        artifactType: input.readArtifact.artifactType,
        sourceTimestamp: input.sourceTimestamp,
        ingestId: spoolRecord.ingestId,
      };
    });
  }

  async #materializeSkillCandidate(input: ProjectedSkillCandidate) {
    return this.#queue.enqueue(async () => {
      await this.start();
      this.#assertWriteAllowed();

      const revisionKey = buildSkillCandidateRevisionKey({
        candidateId: input.candidateId,
        updatedAt: input.updatedAt,
      });
      if (this.#findSkillCandidateRecordByRevisionKey(revisionKey)) {
        return {
          action: "duplicate" as const,
          candidateId: input.candidateId,
          updatedAt: input.updatedAt,
        };
      }

      const existing = this.#findSkillCandidateRecordByCandidateId(input.candidateId);
      const existingMetadata = existing ? readSkillCandidateRecordMetadata(existing) : null;
      if (
        existingMetadata &&
        compareIsoTimestamp(existingMetadata.updatedAt, input.updatedAt) >= 0
      ) {
        return {
          action: "stale" as const,
          candidateId: input.candidateId,
          updatedAt: input.updatedAt,
        };
      }

      const lifecycleState = existingMetadata
        ? existingMetadata.lifecycleState === "archived"
          ? "archived"
          : input.sourcePromotionStatus !== "promoted" && input.sourcePromotionStatus !== "rejected"
            ? existingMetadata.lifecycleState
            : input.lifecycleState
        : input.lifecycleState;
      const materializedAt = this.#now().toISOString();
      const nextSequence = (await this.#spool.getCurrentSequence()) + 1;
      const recordInput = {
        ...input,
        lifecycleState,
      };
      const text = buildSkillCandidateRecordText({
        candidateId: recordInput.candidateId,
        title: recordInput.title,
        summary: recordInput.summary,
        trigger: recordInput.trigger,
        steps: recordInput.steps,
        priority: recordInput.priority,
        confidence: recordInput.confidence,
        lifecycleState: recordInput.lifecycleState,
        sourcePromotionStatus: recordInput.sourcePromotionStatus,
      });
      const record: MemoryRecord = {
        id: existing?.id ?? randomUUID(),
        text,
        normalizedText: normalizeText(text),
        tags: extractTags(text),
        source: "skill-candidate-sync",
        dedupKey: revisionKey,
        metadata: buildSkillCandidateRecordMetadata(recordInput, materializedAt),
        createdAt: existing?.createdAt ?? materializedAt,
        updatedAt: materializedAt,
        ingestSequence: nextSequence,
      };

      const spoolRecord = await this.#spool.append<MemoryRecord>({
        ingestId: randomUUID(),
        idempotencyKey: revisionKey,
        sourceEventId: input.sourceRecordId,
        pipeline: "skill-candidate-sync",
        action: existing ? "memory.skill-candidate.update" : "memory.skill-candidate.materialize",
        entityKind: "memory-record",
        entityId: record.id,
        scope: "global",
        payload: record,
        createdAt: materializedAt,
        schemaVersion: INGEST_SCHEMA_VERSION,
      });
      this.#canonicalRepository.upsert(record);
      await this.#shadowReplayManager.replayPending();

      return {
        action: existing ? ("updated" as const) : ("created" as const),
        candidateId: input.candidateId,
        updatedAt: input.updatedAt,
        recordId: record.id,
        ingestId: spoolRecord.ingestId,
      };
    });
  }

  #findSmallpondRecordBySyncKey(syncKey: string): MemoryRecord | null {
    return (
      this.#canonicalRepository.list().find((record) => {
        const metadata = readSmallpondRecordMetadata(record);
        return metadata?.knowledge.syncKey === syncKey;
      }) ?? null
    );
  }

  #findLatestSmallpondRecord(artifactType: string, artifactId: string): MemoryRecord | null {
    const matches = this.#canonicalRepository.list().filter((record) => {
      const metadata = readSmallpondRecordMetadata(record);
      return (
        metadata?.smallpond.artifactType === artifactType &&
        metadata.smallpond.artifactId === artifactId
      );
    });
    if (matches.length === 0) {
      return null;
    }
    matches.sort((left, right) => {
      const leftMetadata = readSmallpondRecordMetadata(left);
      const rightMetadata = readSmallpondRecordMetadata(right);
      return compareIsoTimestamp(
        leftMetadata?.smallpond.sourceTimestamp ?? left.updatedAt,
        rightMetadata?.smallpond.sourceTimestamp ?? right.updatedAt,
      );
    });
    return matches.at(-1) ?? null;
  }

  #listSkillCandidateRecords(): MemoryRecord[] {
    return this.#canonicalRepository
      .list()
      .filter((record) => readSkillCandidateRecordMetadata(record) !== null)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  #findSkillCandidateRecordByCandidateId(candidateId: string): MemoryRecord | null {
    return (
      this.#canonicalRepository.list().find((record) => {
        const metadata = readSkillCandidateRecordMetadata(record);
        return metadata?.candidateId === candidateId;
      }) ?? null
    );
  }

  #findSkillCandidateRecordByRevisionKey(revisionKey: string): MemoryRecord | null {
    return (
      this.#canonicalRepository.list().find((record) => record.dedupKey === revisionKey) ?? null
    );
  }
}
