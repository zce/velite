# Define asset effects, diagnostics, and failure semantics

Status: resolved
Origin: #396 (deleted from GitHub)
Created: 2026-07-15T12:06:53Z
Type: grilling

---

## Question

How should asset collection, other processing effects, diagnostics, cancellation, and partial failures behave when multiple derivations share or branch processing work?

## Answer

### Decision and terminology

Velite 1.0 treats schema effects as an owner- and provenance-bearing **declarative set**, not as an execution event log. Execution may discover facts speculatively, but only transactions at the branch, record, build, and successful-build boundaries determine which facts become candidates or committed state. Promise completion order, cache-hit order, and `collectEffect` call timing have no semantic meaning.

The minimum transaction unit for schema results is a record. A branch first produces an isolated outcome; a schema adapter associates that outcome with one field; and validation commits values and effects only if the entire record remains valid. If any field invalidates the record, all effects from every field in that record are discarded, including effects from successful siblings. Applicable diagnostics are retained. This directly resolves [Discard schema effects collected by invalid records](12-discard-schema-effects-collected-by-invalid-records.md): an invalid record never participates in uniqueness candidates and never contributes a committed asset reference.

Four states must remain distinct:

1. **Branch-local collection** is an isolated result of one demand.
2. **Valid-record candidate** contains a whole record and its effects after local schema validation.
3. **Source/build candidate** contains locally valid records while cross-file checks and output preparation run.
4. **Successful-build committed state** is the last complete full build or incremental patch accepted by all fatal gates.

Speculative computation is not commitment. Velite may read, probe, blur, and hash assets before record validity is known, but the resulting cache entries or temporary bytes do not make an invalid record live and do not authorize output publication.

### Branch outcome and failure classification

Every broker demand has one immutable branch-local outcome. Conceptually it contains:

```ts
interface ContentBranchOutcome<T> {
  readonly request: ContentArtifactRequestIdentity
  readonly owner: RecordOwner
  readonly source: SourceProvenance
  readonly path: readonly (string | number)[]
  readonly projection: ProjectionProvenance
  readonly status: 'success' | 'failure'
  readonly value?: T
  readonly failure?: BranchFailure
  readonly issues: readonly ZodIssue[]
  readonly messages: readonly NormalizedVFileMessage[]
  readonly diagnostics: readonly Diagnostic[]
  readonly effects: readonly ProvenancedEffect[]
}
```

`value` exists only on success and `failure` only on failure. The concrete representation may use a discriminated union instead of optional properties. Request provenance identifies the controlled recipe and stable request ordinal; owner provenance identifies collection, source, record identity/index; source provenance identifies the selected Content Input and source path; field provenance carries the full schema path; projection provenance identifies the root/sibling projection and any source occurrence relevant to it. A normalized VFile message retains its original reason, position, rule/source metadata, severity, and cause without exposing a mutable branch VFile.

Branch outcomes, diagnostics, effects, and projection results are never memoized. A matching rejected pristine parse remains memoized only as the shared root cause in its record broker. Every demanding field still receives its own associated failure outcome and diagnostic path.

| Failure or message                                              | Diagnostic stage and severity                                     | Build-fatal by default | Invalidates                       | Direct internal throw          |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------- | --------------------------------- | ------------------------------ |
| Markdown/MDX parse failure caused by content                    | `schema`, `error`                                                 | No                     | Field and record                  | No                             |
| Velite-owned static projection failure caused by content        | `schema`, `error`                                                 | No                     | Field and record                  | No                             |
| User remark/rehype/recma plugin throw                           | `schema`, `error`                                                 | No                     | Demanding field and record        | No                             |
| VFile info or warning                                           | `schema`, `info` or `warn`                                        | No                     | Nothing; branch may succeed       | No                             |
| VFile error/fatal message                                       | `schema`, `error`                                                 | No                     | Demanding field and record        | No                             |
| Markdown render, MDX compile, or minify failure                 | `schema`, `error`                                                 | No                     | Demanding field and record        | No                             |
| Missing or unreadable referenced asset                          | `asset`, `error`                                                  | Yes                    | Demanding field/record and build  | No                             |
| Corrupt/unsupported image probe or requested blur failure       | `schema`, `error`                                                 | No                     | Demanding field and record        | No                             |
| Velite-owned asset or data write failure                        | `output`, `error`                                                 | Yes                    | Build                             | No                             |
| Custom schema Zod issue                                         | `schema`, severity implied by the issue mapping, normally `error` | No                     | Its normal Zod field/record scope | No                             |
| `prepare` throw or rejection                                    | `prepare`, `error`                                                | Yes                    | Build                             | No                             |
| Broker use after disposal or another broker lifecycle violation | None                                                              | N/A                    | Current operation                 | Yes, `VeliteError('internal')` |
| Impossible Velite internal state or violated invariant          | None                                                              | N/A                    | Current operation                 | Yes, `VeliteError('internal')` |

An exception is classified by responsibility, not merely by where it was caught. Expected malformed user content, user plugin failure, or unavailable user asset becomes diagnostic data. A state that cannot occur under the Velite implementation contract is an internal invariant failure. Plugin-owned direct I/O, global mutation, randomness, closure state, and other external side effects remain outside Velite's rollback guarantees.

Schema errors remain non-fatal unless the public facade's `strict` policy upgrades them. That policy must be applied before publication: a strict-upgraded run is a failed build and commits no new data, effects, manifest, or asset references. The driver may collect all diagnostics first, but the facade policy remains the authority for this upgrade.

A shared parse failure has one retained immutable root cause in the matching parse slot and one field-associated diagnostic for every demand. Each association carries its own schema path, request, projection, record, and source provenance. Programmatic diagnostic results must not deduplicate those associations. A presentation layer may visually group them under one root cause, but it must still expose every affected field.

### Transaction state table

| Boundary               | Candidate input                                                                       | On success                                                                                                                                        | On local/schema failure                                                                                                                                                             | On fatal build failure or abandonment                        |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Branch                 | One demand with isolated AST/VFile and collectors                                     | Return value, messages, diagnostics, and declarative effects in one branch outcome                                                                | Return failure, issues/messages/diagnostics, and any branch-local effects; do not publish them                                                                                      | Release branch references; no commit                         |
| Field adapter          | One branch outcome or ordinary custom Zod execution                                   | Associate value, diagnostics, and effects with the exact schema path                                                                              | Add Zod/normalized diagnostics and mark the field invalid                                                                                                                           | No commit                                                    |
| Record                 | All field outcomes for one record                                                     | If every field is valid, form one valid-record candidate containing the complete record effect set                                                | Discard the record value and **all** its effects, including successful sibling effects; retain all applicable diagnostics from successful and failed siblings                       | Discard candidate and dispose the record broker in `finally` |
| Cross-file validation  | All locally valid-record candidates                                                   | Validate uniqueness against only those candidates                                                                                                 | A unique conflict marks every participating record cross-file invalid; retain a field-local diagnostic for each registration and discard every effect of every participating record | No commit                                                    |
| Source/build candidate | Cross-file-valid records, canonical effects, diagnostics, and prepared logical output | Continue to asset/output staging and final policy gates                                                                                           | Non-fatal schema-invalid records remain omitted; valid records may still form a successful non-strict build                                                                         | Discard the whole new candidate                              |
| Successful full build  | Complete candidate accepted by core fatal checks, `prepare`, and facade strict policy | Atomically replace committed data/effects/reference manifests by the new generation                                                               | N/A                                                                                                                                                                                 | Previous successful generation remains committed             |
| Successful owner patch | Previous committed state plus changed/removed owners                                  | Remove each changed/removed owner's old effects, then install the changed owner's complete new effect set if valid; canonicalize the whole result | A changed owner that is now invalid has its old effects removed and no new effects installed, provided the non-strict patch otherwise succeeds                                      | Previous successful generation remains committed unchanged   |

Uniqueness validation is simultaneous and symmetric. For a duplicate `(group, value)`, every participating record is invalid; Velite does not select a winner by source order and does not iteratively rescue one record after removing another. The conflict diagnostics survive, but none of those records' unique registrations, asset references, or sibling effects enter the final build candidate.

Only a complete successful full build or patch replaces committed state. A failed watch/incremental rebuild retains the previous successful data, effect set, output manifest, and asset-reference manifest. Candidate engine computations may be dropped or recomputed, but they are not committed truth. Removed owners and old effects are retired only as part of a successful commit. A config reload creates a new pipeline epoch; failed config loading or failed first build retains the old epoch's committed state, while a successful new-epoch build atomically supersedes it and then makes old outputs eligible for cleanup.

Record validation abandonment follows the same rule as failure: dispose the broker in `finally`, discard every uncommitted field/record outcome, and publish nothing. Already-started promises may settle normally because the broker has no consumer cancellation interface, but settlement after disposal cannot reinsert cache state or commit effects.

### Effect and diagnostic identity, deduplication, provenance, and ordering

#### Effects

An effect is a declarative fact with provenance. Its owner is the stable tuple `(collection configuration identity/order, source path, record identity/index)`, not a bare record ID that may collide across collections. Provenance additionally contains the schema path, projection/request identity, and a stable source occurrence or schema-declaration ordinal. These fields are semantic association, not timestamps.

Effect identities are:

| Kind                              | Declarative identity                                                                                                                                  | Validation/execution key                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Unique registration               | `('unique', owner, field/projection occurrence, group, value)`                                                                                        | Conflicts are grouped by `(group, value)` across distinct owners; repeated registration by one owner never conflicts with itself |
| Asset reference                   | `('asset', owner, field/projection occurrence, normalized source asset path, effective output template/base, metadata requirement, blur requirement)` | Asset computation may deduplicate by source bytes/identity plus hash, probe, metadata, and blur requirements                     |
| Effect emitted by a custom schema | The identity of its declared unique/asset fact using the same owner, provenance, and payload rules                                                    | Custom schemas gain no new effect kind or second diagnostic channel                                                              |

Two declarations are exact duplicates only when kind, owner, complete provenance, and normalized semantic payload all match. Exact duplicates collapse in branch, candidate, committed, and public effect sets because they are the same declarative fact. Distinct reference occurrences carry distinct occurrence provenance and therefore do not collapse. Effects never collapse across owners.

Effect identity is separate from three other identities:

- **Asset computation identity** decides whether byte read/hash/probe/blur work can be reused. It does not merge references.
- **Output-file identity** is the normalized destination path plus the bytes/semantic output expected there. Two incompatible computations targeting one destination are a fatal `output` collision diagnostic, never first-completion-wins.
- **Reference occurrence** identifies one source/schema occurrence and is preserved even when its computation or output file is shared.

The same asset referenced by multiple owners therefore has multiple effects but may share computation and one physical blob. The same source asset requested with different output templates, public bases, metadata flags, or blur requirements has distinct reference semantics and, where those requirements affect work, distinct computation/output identities.

Canonical effect order is ascending by:

1. collection configuration order, then collection identity;
2. source path in POSIX code-unit order;
3. record source index, then stable record identity;
4. schema path, comparing numeric segments numerically and string segments by code unit;
5. projection/request declaration ordinal;
6. source occurrence position or stable occurrence ordinal;
7. effect-kind rank (`unique`, then `asset`);
8. a deterministic normalized payload tie-breaker.

This order is recomputed after full builds and patches. It never uses Promise completion, cache hits, `collectEffect` timing, or append position.

#### Diagnostics

A diagnostic's identity consists of its stable code, stage, severity, complete source/owner/field/request association, source position when available, and underlying root-cause identity. Exact duplicates with the same association may collapse. Diagnostics for different fields, records, source occurrences, or demands never collapse merely because they share a message or cause.

Canonical diagnostic order is ascending by:

1. collection configuration order and identity, with project-wide diagnostics using a fixed leading sentinel;
2. source path;
3. record source index and stable record identity;
4. schema path;
5. projection/request declaration ordinal and source position;
6. pipeline stage rank: `config`, `discover`, `load`, `schema`, `asset`, `prepare`, `output`, `watch`;
7. severity rank: `error`, `warn`, `info`;
8. diagnostic code;
9. normalized asset/output path or another stable subject key;
10. stable message and cause fingerprint as the final tie-breaker.

Opaque error object identity, stack traces, and Promise completion order are not ordering keys. Presentation may group diagnostics, but the structured result remains in this canonical order with full provenance.

### Asset and output commit rules

Asset handling has six separate phases:

| Phase                           | Meaning                                                                 | Transactional status                                                  |
| ------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Speculative discovery           | A branch encounters an asset request or linked reference                | Branch-local request, not an effect commit                            |
| Read/probe/hash                 | Velite reads bytes and computes URL/metadata/blur                       | Speculative pure computation; allowed before record validity is known |
| Branch-local asset effect       | A successful branch describes one reference with owner/provenance       | Discarded if its record becomes invalid                               |
| Build asset-reference candidate | Cross-file-valid records contribute canonical references                | Not committed until the whole build succeeds                          |
| Physical output staging         | Velite prepares blobs/data/manifest without publishing a new generation | May fail without replacing committed state                            |
| Manifest/data publication       | One successful generation becomes current                               | Commit point; stale cleanup follows committed references              |

Speculative reads, probes, hashes, and immutable cache results may be retained according to their owning computation's normal lifetime even if a record or build fails; they carry no committed reference. Missing/unreadable assets are fatal asset diagnostics. Corrupt or unsupported image probing, or failure to produce a requested blur, is instead a field-scoped schema error: returning fabricated zero dimensions is not a successful `s.image()` result, but another valid record need not make the entire non-strict build fail.

Velite must finish all fatal diagnostic collection, prepare processing, facade strict policy, and required output staging before publishing new data or manifests or deleting old outputs. Non-content-addressed files must be staged or otherwise protected by an equivalent atomic-generation mechanism. Immutable content-addressed blobs may be written before the final publication gate because an unreferenced blob cannot make candidate data current; if the build fails, such a blob may remain as harmless garbage for later collection. No failed build may publish a reference to it.

If one of several asset writes fails, the new data and manifests are not published, no old committed output is deleted, and the previous successful generation remains usable. Successfully staged or content-addressed blobs from the failed attempt may remain unreferenced. Cleanup is driven only by the references in the newly committed manifest, never by discovery or write history. Stale cleanup occurs after publication as retryable garbage collection; cleanup failure must not roll back or misreport the already committed generation.

The `prepare` hook receives a mutable candidate output view and readonly core diagnostics. It may transform the candidate output and append new diagnostics, but it cannot delete, replace, mutate, or downgrade core diagnostics. Hook diagnostics become immutable members of the same canonical diagnostic set. A thrown/rejected hook becomes a fatal `prepare` diagnostic. Output transformations do not invent schema effects; assets introduced solely by arbitrary hook code are the hook author's responsibility unless a future explicit interface says otherwise.

`prepare(false)` suppresses Velite's default data and asset publication only. It cannot bypass a core or hook fatal diagnostic and cannot turn a strict-upgraded build into success. On a clean successful run it commits the new internal record/effect generation while committing an empty Velite-owned published-output/reference generation, then makes prior Velite-tracked outputs eligible for cleanup. On a failed run it leaves the previous successful output generation untouched. Hook-owned external I/O is outside this transaction guarantee.

### Partial-failure scenarios

| Scenario                                      | Required result                                                                                                                                                                                     |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One sibling schema fails while others succeed | The failed field invalidates the record. All sibling effects are discarded; diagnostics and messages from all applicable sibling outcomes are retained in canonical order.                          |
| A shared parse fails                          | Parse once for the matching slot, retain one root cause until broker disposal, and associate a separate field-local failure/diagnostic with every demand. Unrelated parse identities continue.      |
| A transform branch fails                      | Fail only that branch/field; its AST, VFile, messages, effects, and failure cannot contaminate siblings or the pristine parse. The resulting invalid record discards all sibling effects.           |
| A custom schema fails                         | Normal Zod issues invalidate their normal field/record scope; all record effects are discarded. Custom external side effects and `SessionStore` object mutation are not rollback-safe Velite state. |
| A unique conflict occurs                      | Every participating record becomes cross-file invalid, every associated field gets a diagnostic, and all effects of all participating records are discarded. No winner is selected.                 |
| One asset read fails                          | Emit a fatal `asset` diagnostic with asset, owner, source, field, and request provenance; publish no new generation and retain the previous committed state.                                        |
| One image probe or requested blur fails       | Emit a field-local `schema` error, invalidate that record, discard all of its effects, and allow a non-strict build of other valid records. Never silently return successful zero metadata.         |
| Several asset writes partially succeed        | Treat any required write failure as fatal `output`; publish no new data/manifest/references, preserve the previous generation, and allow only unreferenced staged/content-addressed residue.        |
| `prepare` throws                              | Convert to a fatal `prepare` diagnostic, discard the build candidate, and retain the previous generation. Hook-owned side effects cannot be rolled back.                                            |
| `prepare` returns `false`                     | Still run the fatal and strict gates. On success suppress default publication and reconcile the Velite-owned published generation to empty; on failure preserve the old generation.                 |
| Record validation is abandoned or disposed    | Dispose the broker in `finally`, discard all branch/record candidate state, and prevent late settlements from committing. Do not attempt consumer cancellation.                                     |
| An incremental rebuild fails                  | Preserve the complete previous successful committed generation. Do not remove changed/removed owners' old effects or outputs until a later successful patch/build.                                  |
| Config reload fails or succeeds               | Failed load/build retains the old epoch and committed generation. Successful reload commits a wholly new epoch/generation; only then may cleanup use the old and new committed manifests.           |

The current `createEffectIndex()` comment is not implementation evidence: the function is not wired into the pipeline. This decision defines the required 1.0 semantics independent of that unused implementation. The linked-asset and VFile defects remain implementation tickets; they must eventually obey the occurrence identity, branch isolation, canonical ordering, and single-logical-VFile rules here, but this decision does not fix them.
