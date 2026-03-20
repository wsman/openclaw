import type { CrossRepoContractFamily } from '../control-plane-contracts';

export function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function readOptionalString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('optional string field must be a string when provided');
  }
  return value;
}

export function readBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

export function readNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

export function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a string array`);
  }
  return value.map((entry, index) => readString(entry, `${label}[${index}]`));
}

export function readStringRecord(value: unknown, label: string): Record<string, string> {
  const record = readRecord(value, label);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, String(entry)]),
  );
}

export function assertNoForbiddenFields(
  record: Record<string, unknown>,
  forbiddenFields: readonly string[],
  label: string,
): void {
  const present = forbiddenFields.filter((field) => field in record);
  if (present.length > 0) {
    throw new Error(`${label} contains forbidden raw fields: ${present.join(', ')}`);
  }
}

export interface N6DomainContractDescriptor {
  contractId: string;
  schemaVersion: string;
  owner: 'Negentropy-Lab';
  source:
    | 'extensions/memory-duckdb'
    | 'smallpond-evo'
    | 'Negentropy-Lab';
  families: CrossRepoContractFamily[];
  requiredFields: string[];
  forbiddenFields: string[];
}
