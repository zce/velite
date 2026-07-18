# Reconcile parse sharing and VFile continuity

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 01, 05, 06, 08

---

## Question

How can one pristine parse be shared while each transforming branch observes the promised logical VFile continuity, and what explicit contract determines whether parser extensions with hidden mutable state are eligible for the mandatory matching-profile parse slot?

## Review context

The current decisions alternately describe a parse-time VFile seed, a fresh branch VFile, and one VFile across parse/run/stringify. Define the observable seed-copy or identity rule, including `path`, `history`, `data`, and `messages`. Also resolve the contradiction between mandatory exact-profile coalescing and the statement that hidden state can make an otherwise matching parse ineligible when no opt-out mechanism exists.

## Answer

### Selected decision

Matching demands continue to coalesce one pristine parse exactly as required by tickets 05 and 08. The shared parse uses one internal, path-aware parse VFile and produces an opaque pristine artifact containing a pristine tree and a branch-materializable VFile seed. The parse VFile itself never enters a transforming branch.

Every transforming branch receives an observably independent tree and a fresh VFile materialized from the seed. After materialization, that same branch VFile object is passed through all remark, rehype, recma, run, stringify, and compile phases executed by that branch. Sibling branches never share mutable AST, VFile, data, message, diagnostic, effect, result, or failure objects.

"One logical VFile" therefore means continuity of the explicitly supported observable state from parse into a branch, followed by object-identity continuity within that branch. It does not mean that the parse VFile and a branch VFile are the same object, and it does not mean that one VFile object can belong to multiple branches.

Static projections read only the dialect-correct opaque pristine representation. They do not run returned transformers or compilers and do not create a transforming branch VFile unless an unobservable adapter implementation detail requires a temporary object. Such a temporary object cannot weaken any static-projection or isolation oracle.

### Internal pristine artifact and seed interface

The minimum conceptual interface is:

```ts
interface PristineArtifact {
  readonly tree: OpaquePristineTree
  readonly fileSeed: VFileSeed
}

interface VFileSeed {
  readonly cwd: string
  readonly history: readonly string[]
  readonly data: SupportedDataSnapshot
  readonly messages: readonly ParseMessageSeed[]
}

interface ContentDialectAdapter {
  parse(input: ParseInput): Promise<PristineArtifact>
  materializeBranch(artifact: PristineArtifact): ContentBranch
}

interface ContentBranch {
  readonly tree: OpaqueBranchTree
  readonly file: VFile
}
```

These names are conceptual and may change. Their semantics may not. `PristineArtifact`, `VFileSeed`, `ParseMessageSeed`, the opaque trees, branch materialization, and compatibility machinery are internal dialect-adapter responsibilities. They must not appear in the root package exports, built public declarations, export map, runtime reflection, `SchemaContext`, `ContentFile`, or a custom projection protocol.

The fulfilled parse slot owns the pristine tree and seed until record-broker disposal. The seed is captured after parsing and all parse-phase work have completed successfully, before any transforming branch starts. The parse VFile and plugin-held source objects are not retained as the seed. The implementation need not recursively freeze user data at runtime: immutability means that the seed is encapsulated, never exposed or modified, and independently copied for every branch. An implementation may use frozen values, persistent data, copy-on-write, or another representation if the observable tests remain unchanged.

### Path and path-derived state

The dialect adapter creates the parse VFile with the selected source text as its value, the exact Content Input source path as its initial path, and the current pipeline epoch's canonical project root as its cwd. Parser plugins therefore observe the same canonical source path that participates in parse identity.

After parsing, the seed stores the final `cwd` and the complete `history` in order. The history must be non-empty and its final entry is the current path. A parser's legal path changes are therefore visible in every branch. A branch restores the original selected text as its initial VFile value and reconstructs path state from a fresh copy of `history` plus `cwd`.

`path`, `basename`, `stem`, `extname`, and `dirname` are not independent competing seed values. Current `path` is the last history entry; the other values are derived by VFile from that path. An implementation must not copy path-derived setters in an order that adds history entries or changes the final path. Parse-time mutation of `value`, `map`, `result`, or `stored` is outside the seed contract and is not propagated. Arbitrary top-level enumerable or custom VFile fields are also outside the contract.

### Data snapshot and copy semantics

`file.data` is snapshotted after successful parsing. The contract is defined by a Velite-owned supported-data graph, not by whichever values the host's `structuredClone()` happens to accept.

Supported values are `null`, `undefined`, booleans, strings, numbers, bigints, arrays, and plain objects whose prototypes are `Object.prototype` or `null`. Arrays preserve length, order, and holes. Plain objects preserve enumerable own string-keyed data properties. Repeated references and cycles are supported and retain their graph topology inside each copy.

Each branch receives a new root data object and a recursively independent copy of every supported mutable node. No mutable node in branch A, branch B, the parse VFile, or the seed is shared. Mutating a source object still held by a parser plugin after snapshot creation cannot alter the seed.

Functions, symbol values, class instances, dates, maps, sets, typed arrays, weak collections, accessors, symbol-keyed properties, non-enumerable custom properties, proxies that throw during safe descriptor inspection, and other opaque values are unsupported. The copier must inspect property descriptors without invoking getters. It must never preserve an unsupported value by reference and must never silently omit an unsupported own property.

This is an observable value contract, not a required cloning algorithm. A later implementation can replace eager copying with persistent data or copy-on-write only if all identity, mutation-isolation, cycle, alias, and failure tests continue to pass.

### Parse message snapshot and copy semantics

Parse messages are snapshotted in their parse VFile array order. Every transforming branch starts with those messages exactly once, before messages emitted by that branch. Every branch receives a fresh messages array and fresh VFileMessage-compatible message objects.

The seed preserves the standard reportable fields: `reason`/`message`, `fatal`, `file`, `name`, `line`, `column`, `place`, `source`, `ruleId`, `actual`, `expected`, `note`, `url`, and `stack`. Supported `place`, `expected`, and `ancestors` values use the supported-data graph copier and are independent per branch. A non-empty opaque `cause`, unsupported ancestor graph, or unsupported custom message field makes seed materialization deterministically unsupported; it is never reference-shared or silently discarded.

Message order and source/rule provenance remain unchanged. Branch messages append after the copied parse messages. Diagnostics are normalized from the completed branch outcome once at the branch-to-validation seam. Copying a parse message into multiple branch VFiles must not itself submit diagnostics or effects, and parse diagnostics must not be omitted, duplicated within one demand, or associated with a sibling demand.

### Branch materialization and isolation

For each transforming demand, the dialect adapter materializes a fresh tree and VFile from the fulfilled artifact. The branch owns them until that demand settles. Each branch has different VFile, tree, data-root, messages-array, and message-object identities. Supported nested data and message objects are also independent.

The exact same branch VFile object is supplied to every processing and compilation phase in that branch. A branch may mutate its path/history, data, and messages, and later phases in that branch observe those mutations. No mutation, completion order, rejection, diagnostic, or effect from one branch can alter the pristine slot or another branch.

This resolves the apparent parse-once conflict: parse-time state continuity crosses the sharing seam by value through the seed, while identity continuity begins at branch materialization. There is one parse identity and zero or more independent branch identities.

Markdown and MDX use the same logical contract but may use different adapter implementations. Processor construction, freeze timing, pooling, locks, clone representation, and manual phase mechanics remain unobservable. In particular, the current `@mdx-js/mdx` `parse -> run(mdast) -> stringify` path guarded by `@ts-expect-error` is not a 1.0 stable seam. The MDX adapter should prefer an officially supported processing path; if it retains a manual split, it explicitly owns compatibility and tests it without exposing that split publicly.

### Parser attachers, transformers, and sharing eligibility

The complete effective remark registration sequence remains part of parse profile identity because an attacher can install parser syntax extensions and also return a transformer. Attachers execute according to ordinary Unified processor-freeze semantics. Syntax extensions participate in the pristine parse. A returned transformer does not run during the pristine parse or a static projection; it runs exactly once in each transforming branch that requests its phase.

Velite does not guarantee attacher count, processor count or identity, freeze timing, processor reuse, pooling, or serialization. Fixed-profile parser participants must be deterministic and reentrant and must not require prior-call state, hidden mutable closure or global state, randomness, timing, external mutation, or global document order for correct parsing. Plugin and configuration authors own those properties.

Matching exact profiles always use the mandatory parse slot. Velite 1.0 adds no public or internal no-share/uncached marker, does not inspect closure state, does not infer eligibility from function names or identities beyond profile equality, and does not probe by executing a parser twice. It does not clone, serialize, lock, or otherwise isolate plugin closure/global state as a correctness mechanism. Serializing processor access does not repair prior-call dependence, randomness, or external state and is not a stateful-plugin compatibility promise.

A parser plugin that violates these responsibilities has documented unsupported behavior. Velite must not silently or nondeterministically switch between shared and unshared parsing. Stateful parser fixtures document this negative contract; they are not expected to produce a supported deterministic result.

### Error and failure behavior

Ordinary content syntax failures and parser-plugin failures become the retained parse failure outcome for the exact slot. Matching waiters observe that one failure and no matching reparse is scheduled. User content failures remain diagnostic data and are not mislabeled as internal errors.

Encountering an unsupported plugin-written data or message value while building the seed deterministically rejects the parse artifact as a plugin/configuration compatibility diagnostic. The rejected outcome is retained for matching waiters. Velite does not drop the field, share it by reference, retry with unshared parsing, or dynamically change eligibility.

An implementation defect after supported seed validation, such as losing required history, producing shared branch objects, or violating the materializer's own invariant, throws `VeliteError('internal')`. A branch materialization invariant failure is reported by the broker through that internal channel. This is distinct from unsupported plugin state and ordinary content or plugin diagnostics.

Transformer and compiler failures are branch-local. They release that branch's state after adaptation and do not reject, evict, or modify a fulfilled pristine slot or sibling branch. A sibling failure cannot submit another branch's diagnostics or effects.

Disposal and reload preserve ticket 08's lifecycle contract. A disposed broker rejects late demand or materialization with the existing internal lifecycle error. Already-started promises may settle only for existing waiters and cannot reinsert state. Disposal releases all retained trees, seeds, parse failures, branch VFiles, and branches. A config reload creates a new epoch, adapters, profile namespace, slots, seeds, and branches; no old-epoch seed or VFile is reused.

### Alternatives rejected

1. Sharing the parse-time VFile object across all branches is rejected because branch mutations, messages, failures, and completion order would leak even if processor access were serialized.
2. Reparsing every transforming branch is rejected as the default because it violates mandatory matching-profile parse-once semantics and discards the measured benefit the broker exists to provide.
3. A public parser-plugin `noShare` marker is rejected because it expands the extension surface, fragments exact-profile sharing, and still cannot describe hidden transitive state reliably.
4. Internal heuristics, closure inspection, plugin-identity guesses, or runtime probes are rejected because hidden state is not reliably observable and probing can execute side effects twice.
5. Serializing parser or processor access as a stateful-plugin compatibility mechanism is rejected because it cannot fix prior-call dependence, randomness, process-global state, or external mutation.
6. Cloning the complete VFile instance is rejected because VFile construction is shallow for ordinary fields and would accidentally make arbitrary custom fields part of Velite's contract.
7. Reference-sharing opaque or non-cloneable `file.data` values is rejected because it directly violates branch isolation.
8. Copying only the explicit `cwd`, `history`, supported `data`, and supported `messages` seed is selected. Other path values are derived; arbitrary fields are unsupported.
9. Exposing VFile, the pristine AST, seed, or artifact through public `SchemaContext`, `ContentFile`, or a generic projection protocol is rejected by the established custom-schema seam and would turn internal representation into a compatibility obligation.

### Migration and architecture consequences

The implementation work must update `.agents/knowledge/module-architecture.md` to name pristine parsing, seed ownership, and branch materialization as internal responsibilities of the explicitly assembled Markdown/MDX dialect adapters. It must preserve factory DI and epoch ownership and must not create a public adapter registry or hidden singleton.

The implementation work must update the applicable content/plugin/schema-context knowledge or documentation to state that the public promise is logical observable continuity, not identity across parse and branches; matching parse sharing and branch state isolation hold simultaneously; only the listed seed fields and values are supported; parser participants are deterministic and reentrant; hidden mutable state is not detected; and 1.0 has no no-share marker.

Documentation must distinguish unsupported plugin behavior from Velite internal invariant failures. VFile, AST, seed, pristine representation, broker, and compatibility markers remain absent from public schema context and extension surfaces. Migration guidance must document parser-plugin responsibility, the supported data/message subset, deterministic rejection of unsupported seed state, and the absence of an opt-out marker. It must not promise that processor construction or the current manual MDX split remains stable.

Bug 17 is unblocked and returns to `ready-for-agent`. Its implementation must use the exact contract here: canonical parse path/cwd, final history seed, supported data and parse-message propagation by independent copies, one VFile identity within each MDX transforming branch, and no sibling leakage. It must not require the parse VFile object to enter a branch. Tickets 23 and 24 must preserve one-time branch diagnostic/effect adaptation and epoch disposal/publication respectively.

### Test oracle and acceptance tests

1. Matching root and sibling projection demands parse once, including concurrent pending demands.
2. Markdown and MDX select dialect-correct independent parse slots.
3. The parse VFile receives the canonical source path, project cwd, and selected source value.
4. A fulfilled artifact preserves the final cwd and ordered history, and a branch derives the expected path, basename, stem, extname, and dirname without adding history entries.
5. Supported parser-written `file.data` is visible in every transforming branch.
6. Supported parse messages are visible exactly once in every branch with stable order and provenance.
7. Sibling branches receive different VFile and AST objects.
8. Sibling branches receive different data roots, messages arrays, message objects, and supported nested mutable objects.
9. Branch A mutations to path/history, data, messages, or message fields do not affect branch B or the pristine seed.
10. Branch run and stringify/compile phases observe the exact same branch VFile object identity.
11. An MDX branch's remark, rehype, recma, and compiler phases satisfy the final logical-continuity contract.
12. Static TOC, excerpt, and metadata projections run no returned transformers or compilers and do not require a transforming branch.
13. Static projections cannot modify the pristine tree or seed.
14. Parallel branch completion order does not alter outcomes, message order, diagnostic association, or effect association.
15. A rejected parse executes once and is shared by all matching waiters.
16. A branch failure does not invalidate a fulfilled pristine parse or contaminate a sibling.
17. Parse messages are normalized into diagnostics once per demand; seed copying itself submits no diagnostics or effects.
18. Record-broker disposal leaves no retained tree, seed, parse VFile, branch VFile, or branch object.
19. A new config epoch does not reuse an old seed, branch VFile, or profile namespace.
20. A stateful parser fixture is documented and tested as unsupported behavior, not as a trigger for nondeterministic cache eligibility.
21. Supported cyclic and repeated-reference data graphs preserve topology within a branch while remaining independent across branches.
22. Functions, class instances, symbols, accessors, opaque causes, unsupported message fields, and other unsupported values produce the deterministic compatibility failure; none are reference-shared or silently omitted.
23. Root-package exports, built declarations, export maps, and runtime reflection expose no no-share marker, VFile seed, pristine artifact, AST, branch materializer, or compatibility protocol.
24. Bug 17 has explicit path, history, data, messages, phase-identity, and sibling-isolation regression coverage.
25. The observable suite remains valid if an implementation later replaces eager clone with copy-on-write, persistent data, or another equivalent strategy.

### Superseded clauses

Ticket 06's statement that hidden state affecting parsing makes an otherwise matching pristine parse "ineligible for sharing" is superseded. There is no reliable eligibility test or opt-out mechanism. The replacement contract is mandatory exact-profile coalescing plus the deterministic/reentrant parser-plugin responsibility defined here.

Ticket 06 and bug 17's phrase "one logical VFile" is narrowed where it could be read as one object spanning a shared parse and every branch. It now means supported state continuity across the seed seam and object-identity continuity only after each branch is materialized.

Ticket 05's reference to a branch receiving "other mutable VFile state" is narrowed to the exact supported seed fields and values defined here; it does not promise arbitrary VFile-field cloning.
