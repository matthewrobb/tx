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

## Self-Healing Invalidation

When code changes, the graph doesn't rebuild — it heals surgically:

**1.** Content hashes detect which source files changed
**2.** Provenance edges identify which knowledge entries derived from those files
**3.** Dependency traversal marks transitively affected entries stale
**4.** Early cutoff stops propagation when an entry's output didn't actually change *(e.g., whitespace edit, comment change)*

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
- **Surgical precision** — a file change invalidates only what's affected, not the whole cache
- **Computed critical path** — optimal parallelism derived from the dependency graph, not intuition
- **Zero infrastructure** — everything runs inside a single embedded database in the daemon process

## The Shift

Without this, agents are independent contractors who each survey the job site from scratch. With it, they're a team that shares a living map of the territory — and a dispatcher that knows who should go where and in what order.
