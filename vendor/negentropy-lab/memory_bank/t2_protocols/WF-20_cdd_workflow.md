# WF-201: CDD Main Workflow

/**
 * 宪法依据：
 * - §201 CDD工作流规范：定义宪法驱动开发的五状态核心流程
 * - §152 单一真理源公理：T0/T1文档作为流程执行的基准
 * - §141 熵减验证公理：验证系统熵值 H_sys ≤ 0.3
 * - §104 功能分层拓扑公理：遵循T0-T3四层架构执行
 * - §101 同步公理：代码与文档变更同步
 */


**Version**: v1.0.0  
**Last Updated**: 2026-02-01

## Five-State Workflow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ State A  │ ──→ │ State B  │ ──→ │ State C  │ ──→ │ State D  │ ──→ │ State E  │
│ 基准摄入 │     │ 文档规划 │     │ 受控执行 │     │ 三级验证 │     │ 收敛纠错 │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

## State A: Context Ingestion
- Load all T0 documents from `memory_bank/t0_core/`
- Load relevant T1 documents from `memory_bank/t1_axioms/`
- Calculate $H_{sys}$

## State B: Documentation First
- Draft DS-050 (Feature Specification)
- Draft DS-051 (Implementation Plan)
- Wait for user approval (YES)

## State C: Safe Implementation
- Execute according to DS-052 (Atomic Tasks)
- Follow `memory_bank/t1_axioms/behavior_context.md` constraints
- Use parameterized queries

## State D: Three-Tier Verification
- **Tier 1**: Structure check (`memory_bank/t1_axioms/system_patterns.md`)
- **Tier 2**: Signature check (`memory_bank/t1_axioms/tech_context.md`)
- **Tier 3**: Behavior check (`memory_bank/t1_axioms/behavior_context.md`)

## State E: Converge & Calibrate
- Update `memory_bank/t0_core/active_context.md`
- Verify $H_{sys} \leq 0.3$
- Complete task
