# Define cache identity, lifetime, and concurrency semantics

Status: resolved
Origin: #395 (deleted from GitHub)
Created: 2026-07-15T12:06:50Z
Type: grilling

---

## Question

How are reusable content computations keyed, scoped, invalidated, awaited, cloned, and released across fields, records, rebuilds, configuration changes, and concurrent async schema evaluation?

## Answer

### Decision and scope

The record-scoped **Content Artifact Broker** guarantees memoization and in-flight coalescing only for matching pristine parses. The contract fixes exact parse compatibility, slot transitions, branch isolation, and release points without introducing profile interning as a public concept, a second incremental cache, configuration cloning/freezing, an abort protocol, a branch scheduler, an LRU, or a numeric memory budget.

The broker factory and dialect adapters belong to one pipeline/configuration epoch. A fresh broker is opened immediately before each record's `safeParseAsync()` and is disposed in a `finally` after that validation attempt completes, fails, throws, or is abandoned. No broker artifact is stored in the Engine, `SessionStore`, `ContentFile`, a schema root, or another record.

### Pristine parse identity

A pristine parse slot has the exact semantic identity:

```text
(
  record origin,
  source path,
  selected text,
  dialect,
  effective parse profile
)
```

The record origin is fixed by the broker scope and need not be repeated in an implementation key, but it remains part of Content Input identity. The source path and selected text are compared exactly, not only by hash. `Markdown` and `MDX` are distinct dialect atoms.

Each schema selects its input before making a request. An explicit string and the file-body fallback may use the same slot only when they occur in the same record broker, have the same source path, select code-unit-identical text, and have the same dialect and parse profile. Selection provenance (`explicit` versus `fallback`) is not an additional discriminator after those facts match because it is not visible to parsing. Explicit text that differs from the file body never shares the body's slot.

The effective parse profile contains only configuration that can affect the pristine parse:

- the resolved GFM setting and every other dialect/parser syntax option;
- Velite-owned parser registrations and options; and
- every ordinary remark plugin registration, conservatively, because an attacher may install parser syntax even when it also returns a transformer.

The effective remark sequence is global registrations followed by root-local registrations, preserving registration order and duplicates. Rehype and recma registrations, Markdown rendering options, MDX compile/minify/output options, linked-file transforms, and projection parameters do not enter parse identity because they execute after the pristine parse. They remain part of their branch request where relevant.

### Exact profile comparison

Equivalent independently-created roots resolve to equivalent profiles; root object identity is never considered. Profile comparison uses the following concrete normalization:

1. `null`, `undefined`, booleans, strings, and bigints normalize by type and exact value. Numbers use `Object.is` semantics so `NaN` is stable and `0` remains distinct from `-0`. Symbols compare by symbol identity.
2. A bare plugin registration and a one-element plugin tuple normalize to the same registration. A tuple is otherwise the ordered sequence `[plugin, ...arguments]`; the plugin function, argument count, argument order, and every argument participate.
3. Plugin functions and any nested function values compare by JavaScript reference identity. Distinct closures never become equivalent from their source text or name. A profile resolver may assign them WeakMap-backed IDs in the current pipeline/configuration epoch for indexing, but exact equality still requires the same function reference and IDs never cross epochs.
4. Arrays preserve order, length, and holes. Plain objects with only ordinary data properties normalize structurally with string keys in deterministic sorted order. Their recursively normalized values participate in full equality, so separately allocated ordinary option literals can be equivalent.
5. A value conservatively falls back to reference identity when it has a non-plain prototype, an accessor, a symbol or non-enumerable property, a repeated object reference, a cycle, or another representation that cannot be traversed as ordinary plain data without changing observable semantics. Two separately allocated opaque or cyclic values therefore do not match; repeated use of the same reference may match.
6. Global and root-local plugin lists are normalized only after their effective ordering is established. List order and duplicates remain observable and are never sorted or deduplicated.

Normalization produces an immutable identity descriptor, not a cloned execution option. Plugins continue to receive their ordinary configured values. Root and global configuration, including plugin tuples and option objects, is contractually immutable after the effective profile is established. Velite does not freeze, clone, watch, or invalidate after external mutation; mutating such configuration is unsupported and a config reload is the supported way to establish a new profile.

Hashing is optional and may select a candidate bucket, but a hash is never identity. A candidate slot is reused only after exact source-text, path, dialect, and normalized-profile equality succeeds. Therefore a hash collision can reduce performance but cannot cause two different profiles to share.

### Parse and projection requests

The parse request owns the identity above. The projection request separately names the demanded Velite-owned static or transforming recipe and its branch-only options. Projection identity never fragments a compatible parse slot.

Only the pristine parse slot is memoized:

- matching root, TOC, and excerpt demands may await one pristine parse;
- every static projection executes for its own demand and its result is not cached;
- every Markdown render, MDX compile/minify, or other transforming demand executes its own branch and its result is not cached;
- primary results, transform prefixes, branch outcomes, diagnostics, effects, AST clones, and VFiles are not reusable cache entries.

This deliberately does not create a general projection-result cache or transform-prefix graph.

### Slot and broker state machine

A live broker contains zero or more parse slots. For a particular exact identity, the state machine is:

```text
empty (no slot)
  -> pending
  -> fulfilled
  -> rejected

active broker
  -> disposed (terminal)
```

On the first demand, the broker creates and indexes a `pending` slot synchronously before invoking or scheduling parser work. A matching concurrent demand receives the exact same pending promise. The slot transitions once to `fulfilled` with the opaque pristine artifact, or once to `rejected` with the immutable parse failure outcome. Both terminal slot outcomes remain memoized until broker disposal; rejection is not retried within the record.

Disposal is idempotent and terminal. It marks the broker disposed before clearing its slot index and retained pristine/failure references. New demand after disposal fails with an internal lifecycle error. Already-started JavaScript promises are not forcibly interrupted; they may settle for existing waiters, but their outcomes are not reinserted or committed through the disposed broker.

Validation must use `try/finally` so disposal occurs after successful parsing, Zod validation failure, an escaping exception, or surrounding cancellation/abandonment. The narrow record-bound content capability cannot outlive its context in supported use.

### Concurrency and failure rules

- Two matching sibling demands that arrive while the slot is pending await the same parse promise. Which sibling arrived first or finishes its projection first has no effect on result association or canonical output ordering.
- A consumer's schema-adaptation failure affects only that demand. It does not reject, evict, or cancel a fulfilled or pending shared parse.
- A transforming branch failure is branch-local. It releases that branch's AST, VFile, messages, diagnostics, effects, and outcome after adaptation and does not alter the pristine slot or another branch.
- A parse failure rejects every matching waiter with the retained parse failure and prevents another matching parse attempt in that record. Unrelated identities remain independent and may proceed concurrently.
- The broker exposes no consumer cancellation interface in 1.0. One consumer therefore cannot cancel a shared parse. If record validation is abandoned or throws, `finally` disposes the broker and commit state is discarded according to the validation/effects boundary; already-started parser or plugin promises follow ordinary JavaScript settlement semantics.
- The broker adds no branch queue or ordering guarantee. A demand starts at most its own branch after obtaining the pristine artifact, and concurrent branch count is bounded structurally by unresolved schema demands. Plugins must already tolerate the cross-demand and cross-record concurrency defined by the plugin contract.
- A config reload creates a new pipeline, broker factory, profile-resolution namespace, and record brokers. Old-epoch and new-epoch requests never share even if their visible configuration is equal. Current build serialization may prevent overlap, but correctness does not depend on overlap being impossible.

Canonical values, diagnostics, and effects must still be associated with their requesting fields and merged at their defined commit boundary rather than completion order. The detailed effect ordering/deduplication contract remains outside this ticket.

### Lifetime, retention, and resource ownership

The fulfilled slot owns the pristine AST and the immutable parse-time VFile seed needed to create branches. They live until record broker disposal. A static projection may read the opaque pristine representation only for the duration of its demand. A transforming branch owns an observably isolated mutable AST and logical VFile from branch creation until that demand settles; the branch adapter releases all references in its completion path.

There is no numeric broker memory limit in the 1.0 semantic contract. Its structural upper bound is one retained slot per distinct demanded parse identity in one record, plus one temporary branch state per unresolved transforming demand. Evicting a live slot would violate the matching-parse memoization guarantee, while a numeric branch scheduler is not justified by current evidence. A future implementation may optimize representation or scheduling only if these observable semantics remain unchanged.

No pristine parse, failure, clone, VFile, branch outcome, or projection result survives record completion. Consequently:

- another record with identical source text does not share it;
- another record from the same source does not share it;
- an incremental or watch rebuild opens new brokers for records that are actually revalidated;
- unchanged validation may still be skipped by the existing Engine, but the Engine does not retain broker artifacts;
- a config reload invalidates all old profiles by replacing the pipeline epoch rather than walking or invalidating cache entries.

This record lifetime is the complete 1.0 cache lifetime. Cross-record content addressing and cross-rebuild artifact retention would constitute a second incremental cache system and are explicitly excluded.

### Prototype evidence

The throwaway model and report are in `.agents/sessions/20260717-2054-cache-semantics/`. It verifies equivalent-root normalization, mismatch separation under forced hash collisions, pending-promise installation before parsing, rejected-parse memoization, post-disposal rejection, and conservative cyclic/opaque handling. The prototype is evidence for the state and equality rules only, not a prescribed production data structure. No product code was modified.
