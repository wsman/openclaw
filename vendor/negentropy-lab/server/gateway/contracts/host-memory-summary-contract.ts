import { readBoolean, readNumber, readOptionalString, readRecord, readString, assertNoForbiddenFields, type N6DomainContractDescriptor } from './n6-contract-utils';

export const HOST_MEMORY_SUMMARY_CONTRACT_SCHEMA_VERSION = '2026-03-19-n6a1';

export const HOST_MEMORY_SUMMARY_REQUIRED_FIELDS = [
  'pluginId',
  'slotOwnerCandidate',
  'runtimeMode',
  'native.bindingAvailable',
  'native.failureKind',
  'native.packageVersion',
  'native.likelyNeedsLocalBuild',
  'ingest.canonicalRecordCount',
  'ingest.spool.lastSequence',
  'ingest.spool.segmentCount',
  'shadow.parityState',
  'shadow.mismatchCount',
  'shadow.checkpoint.backend',
  'shadow.checkpoint.sequence',
  'shadow.checkpoint.state',
  'shadow.checkpoint.updatedAt',
  'shadow.checkpointAgeSeconds',
  'shadow.checkpointStale',
  'readFacade.sqlGuard',
  'readFacade.nativeAvailable',
  'reflection.summary',
  'governance.flaggedCount',
] as const;

export const HOST_MEMORY_SUMMARY_FORBIDDEN_FIELDS = [
  'coordinator',
  'rawPayload',
  'rawRuntime',
  'shadowWorker',
  'shadowManager',
  'retrievalChain',
  'spoolSegments',
] as const;

export interface HostMemorySummaryContract {
  pluginId: string;
  slotOwnerCandidate: string;
  runtimeMode: string;
  native: {
    bindingAvailable: boolean;
    failureKind: string | null;
    packageVersion: string | null;
    likelyNeedsLocalBuild: boolean;
  };
  ingest: {
    canonicalRecordCount: number;
    spool: {
      lastSequence: number;
      segmentCount: number;
    };
  };
  shadow: {
    parityState: string;
    mismatchCount: number;
    checkpoint: {
      backend: string;
      sequence: number;
      state: string;
      updatedAt: string | null;
    };
    checkpointAgeSeconds: number;
    checkpointStale: boolean;
  };
  readFacade: {
    sqlGuard: string;
    nativeAvailable: boolean;
  };
  reflection: {
    summary: string;
  };
  governance: {
    flaggedCount: number;
  };
}

export const HOST_MEMORY_SUMMARY_CONTRACT_DESCRIPTOR: N6DomainContractDescriptor = {
  contractId: 'HostMemorySummaryContract',
  schemaVersion: HOST_MEMORY_SUMMARY_CONTRACT_SCHEMA_VERSION,
  owner: 'Negentropy-Lab',
  source: 'extensions/memory-duckdb',
  families: ['surface-summary'],
  requiredFields: [...HOST_MEMORY_SUMMARY_REQUIRED_FIELDS],
  forbiddenFields: [...HOST_MEMORY_SUMMARY_FORBIDDEN_FIELDS],
};

export function normalizeHostMemorySummaryContract(payload: unknown): HostMemorySummaryContract {
  const record = readRecord(payload, 'host memory summary');
  assertNoForbiddenFields(record, HOST_MEMORY_SUMMARY_FORBIDDEN_FIELDS, 'host memory summary');

  const native = readRecord(record.native, 'host memory summary.native');
  const ingest = readRecord(record.ingest, 'host memory summary.ingest');
  const spool = readRecord(ingest.spool, 'host memory summary.ingest.spool');
  const shadow = readRecord(record.shadow, 'host memory summary.shadow');
  const checkpoint = readRecord(shadow.checkpoint, 'host memory summary.shadow.checkpoint');
  const readFacade = readRecord(record.readFacade, 'host memory summary.readFacade');
  const reflection = readRecord(record.reflection, 'host memory summary.reflection');
  const governance = readRecord(record.governance, 'host memory summary.governance');

  return {
    pluginId: readString(record.pluginId, 'host memory summary.pluginId'),
    slotOwnerCandidate: readString(record.slotOwnerCandidate, 'host memory summary.slotOwnerCandidate'),
    runtimeMode: readString(record.runtimeMode, 'host memory summary.runtimeMode'),
    native: {
      bindingAvailable: readBoolean(native.bindingAvailable, 'host memory summary.native.bindingAvailable'),
      failureKind: readOptionalString(native.failureKind),
      packageVersion: readOptionalString(native.packageVersion),
      likelyNeedsLocalBuild: readBoolean(
        native.likelyNeedsLocalBuild,
        'host memory summary.native.likelyNeedsLocalBuild',
      ),
    },
    ingest: {
      canonicalRecordCount: readNumber(
        ingest.canonicalRecordCount,
        'host memory summary.ingest.canonicalRecordCount',
      ),
      spool: {
        lastSequence: readNumber(spool.lastSequence, 'host memory summary.ingest.spool.lastSequence'),
        segmentCount: readNumber(spool.segmentCount, 'host memory summary.ingest.spool.segmentCount'),
      },
    },
    shadow: {
      parityState: readString(shadow.parityState, 'host memory summary.shadow.parityState'),
      mismatchCount: readNumber(shadow.mismatchCount, 'host memory summary.shadow.mismatchCount'),
      checkpoint: {
        backend: readString(checkpoint.backend, 'host memory summary.shadow.checkpoint.backend'),
        sequence: readNumber(checkpoint.sequence, 'host memory summary.shadow.checkpoint.sequence'),
        state: readString(checkpoint.state, 'host memory summary.shadow.checkpoint.state'),
        updatedAt: readOptionalString(checkpoint.updatedAt),
      },
      checkpointAgeSeconds: readNumber(
        shadow.checkpointAgeSeconds,
        'host memory summary.shadow.checkpointAgeSeconds',
      ),
      checkpointStale: readBoolean(
        shadow.checkpointStale,
        'host memory summary.shadow.checkpointStale',
      ),
    },
    readFacade: {
      sqlGuard: readString(readFacade.sqlGuard, 'host memory summary.readFacade.sqlGuard'),
      nativeAvailable: readBoolean(
        readFacade.nativeAvailable,
        'host memory summary.readFacade.nativeAvailable',
      ),
    },
    reflection: {
      summary: readString(reflection.summary, 'host memory summary.reflection.summary'),
    },
    governance: {
      flaggedCount: readNumber(governance.flaggedCount, 'host memory summary.governance.flaggedCount'),
    },
  };
}
