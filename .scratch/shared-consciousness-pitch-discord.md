# Shared Consciousness Layer

A persistent, self-healing knowledge graph embedded in the workflow engine that gives all agents a shared understanding of the codebase — and uses that understanding to orchestrate their work.

## The Problem

In agentic development, sub-agents are stateless. Every agent invocation starts blind, pays the full cost of exploring the codebase, builds a mental model, does its work, and then that understanding evaporates. When the next agent spins up, it does it all over again. Multiply this across parallel work streams and the redundant token spend becomes the dominant cost.

## What It Is

An embedded graph database (PGLite + pgvector + Apache AGE) running inside the workflow daemon. Three query surfaces over one knowledge store:

- **Semantic** — "what do we know about authentication?" *(pgvector similarity)*
- **Structural** — "what depends on this interface?" *(Cypher graph traversal)*
- **Hybrid** — semantic match, then expand the dependency neighborhood

Agents read before exploring and write after discovering. The first agent in a cycle pays the exploration cost. Every agent after that inherits the accumulated understanding.

## How It's Built

Two data sources feed the graph:

**LSP (structural ground truth)** — At cycle start, the daemon queries the project's language server for the full symbol graph: every definition, every reference, every call hierarchy, every type signature. This is compiler-grade accuracy — not regex parsing, not heuristics. The LSP already maintains an incremental model of the codebase internally, so the snapshot is fast and precise.

**Agent exploration (semantic knowledge)** — As agents work, they contribute understanding the LSP can't provide: architectural rationale, design patterns, "why is it this way." These entries layer on top of the structural graph, linked to the same nodes.

The split:

- **LSP provides** — symbols, references, types, call hierarchy, import graph
- **Agents provide** — rationale, patterns, context, "what I learned exploring this"
- **pgvector enables** — fuzzy retrieval across both
- **Commits trigger** — invalidation

## Lifecycle

**Cycle start — snapshot:** The daemon queries the LSP for the full symbol graph and hashes every source file. This is the one expensive pass. The graph starts with structural nodes (files, symbols, dependencies) and gets enriched with semantic knowledge as agents explore.

**During the cycle — commit-driven invalidation:** Each commit is a manifest of exactly which files changed. The daemon diffs file hashes against the graph, marks affected entries stale, and walks dependency edges to propagate. No file watchers, no polling — commits are the perfect invalidation signal because they're atomic and tell you exactly what changed.

Since the daemon serializes all agent requests through its queue: commit lands → invalidation runs → next agent gets fresh state. No race conditions.

## Self-Healing Invalidation

When code changes, the graph doesn't rebuild — it heals surgically:

**1.** Content hashes detect which source files changed
**2.** LSP provides the precise blast radius — what symbols were affected, what references them
**3.** Provenance edges identify which knowledge entries derived from those symbols
**4.** Dependency traversal marks transitively affected entries stale
**5.** Early cutoff stops propagation when an entry's output didn't actually change *(e.g., whitespace edit, comment change, function body edit that doesn't alter the signature)*

Stale entries are excluded from queries or recomputed lazily when the next agent touches that area.

## Planning-Aware Orchestration

The same graph that stores codebase knowledge also connects issues, stories, and artifacts as nodes. This means the engine can reason about work scheduling:

- Predict which planned work will invalidate which knowledge regions
- Identify shared dependency clusters between parallel work streams
- Compute dispatch order that minimizes total invalidation cost
- Front-load work that unblocks the most downstream knowledge
- Serialize work that shares dependency neighborhoods — not because of code conflicts, but because the second agent would waste tokens re-exploring what the first one just changed

**The planning query becomes:** given N work items and the current knowledge graph, find the dispatch order that minimizes redundant exploration.

## What It Enables

- **Explore once, know everywhere** — understanding persists across agent invocations within a cycle
- **Semantic recall** — agents describe what they need, not exact file paths
- **Compiler-grade structure** — the graph knows every symbol, reference, and type relationship via LSP
- **Surgical precision** — a file change invalidates only what's affected, not the whole cache
- **Computed critical path** — optimal parallelism derived from the dependency graph, not intuition
- **Zero infrastructure** — everything runs inside a single embedded database in the daemon process

## The Shift

Without this, agents are independent contractors who each survey the job site from scratch. With it, they're a team that shares a living map of the territory — and a dispatcher that knows who should go where and in what order.
