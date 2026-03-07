# DS-27: Context Management Standard

/**
 * 宪法依据：
 * - §152 单一真理源公理：T0文档作为系统核心意识的唯一来源
 * - §104 功能分层拓扑公理：定义T0核心层文档管理规则
 * - §101 同步公理：文档变更必须版本化并保持一致性
 * - §141 熵减验证公理：文档大小限制确保系统有序性
 */


**Version**: v1.1.0  
**Last Updated**: 2026-03-01

## Purpose

T0 document management and context loading rules.

## Rules

### T0 Document Lifecycle

| Phase | Action |
|-------|--------|
| Creation | Create all 5 T0 documents in `memory_bank/t0_core/` |
| Loading | Load T0 docs before any task |
| Modification | Update version after changes |
| Verification | Check consistency after updates |

### Document Naming

| Document | Filename |
|----------|----------|
| Active Context | `memory_bank/t0_core/active_context.md` |
| Knowledge Graph | `memory_bank/t0_core/knowledge_graph.md` |
| Basic Law Index | `memory_bank/t0_core/basic_law_index.md` |
| Procedural Law Index | `memory_bank/t0_core/procedural_law_index.md` |
| Technical Law Index | `memory_bank/t0_core/technical_law_index.md` |

## Size Limits

| Document | Max Tokens |
|----------|------------|
| active_context.md | <800 |
| knowledge_graph.md | <1000 |
| basic_law_index.md | <500 |
| procedural_law_index.md | <300 |
| technical_law_index.md | <500 |
