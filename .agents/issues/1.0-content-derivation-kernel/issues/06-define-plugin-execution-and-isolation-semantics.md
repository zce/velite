# Define plugin execution and isolation semantics

Status: resolved
Origin: #393 (deleted from GitHub)
Created: 2026-07-15T12:06:46Z
Type: grilling

---

## Question

What contract determines when Unified/remark/rehype/MDX plugins execute once, execute per derivation, force a branch or clone, or make an artifact ineligible for sharing, while keeping normal ecosystem plugins usable?

## Answer

### Decision

Velite 1.0 uses ordinary Unified, remark, rehype, and `@mdx-js/mdx` plugins. It adds no proprietary plugin execution system and grants no sharing or scheduling privilege based on whether a schema or recipe is built in.

The stable contract is expressed in observable semantics, not processor construction, cloning strategy, or cache machinery:

1. Matching demands may share only a dialect- and parse-profile-compatible pristine parse through the record-scoped Content Artifact Broker.
2. A static, read-only projection may inspect the broker's opaque pristine representation without running transforms. Eligibility depends on behavior, not built-in identity; the custom projection ticket defines how authors express that behavior.
3. A demand that runs transforms, compilation, or effects owns observably independent mutable AST and VFile state. It cannot observe a sibling's mutations or Velite-owned diagnostics, messages, effects, failure, or completion order.
4. One logical, path-aware VFile flows through every Unified/MDX phase of a transforming branch.
5. Primary render/compile and other transform results are not shared by default, and the broker does not build a general transform-prefix DAG.

Velite may satisfy branch isolation by cloning, ownership transfer, copy-on-write, persistent data, independent parsing, or another equivalent strategy. No public contract requires a full deep clone, a cloneability probe, or a reparse after a failed probe. If the implementation cannot establish independent branch state, it must not share that artifact.

### Plugin execution

Unified's normal lifecycle remains authoritative: an attacher runs when its processor freezes, and a returned transformer runs when that processor runs. Velite does not make processor count, processor identity, freeze timing, pooling, copying, serialization, or reuse lifetime observable API guarantees. Implementations may reuse, copy, pool, serialize access to, or concurrently run processors when doing so preserves this contract and ordinary plugin compatibility.

A shareable parse slot invokes its parser once. Remark attachers are established before parsing so normal micromark, mdast, and MDX syntax extensions participate in the pristine parse. Because an ordinary remark attacher may both install syntax extensions and return a transformer, its registration conservatively participates in parse compatibility; Velite does not require a proprietary parse-plugin marker. Static projections use the resulting pristine representation but do not run returned remark transformers.

Each transforming demand runs the phases it requests exactly once:

- Markdown rendering runs its remark and rehype transforms and HTML compiler.
- MDX compilation runs its remark, rehype, and recma transforms and MDX compiler.
- Static `.toc()` and `.excerpt()` run none of those transforms or compilers and do not evaluate JavaScript, ESM, or JSX components.

MDX supports ordinary `recmaPlugins` alongside remark and rehype plugins. Global plugin lists precede root-local lists within the same phase. Composition, duplicate function identity, and option merging otherwise follow normal Unified `.use()` semantics. Velite-owned transforms have documented positions in the concrete pipeline that defines them; this contract does not impose one universal before/after rule on every future transform.

### Responsibility boundary

Velite guarantees isolation only for state it owns: branch AST/VFile state, result/failure containers, diagnostics, messages, and declarative effects. It awaits asynchronous processing and keeps each outcome associated with its demand.

Plugin and configuration authors own plugin option mutation, attacher/transformer closure state, module or process-global state, direct I/O, and other external side effects. Different records and demands may execute concurrently and in any order. Plugins must not require a global document order or unsynchronized shared mutable state for correctness. Velite does not promise to detect or isolate hidden state, nondeterminism, or external effects.

Mutating and asynchronous transformers are normal supported plugins because their Velite-owned branch state is isolated. Hidden state or side effects do not automatically forbid execution, but any result that depends on prior calls, timing, randomness, or external mutation is not safely shareable or cacheable. If such behavior affects parsing, the pristine parse is likewise ineligible for sharing. Exact profile identity and lifetime are deferred to the cache ticket.

### Scope and evidence

The ordinary bug tickets remain contract evidence only: linked-asset transforms must cover the intended MDX forms, comment removal must preserve unrelated content, async property rewrites must not depend on completion order, and one logical VFile must survive all MDX phases. This ticket does not fix those bugs.

Exact cache identity/lifetime, custom projection authoring, effect commit/deduplication, and measurable 20,000-document cold/hot performance criteria remain in their dedicated tickets. This contract deliberately leaves processor and branch materialization strategies open so those tickets and the implementation can optimize them without changing the public plugin semantics.
