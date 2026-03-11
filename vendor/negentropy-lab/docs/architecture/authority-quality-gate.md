# Authority Quality Gate

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for deciding which files belong to the authority, governance, collaboration, interfaces, and integration quality gates.

## Goal

Establish an Authority-specific quality gate that measures the transformed authoritative core without being diluted by unrelated legacy modules.

## Scope

The Authority coverage gate targets the hot-path core modules only:

- authority runtime composition
- tool bridge and event persistence
- replication and recovery hot path
- entropy / breaker governance hot path
- choreography hot path

Transport adapters such as the large server bootstrap remain validated by dedicated end-to-end tests and are not used as coverage gate numerators.
High-branch foundational helpers such as the generic mutation and snapshot hydration layers remain under targeted tests plus end-to-end acceptance until their branch matrices are flattened in a follow-up round.

## Thresholds

- Statements `>= 80`
- Branches `>= 75`
- Functions `>= 70`
- Lines `>= 80`

## Acceptance Layers

1. `build:server`
2. Authority targeted tests
3. Authority targeted coverage gate
4. Authority end-to-end acceptance test

## Constitutional Mapping

- `§101`: authority write mode remains the single source of truth
- `§102`: avoid global-noise coverage gates for local authoritative changes
- `§108.1`: explicit model/provider checks stay under automated tests
- `§130`: department/tool boundaries stay under automated tests
- `§151`: snapshot / recovery stays under automated tests
