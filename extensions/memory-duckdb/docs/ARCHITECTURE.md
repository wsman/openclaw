# Architecture

`extensions/memory-duckdb` stays the host-side memory extension on the closed
`memory-duckdb / negentropy` integration line:

- `extensions/memory-duckdb` is the host-side memory extension and selected-owner
  candidate
- `extensions/negentropy-lab` remains bridge-only and consumer-only
- `vendor/negentropy-lab` remains a minimal contract mirror
- `smallpond-evo` remains an external capability-plane implementation

## Seam Discipline

`extensions/memory-duckdb` is allowed to:

- act as an OpenClaw host-side memory owner candidate
- expose memory tools, CLI, plugin-owned HTTP routes, diagnostics, and services
  through existing plugin seams
- consume `openclaw/plugin-sdk/*` public subpaths and package-local modules
- freeze package-local `smallpond` read and artifact contracts under
  `src/capability/smallpond/`

`extensions/memory-duckdb` must not:

- import core `src/**`
- import another extension's `src/**`
- import `vendor/negentropy-lab` runtime-owner implementation files
- import `smallpond-evo`
- own raw `smallpond` payloads or raw internal `smallpond` truth tables
- become a control-plane owner or a second parallel memory owner

## Migration Map

This extension absorbs the OpenDoge memory stacks into one OpenClaw-native
package boundary.

Primary migration source:

- `OpenDoge/plugins/memory`

Read-facade migration source only:

- `OpenDoge/plugins/memory-duckdb`

Canonical migration targets include:

- `src/runtime/MemoryDuckdbRuntime.ts`
- `src/diagnostics/DuckDbNativeBinding.ts`
- `src/ingest/*`
- `src/shadow/ShadowReplayManager.ts`
- `src/retrieval/MemoryRetriever.ts`
- `src/reflection/ReflectionRuntime.ts`
- `src/governance/GovernanceRuntime.ts`

## Smallpond Contract Freeze

`E2-A` through `E2-D` freeze the package-local `smallpond` architecture without
introducing direct OpenClaw-to-`smallpond` runtime coupling.

Code truth lives in:

- `src/capability/smallpond/SmallpondArtifactInventory.ts`
- `src/capability/smallpond/SmallpondContracts.ts`
- `src/capability/smallpond/BusinessArtifactMapper.ts`
- `src/capability/smallpond/SmallpondReadAccess.ts`
- `src/capability/smallpond/SmallpondClient.ts`
- `src/capability/smallpond/BusinessKnowledgeSyncService.ts`
- `src/capability/smallpond/ControlPlaneAlignment.ts`

Only approved source views may enter the host pipeline. Approved entry examples
include:

- `v_smallpond_business_facts`
- `v_smallpond_governance_decisions`
- `v_smallpond_evidence_summaries`
- `v_smallpond_advisory_summaries`

The frozen contract families remain:

- `SmallpondReadArtifact`
- `SmallpondKnowledgeIngestArtifact`
- `SmallpondSkillCandidateArtifact`

## Canonical mapping

The first Canonical mapping stays package-local and host-owned:

- `business_fact -> business_fact`
- `governance_decision -> governance_decision`
- `evidence_summary -> evidence_summary`
- `advisory_summary -> lesson` and `operator_pattern`
- `tenant_insight -> tenant_insight`

## Sync Pipeline

The `E2-B` sync pipeline remains:

- startup + manual
- approved source views only
- canonical host `MemoryRecord` materialization
- single-writer queue plus JSONL spool
- no background polling
- no direct `smallpond-evo` runtime/API coupling

Canonical materialization freezes:

- `metadata.smallpond`
- `metadata.knowledge`
- `syncKey = smallpond:`
- `BusinessKnowledgeSyncService`
- `SmallpondClient`

`memory status` and `memory_duckdb_status` expose `businessSync` so operators
can inspect lag, last success, duplicate skips, and failures.

## Skill Candidate Model

The host-local `E2-C` skill candidate model stays on canonical `MemoryRecord`
entries with `metadata.skillCandidate`.

Key frozen elements:

- `Skill Candidate Model`
- `metadata.skillCandidate`
- `SkillCandidateLifecycleState`
- `draft`
- `pending_review`
- `approved`
- selected-owner CLI only for operator flow

The selected-owner skill pipeline still flows through:

- `memory sync-skills`
- `memory skill-candidates list`
- `memory skill-candidates approve`
- `memory skill-candidates archive`
- `syncSkillCandidates`

## Control Plane Alignment

`E2-D` keeps host-visible control-plane alignment local to normalized host
records.

Canonical alignment buckets remain:

- `host_local_only`
- `control_plane_summary`
- `writeback_candidate`
- `projection_only`

Alignment is evaluated from normalized host metadata only:

- `metadata.knowledge.kind`
- `metadata.smallpond.artifactType`
- `metadata.skillCandidate`

The host status surface continues to expose:

- `controlPlaneAlignment`
- `countsByClassification`
- `blockedSampleIds`

This architecture does not add a new CLI command, a new plugin-local mutation
route, or a new plugin SDK seam.
