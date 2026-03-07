/**
 * ⚙️ ConfigRoom - 配置管理房间
 *
 * @constitution
 * §101 同步公理：配置变更必须同步广播
 * §102 熵减原则：所有变更需可追踪可回滚
 * §152 单一真理源公理：房间状态为配置真理源
 *
 * @filename ConfigRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-27
 */

import { Room, Client } from "colyseus";
import { ConfigEntry, ConfigHistoryEntry, ConfigState } from "../schema/ConfigState";
import { logger } from "../utils/logger";

interface ConfigRoomConfig {
  maxHistory: number;
  maxKeys: number;
  maxValueLength: number;
}

const DEFAULT_CONFIG: ConfigRoomConfig = {
  maxHistory: 200,
  maxKeys: 2000,
  maxValueLength: 100_000,
};

export class ConfigRoom extends Room<ConfigState> {
  private config!: ConfigRoomConfig;
  private snapshots = new Map<number, Record<string, string>>();

  onCreate(options: any) {
    logger.info(`[ConfigRoom] 创建配置房间 ${this.roomId}...`);
    this.config = { ...DEFAULT_CONFIG, ...options?.config };

    this.setState(new ConfigState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();
    this.state.currentVersion = 1;

    this.snapshots.set(1, {});
    this.setupMessageHandlers();
    logger.info("[ConfigRoom] 配置房间创建完成");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);
      switch (typeStr) {
        case "get_config":
          this.handleGetConfig(client, message);
          break;
        case "apply_config":
          this.handleApplyConfig(client, message);
          break;
        case "validate_config":
          this.handleValidateConfig(client, message);
          break;
        case "get_config_history":
          this.handleGetConfigHistory(client, message);
          break;
        case "rollback_config":
          this.handleRollbackConfig(client, message);
          break;
        default:
          logger.debug(`[ConfigRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  private handleGetConfig(client: Client, message: any) {
    const key = message?.key ? String(message.key) : "";
    if (key) {
      const entry = this.state.entries.get(key);
      client.send("config_value", {
        key,
        value: entry?.value ?? null,
        version: entry?.version ?? this.state.currentVersion,
        timestamp: Date.now(),
      });
      return;
    }

    client.send("config_all", {
      version: this.state.currentVersion,
      entries: this.serializeEntries(),
      validationStatus: this.state.validationStatus,
      validationMessage: this.state.validationMessage,
      timestamp: Date.now(),
    });
  }

  private handleApplyConfig(client: Client, message: any) {
    const input = message?.config;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      client.send("error", { code: "invalid_config", message: "config必须为对象" });
      return;
    }

    const validation = this.validateConfigObject(input);
    this.state.validationStatus = validation.valid ? "valid" : "invalid";
    this.state.validationMessage = validation.message;
    if (!validation.valid) {
      client.send("config_validation_failed", validation);
      return;
    }

    const changedKeys: string[] = [];
    const version = this.state.currentVersion + 1;
    const now = Date.now();
    const updatedBy = client.sessionId || "system";

    Object.entries(input).forEach(([k, v]) => {
      const key = String(k);
      const value = typeof v === "string" ? v : JSON.stringify(v);

      const prev = this.state.entries.get(key);
      if (!prev || prev.value !== value) {
        changedKeys.push(key);
      }

      const entry = prev || new ConfigEntry();
      entry.key = key;
      entry.value = value;
      entry.version = version;
      entry.updatedAt = now;
      entry.updatedBy = updatedBy;
      this.state.entries.set(key, entry);
    });

    this.state.currentVersion = version;
    this.state.lastUpdate = now;

    const history = new ConfigHistoryEntry();
    history.version = version;
    history.changedCount = changedKeys.length;
    history.changedKeys = changedKeys.join(",");
    history.updatedAt = now;
    history.updatedBy = updatedBy;
    this.state.history.push(history);

    if (this.state.history.length > this.config.maxHistory) {
      this.state.history.shift();
    }

    this.snapshots.set(version, this.exportConfigMap());

    client.send("config_applied", {
      version,
      changedKeys,
      changedCount: changedKeys.length,
      timestamp: now,
    });

    this.broadcast("config_changed", {
      version,
      changedKeys,
      changedCount: changedKeys.length,
      timestamp: now,
    }, { except: client });
  }

  private handleValidateConfig(client: Client, message: any) {
    const input = message?.config;
    const validation = this.validateConfigObject(input);
    this.state.validationStatus = validation.valid ? "valid" : "invalid";
    this.state.validationMessage = validation.message;
    this.state.lastUpdate = Date.now();
    client.send("config_validation_result", {
      ...validation,
      timestamp: Date.now(),
    });
  }

  private handleGetConfigHistory(client: Client, message: any) {
    const limit = Math.max(1, Math.min(500, Number(message?.limit || 50)));
    const records = this.state.history.slice(-limit).map((item) => ({
      version: item.version,
      changedCount: item.changedCount,
      changedKeys: item.changedKeys,
      updatedAt: item.updatedAt,
      updatedBy: item.updatedBy,
    }));

    client.send("config_history", {
      records,
      total: records.length,
      currentVersion: this.state.currentVersion,
      timestamp: Date.now(),
    });
  }

  private handleRollbackConfig(client: Client, message: any) {
    const targetVersion = Number(message?.version);
    if (!Number.isInteger(targetVersion)) {
      client.send("error", { code: "invalid_version", message: "version必须为整数" });
      return;
    }

    const snapshot = this.snapshots.get(targetVersion);
    if (!snapshot) {
      client.send("error", { code: "version_not_found", message: "找不到指定版本快照" });
      return;
    }

    this.state.entries.clear();
    Object.entries(snapshot).forEach(([key, value]) => {
      const entry = new ConfigEntry();
      entry.key = key;
      entry.value = value;
      entry.version = targetVersion;
      entry.updatedAt = Date.now();
      entry.updatedBy = client.sessionId || "system";
      this.state.entries.set(key, entry);
    });

    const now = Date.now();
    const newVersion = this.state.currentVersion + 1;
    this.state.currentVersion = newVersion;
    this.state.lastUpdate = now;
    this.state.validationStatus = "valid";
    this.state.validationMessage = `rolled back from version ${targetVersion}`;

    const history = new ConfigHistoryEntry();
    history.version = newVersion;
    history.changedCount = this.state.entries.size;
    history.changedKeys = "__rollback__";
    history.updatedAt = now;
    history.updatedBy = client.sessionId || "system";
    this.state.history.push(history);
    if (this.state.history.length > this.config.maxHistory) {
      this.state.history.shift();
    }

    this.snapshots.set(newVersion, this.exportConfigMap());

    client.send("config_rollback_done", {
      fromVersion: targetVersion,
      toVersion: newVersion,
      totalKeys: this.state.entries.size,
      timestamp: now,
    });
  }

  private validateConfigObject(input: any): { valid: boolean; message: string; errors: string[] } {
    const errors: string[] = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      errors.push("config必须为对象");
      return { valid: false, message: "配置对象校验失败", errors };
    }

    const keys = Object.keys(input);
    if (keys.length === 0) {
      errors.push("配置对象不能为空");
    }
    if (keys.length > this.config.maxKeys) {
      errors.push(`配置项数量超限: ${keys.length} > ${this.config.maxKeys}`);
    }

    for (const key of keys) {
      if (!key.trim()) {
        errors.push("配置key不能为空字符串");
      }
      const val = input[key];
      const encoded = typeof val === "string" ? val : JSON.stringify(val);
      if (encoded.length > this.config.maxValueLength) {
        errors.push(`配置值超长: ${key}`);
      }
    }

    return {
      valid: errors.length === 0,
      message: errors.length === 0 ? "配置校验通过" : "配置对象校验失败",
      errors,
    };
  }

  private serializeEntries() {
    const entries: Record<string, string> = {};
    this.state.entries.forEach((entry, key) => {
      entries[key] = entry.value;
    });
    return entries;
  }

  private exportConfigMap(): Record<string, string> {
    return this.serializeEntries();
  }

  onJoin(client: Client) {
    logger.info(`[ConfigRoom] 客户端 ${client.sessionId} 加入配置房间`);
    client.send("config_snapshot", {
      version: this.state.currentVersion,
      entries: this.serializeEntries(),
      validationStatus: this.state.validationStatus,
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client) {
    logger.info(`[ConfigRoom] 客户端 ${client.sessionId} 离开配置房间`);
  }
}

export default ConfigRoom;

