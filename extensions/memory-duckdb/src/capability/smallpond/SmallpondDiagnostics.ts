import {
  SMALLPOND_APPROVED_SOURCE_VIEWS,
  assertSmallpondApprovedSourceView,
  type SmallpondApprovedSourceView,
} from "./SmallpondArtifactInventory.js";
import { SMALLPOND_CONTRACT_SCHEMA_VERSION } from "./SmallpondContracts.js";

export type SmallpondReadFailureKind =
  | "ok"
  | "source-view-drift"
  | "guard-rejected"
  | "runner-failed";

export type SmallpondReadDiagnostics = {
  contractId: "SmallpondArtifactReadContract";
  schemaVersion: string;
  approvedSourceViews: SmallpondApprovedSourceView[];
  sourceView: string | null;
  failureKind: SmallpondReadFailureKind;
  driftDetected: boolean;
  detail: string;
};

function normalizeSourceView(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function classifyError(error: unknown): SmallpondReadFailureKind {
  if (!(error instanceof Error)) {
    return "runner-failed";
  }

  if (
    /approved source view|SELECT-only|read-only|raw internal sources|single SELECT statement|non-empty SELECT query/iu.test(
      error.message,
    )
  ) {
    return "guard-rejected";
  }

  return "runner-failed";
}

export function buildSmallpondReadDiagnostics(input: {
  sourceView?: string | null;
  error?: unknown;
}): SmallpondReadDiagnostics {
  const sourceView = normalizeSourceView(input.sourceView);
  let failureKind: SmallpondReadFailureKind = "ok";
  let driftDetected = false;
  let detail = "approved source view set is in sync";

  if (sourceView) {
    try {
      assertSmallpondApprovedSourceView(sourceView);
    } catch {
      failureKind = "source-view-drift";
      driftDetected = true;
      detail = `Source view is outside the approved smallpond contract inventory: ${sourceView}`;
    }
  }

  if (input.error !== undefined) {
    const errorKind = classifyError(input.error);
    const message = input.error instanceof Error ? input.error.message : String(input.error);
    if (failureKind === "ok") {
      failureKind = errorKind;
      detail = message;
    } else {
      detail = `${detail}; ${message}`;
    }
  }

  return {
    contractId: "SmallpondArtifactReadContract",
    schemaVersion: SMALLPOND_CONTRACT_SCHEMA_VERSION,
    approvedSourceViews: [...SMALLPOND_APPROVED_SOURCE_VIEWS],
    sourceView,
    failureKind,
    driftDetected,
    detail,
  };
}
