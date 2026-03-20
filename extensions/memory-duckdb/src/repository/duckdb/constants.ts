export const BLOCKED_RAW_TABLES = [
  "knowledge_items",
  "knowledge_chunks",
  "knowledge_relations",
  "access_events",
  "ingest_events",
  "governance_candidates",
  "archive_manifests",
  "sessions",
  "session_entries",
  "session_working_memory",
  "session_archives",
  "duckdb_schema_migrations",
  "duckdb_schema_metadata",
] as const;

export const ALLOWED_FACADE_VIEWS = [
  "v_active_knowledge",
  "v_memory_store_compat",
  "articles",
  "documents",
] as const;
