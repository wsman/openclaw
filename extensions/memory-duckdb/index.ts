import { Type } from "@sinclair/typebox";
import { definePluginEntry, type OpenClawPluginApi } from "./api.js";
import { memoryDuckdbConfigSchema, resolveMemoryDuckdbConfigPaths } from "./src/config/index.js";
import { MemoryDuckdbRuntime } from "./src/runtime/MemoryDuckdbRuntime.js";

function formatSearchResults(results: Awaited<ReturnType<MemoryDuckdbRuntime["search"]>>) {
  if (results.length === 0) {
    return "No memory records matched the query.";
  }
  return results
    .map(
      (result, index) =>
        `${index + 1}. ${result.record.id}\nscore=${result.score.toFixed(2)} ${result.reason}\n${result.record.text}`,
    )
    .join("\n\n");
}

function writeJson(res: import("node:http").ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

export default definePluginEntry({
  id: "memory-duckdb",
  name: "Memory (DuckDB)",
  description: "DuckDB-backed memory owner candidate with canonical spool and read facade",
  kind: "memory",
  configSchema: memoryDuckdbConfigSchema,
  register(api: OpenClawPluginApi) {
    const parsedConfig = resolveMemoryDuckdbConfigPaths(
      memoryDuckdbConfigSchema.parse(api.pluginConfig),
      (value) => api.resolvePath(value),
    );
    const runtime = new MemoryDuckdbRuntime(parsedConfig);

    api.logger.info(
      `memory-duckdb: registered (storage: ${parsedConfig.storagePath}, duckdb: ${parsedConfig.duckdbPath}, mode: ${parsedConfig.runtimeMode})`,
    );

    api.registerTool(
      {
        name: "memory_recall",
        label: "Memory Recall",
        description: "Search absorbed canonical memory records from the DuckDB owner candidate.",
        parameters: Type.Object({
          query: Type.String({ description: "Memory query text" }),
          limit: Type.Optional(Type.Number({ description: "Maximum result count" })),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const query = String(params.query ?? "");
          const limit =
            typeof params.limit === "number" && Number.isFinite(params.limit)
              ? Math.max(1, Math.floor(params.limit))
              : 5;
          const results = await runtime.search(query, limit);
          return {
            content: [{ type: "text", text: formatSearchResults(results) }],
            details: { count: results.length, results },
          };
        },
      },
      { names: ["memory_recall", "memory_search"] },
    );

    api.registerTool(
      {
        name: "memory_get",
        label: "Memory Get",
        description: "Retrieve a stored canonical memory record by id.",
        parameters: Type.Object({
          id: Type.String({ description: "Memory record id" }),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const id = String(params.id ?? "");
          const record = await runtime.getById(id);
          if (!record) {
            return {
              content: [{ type: "text", text: `No memory record found for id ${id}.` }],
              details: { found: false },
            };
          }
          return {
            content: [{ type: "text", text: JSON.stringify(record, null, 2) }],
            details: { found: true, record },
          };
        },
      },
      { name: "memory_get" },
    );

    api.registerTool(
      {
        name: "memory_store",
        label: "Memory Store",
        description:
          "Append canonical memory through the JSONL spool and replay path when runtimeMode=canonical.",
        parameters: Type.Object({
          text: Type.String({ description: "Memory text to store" }),
          source: Type.Optional(Type.String({ description: "Source label for the write" })),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          const result = await runtime.store({
            text: String(params.text ?? ""),
            source: typeof params.source === "string" ? params.source : "tool",
          });
          return {
            content: [
              {
                type: "text",
                text: result.duplicate
                  ? `Duplicate memory suppressed for ${result.record.id}.`
                  : `Stored memory ${result.record.id} via canonical spool.`,
              },
            ],
            details: result,
          };
        },
      },
      { name: "memory_store" },
    );

    api.registerTool(
      {
        name: "memory_duckdb_status",
        label: "Memory DuckDB Status",
        description: "Inspect canonical, shadow, and native DuckDB readiness for this extension.",
        parameters: Type.Object({}),
        async execute() {
          const status = await runtime.getStatus();
          return {
            content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
            details: status,
          };
        },
      },
      { name: "memory_duckdb_status" },
    );

    api.registerTool(
      {
        name: "memory_sql_query",
        label: "Memory SQL Query",
        description: "Run a guarded SELECT-only query against the DuckDB read facade.",
        parameters: Type.Object({
          sql: Type.String({ description: "SELECT query against read-facade views" }),
        }),
        async execute(_toolCallId: string, params: Record<string, unknown>) {
          try {
            const rows = await runtime.queryDuckDb(String(params.sql ?? ""));
            return {
              content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
              details: { count: rows.length, rows },
            };
          } catch (error) {
            return {
              content: [
                { type: "text", text: error instanceof Error ? error.message : String(error) },
              ],
              details: {
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "memory_sql_query" },
    );

    api.registerCli(
      ({ program }) => {
        const memory = program
          .command("memory")
          .description("DuckDB memory owner candidate commands");

        memory
          .command("status")
          .description("Show canonical, shadow, and DuckDB native status")
          .action(async () => {
            console.log(JSON.stringify(await runtime.getStatus(), null, 2));
          });

        memory
          .command("sync-business")
          .description(
            "Run one approved-surface smallpond business sync through the selected owner",
          )
          .action(async () => {
            console.log(JSON.stringify(await runtime.syncBusinessKnowledge("manual"), null, 2));
          });

        memory
          .command("sync-skills")
          .description(
            "Run one host-local skill candidate projection/materialization pass through the selected owner",
          )
          .action(async () => {
            console.log(JSON.stringify(await runtime.syncSkillCandidates("manual"), null, 2));
          });

        const skillCandidates = memory
          .command("skill-candidates")
          .description("Inspect and transition canonical skill candidate records");

        skillCandidates
          .command("list")
          .description("List canonical skill candidate records")
          .action(async () => {
            console.log(JSON.stringify(await runtime.listSkillCandidates(), null, 2));
          });

        skillCandidates
          .command("get <candidateId>")
          .description("Get a canonical skill candidate record by candidate id")
          .action(async (candidateId: string) => {
            console.log(JSON.stringify(await runtime.getSkillCandidate(candidateId), null, 2));
          });

        skillCandidates
          .command("submit-review <candidateId>")
          .description("Move a draft skill candidate into pending review")
          .action(async (candidateId: string) => {
            console.log(
              JSON.stringify(
                await runtime.transitionSkillCandidate(candidateId, "submit-review"),
                null,
                2,
              ),
            );
          });

        skillCandidates
          .command("approve <candidateId>")
          .description("Approve a pending-review skill candidate")
          .action(async (candidateId: string) => {
            console.log(
              JSON.stringify(
                await runtime.transitionSkillCandidate(candidateId, "approve"),
                null,
                2,
              ),
            );
          });

        skillCandidates
          .command("reject <candidateId>")
          .description("Reject a pending-review skill candidate")
          .action(async (candidateId: string) => {
            console.log(
              JSON.stringify(
                await runtime.transitionSkillCandidate(candidateId, "reject"),
                null,
                2,
              ),
            );
          });

        skillCandidates
          .command("archive <candidateId>")
          .description("Archive an approved, rejected, or materialized skill candidate")
          .action(async (candidateId: string) => {
            console.log(
              JSON.stringify(
                await runtime.transitionSkillCandidate(candidateId, "archive"),
                null,
                2,
              ),
            );
          });

        memory
          .command("store <text>")
          .description("Store memory through the canonical spool when runtimeMode=canonical")
          .action(async (text: string) => {
            console.log(JSON.stringify(await runtime.store({ text, source: "cli" }), null, 2));
          });

        memory
          .command("search <query>")
          .description("Search canonical memory")
          .option("-l, --limit <limit>", "Maximum results", "5")
          .action(async (query: string, opts: { limit?: string }) => {
            const limit = opts.limit ? Number.parseInt(opts.limit, 10) : 5;
            console.log(JSON.stringify(await runtime.search(query, limit), null, 2));
          });

        memory
          .command("get <id>")
          .description("Get a canonical memory record by id")
          .action(async (id: string) => {
            console.log(JSON.stringify(await runtime.getById(id), null, 2));
          });

        memory
          .command("sql <sql>")
          .description("Run a guarded SELECT-only DuckDB read-facade query")
          .action(async (sql: string) => {
            console.log(JSON.stringify(await runtime.queryDuckDb(sql), null, 2));
          });
      },
      { commands: ["memory"] },
    );

    api.registerService({
      id: "memory-duckdb",
      async start() {
        await runtime.start();
        const startupSync = await runtime.syncBusinessKnowledge("startup");
        const startupSkillSync = await runtime.syncSkillCandidates("startup");
        if (startupSync.state === "degraded") {
          api.logger.warn(
            `memory-duckdb: startup business sync degraded (${startupSync.failedArtifactCount} failed, ${startupSync.syncedArtifactCount} synced)`,
          );
        } else if (startupSync.state === "disabled") {
          api.logger.info("memory-duckdb: startup business sync disabled outside canonical mode");
        } else {
          api.logger.info(
            `memory-duckdb: startup business sync ${startupSync.state} (${startupSync.syncedArtifactCount} synced, ${startupSync.skippedArtifactCount} skipped)`,
          );
        }
        if (startupSkillSync.state === "degraded") {
          api.logger.warn(
            `memory-duckdb: startup skill sync degraded (${startupSkillSync.failedCount} failed, ${startupSkillSync.generatedCount} generated, ${startupSkillSync.updatedCount} updated)`,
          );
        } else if (startupSkillSync.state === "disabled") {
          api.logger.info("memory-duckdb: startup skill sync disabled outside canonical mode");
        } else {
          api.logger.info(
            `memory-duckdb: startup skill sync ${startupSkillSync.state} (${startupSkillSync.generatedCount} generated, ${startupSkillSync.updatedCount} updated, ${startupSkillSync.skippedCount} skipped)`,
          );
        }
        api.logger.info("memory-duckdb: service started");
      },
      async stop() {
        runtime.stop();
        api.logger.info("memory-duckdb: service stopped");
      },
    });

    if (parsedConfig.diagnostics.enableHttpRoutes) {
      api.registerHttpRoute({
        path: "/plugin/memory-duckdb/status",
        auth: "plugin",
        handler: async (_req, res) => {
          writeJson(res, 200, await runtime.getStatus());
          return true;
        },
      });

      api.registerHttpRoute({
        path: "/plugin/memory-duckdb/search",
        auth: "plugin",
        handler: async (req, res) => {
          const url = new URL(req.url ?? "/plugin/memory-duckdb/search", "http://localhost");
          const query = url.searchParams.get("q") ?? "";
          const limit = Number.parseInt(url.searchParams.get("limit") ?? "5", 10);
          writeJson(res, 200, {
            query,
            results: await runtime.search(query, Number.isFinite(limit) ? limit : 5),
          });
          return true;
        },
      });

      api.registerHttpRoute({
        path: "/plugin/memory-duckdb/sql",
        auth: "plugin",
        handler: async (req, res) => {
          const url = new URL(req.url ?? "/plugin/memory-duckdb/sql", "http://localhost");
          const sql = url.searchParams.get("sql") ?? "";
          try {
            writeJson(res, 200, {
              sql,
              rows: await runtime.queryDuckDb(sql),
            });
          } catch (error) {
            writeJson(res, 400, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return true;
        },
      });
    }
  },
});
