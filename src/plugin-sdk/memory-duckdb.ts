// Narrow plugin-sdk surface for the bundled memory-duckdb plugin.
// Keep this list additive and scoped to symbols used under extensions/memory-duckdb.

export { definePluginEntry } from "./core.js";
export type { OpenClawPluginApi } from "../plugins/types.js";
