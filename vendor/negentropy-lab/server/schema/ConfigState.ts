/**
 * ⚙️ ConfigState - 配置房间状态 Schema
 *
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：配置变更必须可追溯并减少混乱
 * §152 单一真理源公理：配置状态以房间状态为准
 *
 * @filename ConfigState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-27
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * 单项配置
 */
export class ConfigEntry extends Schema {
  @type("string") key: string = "";
  @type("string") value: string = "";
  @type("number") version: number = 1;
  @type("number") updatedAt: number = 0;
  @type("string") updatedBy: string = "system";
}

/**
 * 配置变更历史
 */
export class ConfigHistoryEntry extends Schema {
  @type("number") version: number = 1;
  @type("number") changedCount: number = 0;
  @type("string") changedKeys: string = ""; // comma separated keys
  @type("number") updatedAt: number = 0;
  @type("string") updatedBy: string = "system";
}

/**
 * 配置主状态
 */
export class ConfigState extends Schema {
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  @type("number") currentVersion: number = 1;
  @type("string") validationStatus: string = "unknown"; // unknown | valid | invalid
  @type("string") validationMessage: string = "";
  @type({ map: ConfigEntry }) entries = new MapSchema<ConfigEntry>();
  @type({ array: ConfigHistoryEntry }) history = new ArraySchema<ConfigHistoryEntry>();
}

