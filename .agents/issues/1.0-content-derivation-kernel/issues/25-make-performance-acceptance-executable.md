# Make performance acceptance executable

Status: resolved
Created: 2026-07-18T09:48:00+08:00
Type: grilling
Blocked by: 02, 10, 20, 24

---

## Question

What fixed comparison baseline, cross-version fixture adapter, dependency policy, and exact formulas make every 1.0 numeric performance gate executable once the public schema surface changes?

## Review context

The current contract uses both `adjacent baseline` and `fixed adjacent baseline`, requires one harness and lockfile despite incompatible 0.x/1.0 schema calls, and would repeatedly apply a 30% overhead reduction if every release candidate used its immediate predecessor. Define the baseline commit and adapter, dependency-change procedure, no-op/incremental delta formula, candidate-overhead validity rule, and coverage for every final built-in projection.

## Answer

### Selected decision

Velite uses a versioned, repository-owned acceptance protocol with a fixed pre-kernel comparison for the first 1.0 kernel acceptance and an accepted-release adjacent comparison thereafter. The protocol shares semantic fixtures, workload descriptors, seeds, events, and expected oracles across revisions while using revision-specific configuration adapters for incompatible public schema surfaces.

The first acceptance comparison is performed against the immutable full commit `3903ba3bdcfe9ce987f69f2de799d218a939c677`. The 30% combined static-projection overhead reduction applies exactly once, from that baseline to the first 1.0 candidate that satisfies every structural gate. Later release candidates and releases compare against the immediately preceding accepted release and apply regression, correctness, lifecycle, and retention gates without repeatedly demanding another 30% reduction.

Numeric gates use built distributions in isolated fresh processes on one pinned dedicated Linux release host. Structural correctness is measured separately through narrow internal instrumentation seams and controlled adapters. No broker, generation, epoch, transaction, fence, cache registry, observer, counter aggregator, statistics service, or lifecycle debug interface becomes public.

### Fixed baseline and qualification

The fixed pre-kernel baseline is:

```text
3903ba3bdcfe9ce987f69f2de799d218a939c677
```

The commit exists, is the current pre-kernel product tree, and contains the required old schema surface and benchmarkable build path:

- `s.markdown()` and `s.mdx()` are primary schemas without root projection methods.
- `s.toc()`, `s.excerpt()`, and `s.metadata()` are top-level schemas.
- `pnpm build` produces the package `dist/index.mjs` entry.
- `scripts/bench-large.ts` demonstrates built-dist full, no-op, and incremental operation paths, although that script is not itself the final acceptance harness.
- The commit contains none of the selected record broker, generation publication, pipeline epoch, or private root-projection implementation.

The fixed baseline must not move after this decision because of an unfavorable result, a faster nearby commit, a changed dependency, or an implementation convenience.

If the baseline appears unavailable, the only replacement procedure is:

1. Mark the harness state invalid and publish no acceptance conclusion.
2. If the object is absent only because of a shallow clone or incomplete local object database, fetch the exact object; this is not grounds for replacement.
3. Attempt the baseline build with its original frozen lockfile, the pinned Node executable, and the pinned pnpm version before declaring it unusable.
4. Replacement is permitted only if the object is permanently unobtainable or cannot build and import under that original environment.
5. Before viewing candidate performance results, resolve a new explicit tracker decision that selects the nearest qualifying first-parent pre-kernel ancestor. The replacement must expose the old schema surface, build its own `dist/index.mjs`, and run the semantic workload adapter.
6. Record the old and replacement full hashes, the disqualifying evidence, original-lock build evidence, and qualification report. There is no automatic fallback.

A benchmark run with a missing, abbreviated-only, unqualified, or silently substituted baseline is an invalid harness run, not a product performance failure.

### First-kernel and later-release strategy

- **First kernel acceptance:** compare fixed pre-kernel `3903ba3bdcfe9ce987f69f2de799d218a939c677` with the first complete 1.0 kernel candidate. Apply all structural and regression gates plus the one-time 30% overhead reduction.
- **Later candidate or release:** compare with the immediately preceding accepted release artifact, identified by full commit, lockfile hash, protocol version, fixture hash, and evidence-bundle hash. Apply all regression, structural, correctness, retention, publication, and lifecycle gates, but not the 30% improvement floor.
- **Unaccepted commits:** an arbitrary previous commit, previous CI build, failed release candidate, or conveniently selected nearby revision is never an adjacent baseline.
- **Protocol change:** a semantic workload or formula change creates a new protocol series and cannot silently reinterpret retained results from protocol version 1.

### Semantic workload specification and revision adapters

The initial protocol identifier is:

```text
velite-content-derivation-acceptance/1
```

The checked-in acceptance harness owns this versioned semantic workload specification, fixture generator, seed derivation, revision-adapter contract, semantic oracle, report schema, and independent result calculator. Every evidence bundle records content hashes for each of them.

The baseline and candidate receive identical:

- source paths and UTF-8 source bytes;
- asset paths and bytes;
- workload descriptors and projection options;
- plugin functions and plugin ordering where a shared function is intentional;
- random seed and resulting workload order;
- full, no-op, change, watch, reload, failure, and disposal event sequences;
- expected document and asset counts; and
- semantic oracle inputs.

The revision-specific adapter may only:

1. Bind configuration imports to that revision's isolated built `dist/index.mjs`.
2. Emit the old top-level baseline forms `s.toc()`, `s.excerpt({ length: 160 })`, and `s.metadata()`.
3. Emit candidate named roots and their final `.toc()`, `.excerpt({ length: 160 })`, and `.metadata()` methods.
4. Translate the shared workload descriptor into the minimum revision-specific configuration syntax.

It may not change source data, demand sets, options, plugin behavior, assets, event order, expected counters, or thresholds. It is a harness adapter, not a product compatibility shim, migration helper, runtime fallback, or dialect guesser.

The old baseline is not the final semantic oracle for metadata, explicit TOC input, or MDX static visible text. Baseline metadata participates in aggregate cost measurement because the old public surface can express that demand, but only the candidate must match Ticket 20's final metadata and static-text oracle. Cross-revision value equality is required only for the stable semantic intersection. Candidate correctness always uses the isolated final oracle, never a frozen pre-1.0 getter result.

### Dependency and lockfile policy

The preferred kernel comparison uses the same dependency resolution for the baseline and candidate. Dependency changes are represented by three isolated builds:

```text
A = baseline product source + baseline original dependency manifest and lockfile
B = identical baseline product source and build configuration + candidate dependency declarations and lockfile
C = candidate product source + candidate dependency declarations and lockfile
```

- `A -> B` is the dependency-only bridge comparison.
- `B -> C` is the kernel comparison used for kernel attribution and the first-kernel gates.
- If baseline and candidate dependency declarations and lockfile are identical, `A == B`; the report records an identity bridge.
- The bridge replaces dependency-related manifest fields and lock resolution only. It does not copy candidate product source, schema adapters, bundler configuration, benchmark logic, or implementation changes into the baseline.
- Every build uses a frozen install and records both lockfile bytes and the resolved relevant package versions; an identical lockfile filename or workspace-level hash alone is insufficient if importer resolutions differ.
- If candidate workspace install policy is required to install the candidate dependencies, it is treated as part of the dependency/toolchain bridge and reported explicitly.
- If `B` cannot build, import, or execute the workload, the bridge fails. The release may not attribute an `A -> C` difference to the kernel or conceal the dependency axis.

The baseline source, bridge source, candidate source, each `dist`, fixture root, data output, asset output, generation root, staging root, package cache visible to the worker, and mutable result directory remain physically distinct. No revision overwrites another revision's `dist`, `.velite`, manifest, pointer, or output. Configuration uses an absolute revision-specific package binding so Jiti or Node resolution cannot select the other revision.

### Release host and build environment

Numeric and peak-RSS hard gates run only on a pre-registered dedicated Linux x64 release host. Before any measured result, a checked-in or retained host manifest fixes:

- stable host identity;
- OS image and kernel;
- architecture;
- CPU model, enabled logical-core count, and affinity policy;
- total memory;
- AC power state;
- `performance` CPU governor;
- one fixed turbo policy;
- background-service policy;
- exact environment-variable allowlist;
- exact Node executable path, version, and binary hash; and
- exact pnpm executable and version.

Protocol version 1 uses Node `22.13.0` and pnpm `11.1.2`. Changing Node, pnpm, CPU topology, power policy, or the designated host starts a new environment series; results from different series are not pooled.

Each revision runs a frozen install and `pnpm build`, and the evidence records source commit, dependency manifest, lockfile hash, resolved dependency summary, and built-dist hashes. A committed `dist` is not assumed: each revision must build its own distribution successfully and import that exact artifact.

Ordinary shared CI, macOS, and Windows execute deterministic and built-dist smoke coverage only. They must not claim to satisfy the canonical wall-time or RSS release gate.

### Timed and untimed regions

Fixture generation, revision-specific config generation, output cleanup before worker launch, source mutation for an incremental event, cleanup after worker exit, and result serialization are outside all timed regions.

For a 100-document cold full build and each stress full build:

1. Start a fresh process with no imported Velite module, Builder, broker, output generation, or application module state.
2. Start the timer at the first worker instruction immediately before dynamic import of that revision's `dist/index.mjs`.
3. Include import, config loading, Builder construction, filesystem scan/load, validation, derivation, assets, generation staging, pointer publication, required result construction, and terminal Builder disposal.
4. Stop the operation timer after disposal reaches its terminal state. Observe RSS from process spawn through process exit.

For a 1,000-document mixed worker:

1. Start a fresh process and start the full-build timer immediately before built-dist import.
2. Include import, config load, Builder construction, scan, derivation, and successful full publication in the full interval.
3. Stop the full interval after the full generation commits, retaining the same Builder.
4. Time a no-op `build()` with no fixture or event changes.
5. Mutate the fixed Markdown source outside the incremental timer, then time one matching `apply({ type: 'change', path })` operation.
6. Time disposal separately after incremental settlement. Disposal terminality is a hard structural gate; its time is advisory.
7. Observe peak RSS across the complete worker lifetime, including disposal.

`Cold` means a fresh process and fresh application state. It does not promise an empty OS page cache or require privileged cache dropping. `Warm no-op` means a successful full generation followed by `build()` on the same Builder with no source, config, or event change. `Single-file incremental` means the specified untimed byte change followed by one matching `apply()` in the same Builder and epoch.

### Paired-run protocol

Every workload batch runs two unmeasured warm-up pairs followed by seven measured pairs.

- Warm-up revision order: `AB`, then `BA`.
- Measured revision order: `AB`, `BA`, `AB`, `BA`, `AB`, `BA`, `AB`.
- Each pair contains one independent worker per revision for that workload.
- Workload order within each pair is a deterministic permutation derived from the recorded run seed. Both revisions receive the same permutation.
- The seed, permutation algorithm version, resulting order, pair index, and revision order are raw evidence.
- Warm-up data is retained as diagnostic evidence but is explicitly marked unmeasured and never enters gates.

Each measured raw sample stores at least:

- protocol, report schema, workload, fixture, oracle, adapter, and calculator versions and hashes;
- full source and baseline/candidate commit hashes;
- dependency comparison role `A`, `B`, or `C`, dependency manifest hash, lockfile hash, and dist hashes;
- host manifest hash, Node executable/version/hash, pnpm version, OS/kernel, architecture, CPU, enabled cores, memory, and power mode;
- seed, workload permutation, pair index, and AB/BA order;
- process and operation timestamps;
- raw full/no-op/incremental/dispose milliseconds as applicable;
- raw sampled peak RSS, end-of-operation process memory, and relevant idle-worker RSS;
- worker exit code/signal, timeout/OOM/crash classification;
- document, record, asset occurrence, unique asset, output, and publication counts;
- output and fixture digests;
- semantic-oracle status; and
- pointers to the corresponding structural counter and build reports.

The harness must not silently delete a first batch, raw sample, warm-up record, environment field, failed worker result, or rerun.

### Statistical formulas

For positive samples `x_1 ... x_n`:

```text
mean(x) = sum(x_i) / n
sample_sd(x) = sqrt(sum((x_i - mean(x))^2) / (n - 1))
CV(x) = sample_sd(x) / mean(x)
median(x) = middle sorted value for odd n,
            arithmetic mean of the two middle sorted values for even n
MAD(x) = median(abs(x_i - median(x)))
nearest_rank_p95(x) = sorted_x[ceil(0.95 * n)]  // one-based
paired_ratio_i = candidate_i / baseline_i
gate_ratio = median(paired_ratio_i)
```

For seven samples, nearest-rank p95 is the maximum. The report includes each side's median, min, max, MAD, arithmetic CV, and nearest-rank p95, plus every paired ratio. The fastest sample is never a gate statistic.

The no-op and single-file incremental hard gates use the two side medians from the same paired batch:

```text
candidate_ms - baseline_ms <= max(0.10 * baseline_ms, 2 ms)
```

The report still preserves paired ratios for those workloads, but neither an unpaired fastest sample nor a favorable individual pair can override the exact median delta formula.

### Batch validity and rerun

- Ordinary wall-time batches are valid only when both sides have `CV <= 0.05`.
- No-op and single-file incremental batches permit `CV <= 0.08` on both sides.
- Peak-RSS batches require `CV <= 0.05` on both sides.
- Every timed value, raw peak RSS, and denominator used by a ratio must be finite and positive.
- A dialect overhead batch is invalid if either baseline or candidate combined overhead is non-positive.
- A stress slope batch is invalid if its corresponding early slope is non-positive. RSS slope is also invalid if any required RSS-above-idle value is non-positive.
- A benchmark configuration error, missing or unqualified baseline, failed build/import, malformed fixture, mismatched protocol hash, or incomplete environment metadata is an invalid harness state. It produces no performance acceptance conclusion.
- Excess CV is invalid noise, not a pass and not a product performance failure.

A result is boundary/noise when any of the following holds:

1. The aggregate result lies within two percentage points on either side of a numeric limit.
2. The median candidate/baseline ordering of the first three measured pairs is opposite to that of the last four measured pairs.
3. The batch is invalidated by the stability rules.

The designated release maintainer may authorize exactly one complete same-protocol rerun:

- Both batches and all raw samples remain in the report.
- For a valid boundary first batch, the second batch must be valid and pass, and the same formulas recomputed over all 14 measured pairs must pass. The pooled median uses the even-sample median definition above.
- For an invalid first batch, a valid second batch is authoritative; invalid first-batch samples are retained but not pooled into a verdict.
- A second invalid batch or a failing second batch does not pass and cannot be replaced by a third run or selected samples.
- A non-boundary hard failure is not eligible for a performance-noise rerun.
- Baseline commit, lockfile policy, threshold, seed, fixture, workload, host policy, or formula must never change after results are observed.

### Workload matrix

All normal generated documents are deterministic UTF-8 files between 1.5 and 2.5 KiB. Each has frontmatter with stable `id`, `title`, and ordering fields; four source-ordered headings across at least three depths; prose; inline code; a list; and deterministic prose padding. Markdown and MDX variants use the same semantic prose. MDX additionally contains one ESM declaration, one expression, static nested JSX text, JSX names and attributes, and an expression-only heading so the static-visible-text exclusions are testable.

The 100-document matrix contains separate Markdown and MDX rows:

- **Frontmatter control:** 100 Markdown files, frontmatter validation only, no content root; environmental advisory.
- **Primary-only:** one corresponding root per record, no static projection, plugin, or asset.
- **Combined:** primary plus TOC, `excerpt({ length: 160 })`, and metadata from one matching root/profile.
- **Projection-only:** TOC, the same excerpt, and metadata, with no primary field.
- **Plugins and assets:** 50 Markdown and 50 MDX records with primary and all three projections. Each profile has one full-tree remark and one full-tree rehype transformer; MDX also has one recma transformer. Each document references one unique deterministic 4 KiB asset through the primary branch and requests the same asset through `s.file()`. Every fourth document also requests image metadata from a deterministic image fixture.

The 1,000-document mixed workload contains 500 Markdown and 500 MDX files and 1,000 unique deterministic assets. Every record demands primary, TOC, excerpt, metadata, linked asset processing, and `s.file()`. It uses no deliberately expensive synthetic plugin. One fresh worker and one Builder perform full, no-op, one deterministic Markdown single-file incremental operation, and disposal in that order.

The 1,000/5,000/20,000 stress series uses the same 50/50 dialect mix, combined schema demand, and one unique asset per document. Every size/revision/sample is a fresh full-build worker. Fixture byte ranges, dialect counts, document counts, asset counts, and fixture hashes are verified before timing.

Deterministic structural workloads additionally cover:

- independently allocated equivalent roots and plain options;
- text, path, origin, dialect, parser setting, plugin function, plugin order, and profile mismatch;
- 32 simultaneously pending matching demands;
- opaque and cyclic same-reference and distinct-reference profile values;
- rejected parse and delayed settlement after record disposal;
- invalid siblings, custom schema failures, unique conflicts, strict/fatal/prepare failures, staging failure, cleanup failure, and failed patch;
- failed and successful shadow reload with events during warming and fencing;
- concurrent Builder and epoch disposal; and
- two parallel Builders with distinct output roots.

### Metadata comparison boundary

Metadata is present in combined and projection-only workloads for both revisions. Its candidate correctness, invocation count, projection-only behavior, branch isolation, and retention are hard gates. A separately attributed metadata phase wall time is advisory because the old top-level baseline does not implement the final Ticket 20 semantics.

The combined total and combined-overhead metrics remain hard because they represent the actual final demand set, including metadata. This refines Ticket 10's old label “combined TOC/excerpt overhead” to **all-static-projection combined overhead**. It does not treat old metadata values as expected candidate values.

### Content, asset, and retention counters

The untimed structural report records exact counts, grouped by harness worker, Builder slot, operation kind, dialect, effective-profile label, and request kind, for:

- record broker creation and terminal disposal;
- pristine parse attempt, success, rejection, and pending-waiter join;
- branch materialization and branch outcome;
- Markdown transform/run/stringify;
- MDX transform/compile/recma/stringify/minify;
- TOC, excerpt, and metadata projection;
- controlled remark, rehype, and recma plugin invocation;
- effect declaration, record commit, and invalid-record discard;
- reference occurrence, unique asset computation identity, output destination, read, hash, probe, blur, and write;
- retained parse slots, ASTs, immutable VFile seeds, branch AST/VFiles, promises, outcomes, diagnostics, effects, projection results, and asset request state after record disposal.

Matching primary/TOC/excerpt/metadata demands perform exactly one pristine parse per record and matching profile. Projection-only work performs the dialect-correct parse and demanded projections but zero primary render, transform, MDX compile, recma, or minify. Mismatched text, path, origin, dialect, or effective profile never shares. A rejected matching parse is attempted once and retained only until broker disposal. Every retained broker-artifact gauge is zero after successful, invalid, throwing, rejected, abandoned, or late-settling record completion.

Controlled branch labels and event sequence numbers are harness-assigned logical labels, not private object identities. Branch and VFile isolation must be proved by behavior and mutation probes, not object addresses in a public report.

### Generation, publication, and lifecycle counters

The Ticket 24 structural event report contains at least:

- `generation.candidate.created`;
- `generation.stage.attempt`, `generation.stage.success`, and `generation.stage.failure`;
- `generation.commit.attempt`, `generation.commit.success`, and `generation.commit.fenceRejected`;
- `generation.abandon`;
- `publication.pointerSwap.attempt`, `publication.pointerSwap.success`, and `publication.pointerSwap.failure`;
- `cleanup.attempt`, `cleanup.success`, `cleanup.failure`, and `cleanup.retry`;
- terminal retained staging-residue count/bytes and unreferenced content-addressed blob count/bytes;
- `epoch.create`;
- `epoch.warmingBuild.start`, `epoch.warmingBuild.complete`, and `epoch.warmingBuild.failure`;
- `epoch.activate` and `epoch.swap`;
- `epoch.stopAdmission`;
- `epoch.drain.start` and `epoch.drain.complete`;
- `epoch.dispose.start` and `epoch.dispose.complete`;
- `watch.event.journal`, `watch.event.replay`, snapshot watermark, final-fence watermark, and committed watermark;
- `staleOperation.settle`, `staleOperation.fenceRejected`, and its zero successful commit count; and
- Builder disposal start, terminal completion, and shared settlement count.

Every event has a monotonic harness observation sequence. Counts and sequence constraints must prove:

1. Strict, fatal, and prepare failure produce zero stage, commit, pointer swap, and cleanup before commit.
2. Failed staging records stage failure and abandon but zero commit and pointer swap.
3. Successful full and patch operations use the same named candidate, stage, and commit seam.
4. A failed patch leaves the previous generation, publication, owner records, effects, references, and manifests unchanged.
5. Successful `prepare(false)` commits an internal generation and an explicitly empty published-output generation.
6. Cleanup begins strictly after commit and pointer swap. Cleanup failure neither rolls back nor misreports the commit and creates retry evidence.
7. Failed reload creates, abandons, drains, and disposes a shadow epoch but records zero activation/swap and leaves the old epoch current.
8. Successful reload records candidate commit, pointer swap, and active-epoch swap before old-epoch stop-admission, drain, and disposal.
9. An old admitted operation may settle, but its fence is rejected, its transaction is abandoned, and its successful commit count is zero.
10. Journal, replay, cursors, and watermarks account for every relevant event during initial subscription, warming, catch-up, and final fencing.
11. Concurrent disposal shares one settlement and reaches terminal Builder and epoch states.
12. Disposal leaves zero Builder-owned epoch, generation candidate, broker, fence, engine, `SessionStore`, journal, or active cleanup-attempt state. Safe persisted cleanup residue remains separately reported, never hidden as retained in-memory state.
13. Parallel Builders share no generation, epoch, fence, journal, engine, `SessionStore`, cleanup, or optional processor-pool mutable state.

If a real processor pool or lock is implemented, the report includes epoch-owned create, stop, drain, and dispose events and proves one terminal close. If no such implementation exists, the report states `processorPool: absent`, and its schema forbids invented zero-valued pool counters or a meaningless pool seam.

The process-wide `SchemaContextHost` is not Builder- or epoch-retained state. Structural tests prove that record leases return to their pre-run baseline and that the host owns no generation, epoch, broker, engine, fence, publication, or cleanup state. The process-owned host itself is not expected to be disposed with a Builder.

### Numeric hard gates and targets

Gate ratios use the median of seven paired candidate/baseline ratios unless an exact delta formula is specified.

| Metric                                             |                                Hard gate |             Target | Classification notes                  |
| -------------------------------------------------- | ---------------------------------------: | -----------------: | ------------------------------------- |
| 100 Markdown primary-only                          |                                `<= 1.05` |      No regression | Hard wall time and correctness        |
| 100 MDX primary-only                               |                                `<= 1.05` |      No regression | Hard wall time and correctness        |
| 100 Markdown combined                              |                                `<= 1.03` |             Faster | Includes all three projections        |
| 100 MDX combined                                   |                                `<= 1.03` |             Faster | Includes all three projections        |
| Combined static-projection overhead per dialect    | At least 30% lower for first kernel only | At least 50% lower | Later releases omit improvement floor |
| 1,000 mixed full                                   |                                `<= 1.05` | At least 3% faster | Target miss requires explanation only |
| 1,000 no-op                                        |               Exact median delta formula |      No regression | 8% CV allowed                         |
| 1,000 single-file incremental                      |               Exact median delta formula |      No regression | 8% CV allowed                         |
| Peak RSS: 100 combined, 1,000 mixed, 20,000 stress |                                `<= 1.10` |              Lower | Median paired raw peak RSS            |
| 20,000 full time                                   |                                `<= 1.10` |      No regression | Also subject to affine growth         |

For dialect `d`, let each named time be that revision's median from the same randomized valid batch:

```text
overhead_baseline_d = baseline_combined_d - baseline_primary_d
overhead_candidate_d = candidate_combined_d - candidate_primary_d

reduction_d =
  1 - (overhead_candidate_d / overhead_baseline_d)
```

Both overheads must be strictly positive. Either non-positive overhead invalidates that dialect batch. The harness must not clamp to zero, take an absolute value, substitute another sample, or manufacture an improvement rate.

All semantic correctness, parse/branch invocation, effect, asset, publication, generation, lifecycle, retention, and Builder-isolation assertions are non-waivable hard gates. Wall-time improvement cannot compensate for any structural failure.

Hard gates decide acceptance. Targets require an explanation when missed but do not override passing hard gates. Advisory observations include frontmatter control time, projection-only time, separately attributed metadata time, p95, maximum sampled RSS, end heap, CPU attribution, and scheduled trend data.

### Peak RSS and affine stress growth

A parent process samples `/proc/<pid>/status` at least every 2 ms from worker spawn through exit. A validated equivalent may replace it only with equal or better fidelity. End-of-operation `process.memoryUsage()` is supplemental and cannot substitute for sampled peak RSS.

The report stores every worker peak, each revision's median and maximum sampled peak, and paired ratios. The hard regression gate uses the median paired raw peak-RSS ratio. The maximum is advisory evidence.

Stress slope uses an idle-worker baseline measured in the same batch for each revision. The idle worker runs the same harness bootstrap without fixture work and is sampled to a stable pre-workload terminal point. Let:

```text
rss_above_idle_n = median_peak_rss_n - median_idle_rss

early_time_slope =
  (median_time_5k - median_time_1k) / 4000

late_time_slope =
  (median_time_20k - median_time_5k) / 15000

early_rss_slope =
  (rss_above_idle_5k - rss_above_idle_1k) / 4000

late_rss_slope =
  (rss_above_idle_20k - rss_above_idle_5k) / 15000
```

For both time and RSS:

```text
early_slope > 0
late_slope <= 1.25 * early_slope
```

A non-positive early slope invalidates that corresponding batch. Any required non-positive RSS-above-idle value invalidates the RSS batch. The protocol-defined single complete rerun is the only remedy. The 20,000-document worker must also finish without OOM, timeout, increasing retained broker artifacts, retained disposed epochs, or an increasing completed-record retention gauge.

### Error, invalidity, and failure contract

- Benchmark configuration errors, missing baseline objects, failed baseline qualification, failed build/import, protocol/hash mismatch, or incomplete required environment metadata are invalid harness states. They are not product performance failures and cannot produce an acceptance verdict.
- Semantic output mismatch, diagnostic/effect mismatch, counter mismatch, retention leak, publication invariant failure, branch-isolation failure, or lifecycle invariant failure is a hard failure even when wall time is faster.
- Worker crash, timeout, OOM, missing expected output, wrong document count, wrong record count, wrong asset count, or wrong publication count is a hard failure.
- Protocol version 1 worker timeouts are 5 minutes for 100 documents, 10 minutes for 1,000, 20 minutes for 5,000, and 60 minutes for 20,000. Exceeding the applicable timeout is a hard failure.
- Excess CV is an invalid batch, not a pass or a performance failure.
- A non-positive baseline or candidate combined overhead invalidates the corresponding dialect batch.
- A non-positive early stress slope or required RSS-above-idle value invalidates the corresponding stress batch.
- A failed dependency-only bridge blocks kernel attribution.
- Missing or incomplete required instrumentation is a hard structural failure.
- Stage, commit, abandon, pointer-swap, activation, drain, or disposal order that violates Ticket 24 is a hard failure.
- Cleanup before commit is a hard failure.
- A failed reload that swaps epoch or generation is a hard failure.
- An old operation that successfully commits after its authority is revoked is a hard failure.
- Dispose completion with retained Builder-owned epoch, generation, broker, fence, engine, journal, or cleanup-attempt state is a hard failure.
- Logger, report writer, or post-commit cleanup failure cannot alter a confirmed generation or make it appear uncommitted. If required evidence cannot be retained, the acceptance report itself is invalid rather than silently incomplete.
- The harness may not discard first-batch data, environment metadata, failed samples, or unfavorable raw evidence.
- The release maintainer may authorize at most one protocol-defined full rerun and may never waive structural correctness or lifecycle gates.

### Report and evidence schema

The acceptance bundle contains immutable or content-addressed artifacts for:

1. Protocol and report-schema versions.
2. Baseline qualification and full commit metadata.
3. Candidate and accepted-release baseline full commits.
4. Dependency manifests, lockfiles, relevant resolved dependency versions, and `A/B/C` bridge report.
5. Source, build configuration, and built-dist hashes.
6. Host manifest, Node executable/version/hash, pnpm version, OS/kernel, architecture, CPU, cores, memory, power mode, and environment allowlist.
7. Semantic workload, fixture-generator, adapter, oracle, and calculator hashes.
8. Fixture manifest with seed, source/asset paths, byte sizes, byte hashes, and expected counts.
9. Revision-specific generated configuration text and hash.
10. Warm-up and measured raw JSONL records, including both batches after a rerun.
11. RSS sample summaries and idle-worker evidence.
12. Output, diagnostic, effect, URL, asset, and committed-generation equivalence reports.
13. Structural event stream, exact counters, retained-state gauges, and sequence assertions.
14. Build/import, worker exit, timeout, crash, and OOM records.
15. Root export, built declaration, export-map, unsupported deep-import, and runtime-reflection negative reports.
16. Derived medians, paired ratios, MAD, CV, nearest-rank p95, delta margins, overhead reduction, RSS ratios, stress slopes, validity state, classifications, targets, and final verdict.
17. Independent calculator version/hash and its recalculated verdict.

The independent calculator accepts only the retained bundle and deterministically reproduces every validity and pass/fail result. Ticket 11 must not need access to private object identities, a live Builder, or mutable benchmark state.

### Public and internal instrumentation interface

Structural instrumentation is a narrow write-only event sink injected at explicit internal factory seams. Existing or already selected seams include dialect/parser adapters, controlled Unified plugins, schema root/projection closures, record-broker lifetime, Driver candidate construction, the Builder-local publication module, staging writer, atomic-publication filesystem adapter, epoch coordinator, watch journal, and counting filesystem/image adapters.

The harness owns event storage, aggregation, validation, and report serialization. Product modules cannot query a process-wide report, global registry, or statistics object. Timed built-dist workers run without an active event sink; structural tests are untimed. This removes active instrumentation overhead from both timing sides. Any inactive internal branch cost remaining in the shipped candidate is ordinary candidate product cost, not benchmark overhead to subtract.

No root declaration, runtime export, export-map subpath, public context field, reflection-visible object, or shipped debug operation may expose:

- content broker, request, slot, pristine artifact, VFile seed, or cache identity;
- generation, candidate, committed generation, publication ID, pointer, descriptor, or ownership manifest;
- transaction, staged generation, fence, publication term, or cleanup backlog;
- pipeline epoch, lifecycle token, journal, replay cursor, or watermark;
- processor pool/lock internals;
- instrumentation observer, counter sink, registry, aggregator, raw event stream, or statistics service.

### CI, release, and scheduled responsibilities

- **Ordinary CI:** runs all deterministic structural, semantic, failure, publication, retention, isolation, disposal, adapter, formula-unit, report-schema, and negative-export tests. It also runs a 4-10 document built-dist smoke covering both dialects, primary, projection-only, all three projections, plugins, assets, outputs, and externally observable counts. It has no wall-time or RSS threshold.
- **Dedicated release host:** runs the complete 100-document paired matrix, 1,000-document mixed lifecycle, 1k/5k/20k stress series, numeric and RSS gates, and retains the full evidence bundle for every release candidate.
- **Scheduled run:** may run the same protocol for trend detection, but is advisory and never substitutes for the release-host gate tied to the exact candidate.
- **macOS and Windows:** run compatibility smoke and deterministic behavior tests only unless a separately versioned platform-specific numeric protocol is later approved.

### Alternatives rejected

1. **Fixed pre-kernel baseline for every future release.** It preserves history but misses adjacent regressions and makes dependency drift increasingly dominant.
2. **Previous commit for every run.** It permits favorable baseline selection, includes unaccepted states, and would repeatedly apply the 30% requirement.
3. **Fixed first-kernel baseline, then accepted-release adjacent baseline.** Selected because it makes the one-time optimization claim and later regression claim distinct.
4. **One literal configuration file for both revisions.** Rejected because the public schema calls are incompatible unless a product shim contaminates the measured path.
5. **Shared semantic generator and revision-specific adapter.** Selected because data, demands, and oracle remain equal while syntax differences stay isolated.
6. **Each revision always uses its own lockfile.** Rejected as the sole comparison because dependency and kernel changes remain conflated.
7. **Force the candidate lockfile onto the baseline and report only that result.** Rejected because a dependency-induced baseline change would be hidden.
8. **Dependency-only `A/B/C` bridge.** Selected because it separately reports toolchain/dependency and kernel effects.
9. **Unpaired medians.** Rejected because host drift between revision blocks is not controlled.
10. **Fastest sample.** Rejected because it is systematically optimistic and enables sample selection.
11. **Paired AB/BA runs and median paired ratios.** Selected for drift resistance and raw-data recalculation.
12. **Ordinary shared CI wall-time gates.** Rejected because host scheduling, topology, and power state are uncontrolled.
13. **Pinned dedicated release host.** Selected for canonical numeric and RSS decisions.
14. **Absolute millisecond limits.** Rejected because they are host/toolchain specific; historical Ticket 02 values remain advisory.
15. **Ratio/regression gates.** Selected, with an absolute 2 ms floor only for low-latency no-op/incremental operations.
16. **Repeat 30% improvement for every release candidate.** Rejected because the requirement compounds indefinitely and rewards baseline manipulation.
17. **Apply 30% only to first kernel acceptance.** Selected.
18. **Make metadata-specific wall time a hard cross-version gate.** Rejected because the baseline cannot express final metadata semantics.
19. **Make metadata timing advisory but combined cost and metadata correctness structural gates hard.** Selected.
20. **Public benchmark/debug counters.** Rejected because they expose private lifecycle and freeze implementation details.
21. **Internal seam instrumentation.** Selected because tests observe events without enlarging the product interface.
22. **Content-processing microbenchmark only.** Rejected because it omits import, config, scan, assets, publication, and disposal.
23. **Built-dist end-to-end benchmark plus untimed structural tests.** Selected.
24. **One fixed 20,000-document budget.** Rejected because it is host-specific and cannot identify nonlinear growth.
25. **1k/5k/20k affine growth.** Selected because it tests marginal scaling and completion.
26. **Process-wide benchmark registry.** Rejected because it creates hidden mutable state and confounds parallel Builders.
27. **Explicit harness-owned event aggregation.** Selected because ownership and lifetime remain outside product state.

### Migration consequences

Ticket 18 must incorporate these consequences without implementing a compatibility layer:

- Explain that revision-specific acceptance adapters are harness-only and are not available to user configuration.
- Document migration from top-level projections to dialect-rooted methods, including metadata and the semantic changes that prevent the old baseline from being a correctness oracle.
- Document strict pre-publication behavior, last-successful generation retention, `prepare(false)` empty publication, shadow reload, terminal disposal, content-addressed assets, and output-directory migration from Ticket 24.
- Explain that benchmark-visible output, asset, and publication differences are intentional 1.0 behavior where specified, while user-facing output still must satisfy the final semantic oracle.
- Do not expose benchmark counters, broker access, generation IDs, or debug lifecycle operations as migration aids.

### Architecture and documentation updates required during implementation

This decision does not edit knowledge or product files. Follow-up implementation/spec work must update:

- benchmark/performance documentation with protocol ownership, host policy, workload definitions, formulas, invalidity, rerun, evidence retention, and first-kernel versus later-release rules;
- `.agents/knowledge/module-architecture.md` with the narrow internal instrumentation seam, explicit harness-owned aggregation, and prohibitions on public/process-wide statistics registries;
- `.agents/knowledge/error-handling.md` with the distinction between invalid benchmark state, product performance failure, structural hard failure, and confirmed generation truth after reporting failure;
- generation/publication lifecycle documentation with the counter/event vocabulary and sequence oracles;
- Ticket 18 migration guidance with the adapter boundary and final physical/publication consequences; and
- Ticket 11 approval guidance with the complete acceptance bundle and independent recalculation requirement.

### Test oracle and acceptance tests

The implementation must make all of the following executable:

1. Resolve the fixed baseline object and record its complete hash and metadata.
2. Build and import independent baseline, dependency-bridge, and candidate distributions.
3. Prove adapters emit old top-level schemas for the baseline and final root methods for the candidate.
4. Prove equal seeds produce byte-identical sources and assets and equal event sequences.
5. Prove adapters preserve primary, combined, and projection-only demand descriptors.
6. Validate candidate metadata against Ticket 20, not pre-1.0 getter output.
7. Validate fixture sizes, dialect counts, document counts, asset counts, and fixture hashes before timing.
8. Prove the cold timer includes import, config load, Builder creation, scan, derive, publication, and required disposal.
9. Prove generation, config generation, cleanup, mutation, and serialization remain outside their declared timed regions.
10. Record two unmeasured warm-up pairs and exclude them from every statistic.
11. Record exactly seven complete measured pairs with the specified AB/BA sequence.
12. Randomize workload order from a recorded seed and replay the same order for both revisions.
13. Recompute median paired ratios from raw samples.
14. Recompute median, MAD, sample-CV, and nearest-rank p95 exactly as specified.
15. Enforce 5% wall-time CV, 8% no-op/incremental CV, and 5% RSS CV on both sides.
16. Never use the fastest sample as a passing statistic.
17. Detect boundary proximity and first-half/second-half ordering reversal.
18. Permit at most one complete rerun and preserve both batches.
19. Require a valid passing second boundary batch and a passing pooled 14-pair result.
20. Make a valid second batch authoritative after an invalid first batch, without pooling invalid samples.
21. Reject a second invalid or failing batch without further reruns.
22. Generate the exact 100-document Markdown primary workload.
23. Generate Markdown combined with primary, TOC, excerpt, and metadata.
24. Generate Markdown projection-only with TOC, excerpt, and metadata and zero primary transforms.
25. Generate the exact 100-document MDX primary workload.
26. Generate MDX combined with primary, TOC, excerpt, and metadata.
27. Generate MDX projection-only with zero compile, recma, or minify work.
28. Perform exactly one pristine parse for matching root/TOC/excerpt/metadata demands per record/profile.
29. Never share across mismatched text, path, origin, dialect, parser setting, plugin function/order, or effective profile.
30. Execute each demanded transform, compile, recma, stringify, minify, and projection phase exactly once.
31. Prove branch AST/VFile, diagnostics, messages, effects, and completion-order isolation.
32. Attempt a matching rejected parse once, do not retry it, and retain zero artifacts after record disposal.
33. Validate equivalent independent roots and conservative opaque/cyclic profile identity.
34. Validate 32 pending matching demands coalesce to one parse.
35. Validate remark, rehype, recma, linked-asset, `s.file()`, image-probe, and write counts in the plugin/asset workload.
36. Compare candidate primary output, TOC, excerpt, metadata, diagnostics, effects, URLs, assets, and canonical order to the isolated semantic oracle.
37. Commit zero effects for invalid records and invalidate every participant in a unique conflict.
38. Record zero stage, commit, pointer swap, or pre-commit cleanup for strict, fatal, and prepare failure.
39. Record stage failure and abandon but zero commit/pointer swap for failed staging.
40. Record exactly one candidate, stage, commit, and pointer swap for a successful full build.
41. Prove successful patches use the same stage and commit seam as full builds.
42. Preserve the complete previous generation after a failed patch.
43. Commit a new internal generation and empty published-output generation for successful `prepare(false)`.
44. Prove every cleanup attempt occurs after commit and pointer swap.
45. Prove cleanup failure does not roll back or misreport the committed generation and creates retry evidence.
46. Create, abandon, drain, and dispose a failed reload shadow with zero activation/swap.
47. Commit and swap a successful reload before old stop-admission, drain, and disposal.
48. Let an old operation settle while rejecting its fence and recording zero successful commit.
49. Prove watch subscription readiness and journal/replay/watermarks lose no event during initial build or reload.
50. Prove concurrent Builder and epoch disposal is idempotent, shares settlement, and becomes terminal.
51. Prove terminal operations cannot recreate an epoch, broker, lease, pool, or publication authority.
52. Prove zero retained Builder-owned epoch, generation candidate, broker, engine, fence, journal, and active cleanup-attempt state after disposal.
53. Report safe persisted staging residue and unreferenced blobs explicitly rather than as current publication or hidden in-memory retention.
54. Prove two parallel Builders share no generation, epoch, fence, journal, engine, `SessionStore`, cleanup, or optional pool state.
55. Exclude the process-wide `SchemaContextHost` from Builder/epoch retained-object counts while proving leases return to baseline.
56. If a processor pool/lock exists, prove epoch ownership, drain, and one terminal disposal.
57. If no pool/lock exists, prove declarations, runtime composition, and reports contain no invented pool seam/counters.
58. Run 1,000 mixed full, no-op, incremental, and dispose in one worker and one Builder lifecycle.
59. Apply the no-op and incremental millisecond delta formula to the same paired-batch medians.
60. Sample peak RSS at 2 ms or better and retain every worker peak and idle baseline.
61. Complete 1k, 5k, and 20k stress workers without OOM, timeout, retained-state growth, or wrong counts.
62. Recompute idle subtraction and both time/RSS affine slopes from raw evidence.
63. Mark non-positive baseline or candidate overhead invalid.
64. Mark non-positive early slope or required RSS-above-idle invalid.
65. Classify timeout, crash, OOM, missing output, and wrong counts as hard failures.
66. Run no shared-runner wall-time or RSS hard gate in ordinary CI.
67. Run every numeric and RSS gate on the designated release host.
68. Keep scheduled trends advisory and separate from release verdicts.
69. Verify root exports, built declarations, export maps, unsupported deep imports, and runtime reflection expose no broker, counter, generation, epoch, transaction, pointer, fence, journal, or lifecycle internals.
70. Record commit, lock, Node, pnpm, OS/kernel, architecture, CPU, cores, memory, power mode, seed, order, raw samples, metrics, validity, and verdict.
71. Recalculate the identical verdict using only the retained evidence bundle and independent calculator.
72. Prove full, incremental, and reload operations with the same final input produce equivalent committed records, effects, diagnostics, logical output, references, and manifest semantics.
73. Prove Ticket 11 can determine every hard gate without accessing private object identity or a live mutable statistics service.

### Superseded clauses

- Ticket 10's unqualified statement that all percentages compare an “adjacent baseline” is superseded by the fixed first-kernel baseline and accepted-release adjacent policy above.
- Ticket 10's “fixed adjacent baseline” wording is replaced by the exact baseline commit and immutable replacement procedure.
- Ticket 10's combined “TOC/excerpt” label is refined to all-static-projection combined demand, including metadata, while metadata-specific wall time remains advisory.
- Ticket 10's overhead validity rule is strengthened: both baseline and candidate overhead must be positive.
- Ticket 10's `max(10%, 2 ms)` shorthand is replaced by the exact same-unit millisecond formula above.
- Any wording that implies one literal cross-version config file is required is superseded by the shared semantic generator plus revision-specific adapter.
- Any wording that would reapply the 30% improvement to every RC or release is superseded.
- Any implication that shared CI wall time, fastest samples, unpaired medians, a moving commit, or a fixed 20,000-document millisecond budget can approve release performance is superseded.

### Effects on related tickets

- **Measure the current cost of combined content schemas:** remains valid historical evidence at the fixed commit, but its five-sample medians, absolute milliseconds, old combined demand, and old metadata behavior are not acceptance thresholds or final correctness oracles.
- **Set the 1.0 content performance acceptance criteria:** is made executable by the exact baseline, adapter, dependency bridge, timing boundaries, formulas, validity/rerun rules, final metadata coverage, and Ticket 24 counter suite. The superseded clauses above resolve its ambiguous wording.
- **Define content schema migration guidance:** remains open and must incorporate the harness-only adapter boundary, final metadata semantics, strict/publication behavior, content-addressed asset and physical-layout migration, and the prohibition on public debug/counter interfaces.
- **Finalize the built-in projection contract:** is preserved. All three projections appear in combined and projection-only workloads; metadata correctness and structure are hard while metadata-specific wall time is advisory.
- **Define generation publication and epoch lifecycle:** is preserved and converted into executable candidate/stage/commit/abandon/pointer/cleanup/epoch/journal/fence/dispose counters and event-order assertions without exposing private object identity.
- **Approve the complete 1.0 content derivation design:** remains blocked by the reopened migration guidance and its own final review. Its eventual approval must inspect the complete raw acceptance bundle, independent recalculation, private-export evidence, and every non-waivable structural gate defined here.

No product code, current knowledge file, benchmark implementation, migration guide, or later ticket is changed by this decision.

## Reopened by final approval review

Ticket 11 is the pre-implementation design approval. Revise the Ticket 11 references so this review must establish that every hard gate, retained evidence field, and independent calculation is fully specified and executable without private identity or live mutable state. The complete raw bundle and independently recalculated measured verdict remain post-implementation release-acceptance evidence, not a prerequisite for handing an implementation-ready design to planning.

## Final resolution after reopening

### Scope and decision

The reopening is resolved by separating performance evidence into two phases:

1. **Design approval evidence contract:** the versioned protocol schema, report and artifact schemas, retained-field dictionary, gate registry, formulas, owners, phases, invalidity and rerun rules, independent oracle contracts, negative public/private surface, and failure conditions that Ticket 11 can inspect before implementation.
2. **Post-implementation release artifacts:** the actual qualified baseline and A/B/C builds, built distributions, fixtures, raw samples, structural reports, RSS and environment evidence, export reports, derived metrics, and independently recalculated verdict produced after implementation.

Ticket 11 approves the first phase for completeness, determinism, executability, and implementation readiness. It does not require fabricated distributions, samples, measurements, reports, bundles, or verdicts that cannot exist before implementation. The second phase remains mandatory for implementation and release acceptance.

The fixed baseline, first-kernel and later-release strategy, A/B/C dependency bridge, harness-only revision adapter, host policy, paired-run protocol, formulas, validity and single-rerun rules, workload matrix, structural counters, numeric gates, retention policy, and private instrumentation decisions in the existing answer remain unchanged. This resolution creates no implementation ticket, compatibility shim, public debug interface, benchmark result, implementation plan, or new product seam.

### Design approval evidence contract

Before implementation, the checked-in acceptance design must define these stable versioned schemas:

- **Protocol manifest:** protocol identifier, protocol schema version, report schema version, workload and fixture schema versions, adapter contract version, semantic-oracle version, independent-calculator input/output versions, baseline policy version, host-policy version, and the hash algorithm and canonical byte representation used for every retained hash.
- **Artifact manifest:** artifact ID, artifact kind, schema version, production phase, accountable acceptance owner, producer role, required or optional classification, content hash, byte size or record count as applicable, dependency artifact IDs and hashes, and retention location or content-addressed reference.
- **Retained-field dictionary:** artifact kind, field path, exact scalar or compound type, source, requiredness condition, validation rule, semantic meaning, independent-recalculation use, and whether omission makes the run invalid or records an explicit inapplicable value.
- **Gate registry:** stable gate ID, hard/target/advisory class, design or release phase, required input fields and artifact kinds, exact formula or structural oracle, accountable acceptance owner, pass/fail/invalid classification, rerun eligibility, and retained output fields.
- **Workload and fixture descriptors:** dialect, demand set, projection options, plugin and asset behavior, document and event counts, seed derivation, source and asset byte constraints, event sequence, adapter role, semantic oracle, expected structural counters, and output digest rules.
- **Structural event schema:** stable event name, persisted harness-assigned logical Builder/operation/publication/epoch/record/branch labels, operation kind, sequence number, semantic subject, outcome, counters or gauges, and applicable manifest or workload references. Object addresses, Promise settlement ordinals, timer races, and live registry handles are forbidden fields.
- **Raw measurement schema:** the complete per-sample fields already selected under **Paired-run protocol**, including protocol/artifact hashes, A/B/C role, source and dist hashes, host metadata, seed and order, raw times and RSS, worker outcome, expected counts, digests, oracle status, and structural-report references.
- **Derived report schema:** every retained raw input reference, validity classification and reason, medians, paired ratios, MAD, sample CV, nearest-rank p95, exact no-op/incremental deltas, overheads and reduction, RSS ratios, affine slopes, gate margins, targets, rerun relation, and per-gate verdict.
- **Independent verdict schema:** bundle root hash, calculator version and hash, every consumed artifact ID and hash, recalculated validity and gate results, discrepancy records against the producer report, and one final `pass`, `fail`, or `invalid` classification.

Every hard gate must map to typed retained inputs, one exact formula or independent structural oracle, one acceptance owner, one production phase, and an exhaustive pass/fail/invalid classification. Every retained field must have a source, exact type, requiredness rule, validation rule, and stated independent-recalculation purpose. Baseline replacement, dependency bridging, host qualification, boundary classification, and the sole rerun procedure must contain no implementation-time choice.

Structural and lifecycle truth must use persisted logical labels, validated manifests, controlled adapters, semantic values, counters, and explicit state-machine events. It must not depend on private object identity, Promise completion order, wall-clock race outcomes, directory enumeration, best-effort filesystem behavior, or a live mutable registry. Wall clock remains an input only to the explicitly numeric timing protocol; it is not a structural or lifecycle oracle.

Candidate correctness is evaluated by independent final-1.0 semantic oracles, never by pre-1.0 output. The revision adapter may translate only the fixed semantic workload into revision-specific configuration syntax and built-dist binding. It remains harness-only and cannot change dialect, selected text, demand sets, options, plugins, assets, events, expected counters, outputs, oracles, or thresholds.

### Projection evidence carried from Ticket 20

The design contract and post-implementation semantic artifacts must cover both Markdown and MDX, explicit and fallback selected input, combined and projection-only demand, and all of the following:

- Excerpt defaults to `260`; an explicit length is a non-negative safe integer; truncation iterates Unicode code points, applies `trimEnd()` to the truncated prefix, and appends exactly one `U+2026` outside the limit. Exact boundary, invalid-length, no-visible-text, and empty-selected-input cases are required.
- TOC uses the written Unicode/NFC slug algorithm, retains empty slugs, gives equal duplicate headings equal unsuffixed slugs, and preserves source order without making order part of slug identity.
- Metadata uses the exact ECMAScript Unicode Sets `v` regex, the complete frozen half-open Han/Hiragana/Katakana range table, code-point iteration, `0.56`, `265`, and ECMAScript `Math.round` semantics without decimal normalization.
- Projection-only demand performs the dialect-correct pristine parse and only demanded projections. Matching primary/TOC/excerpt/metadata demands share exactly one pristine parse per record/profile.
- Test-owned excerpt, slug, and metadata calculators implement the written algorithms directly. They must not import candidate-private helpers, call candidate projections, or use a pre-1.0 getter or `ContentFile.plain` as a correctness oracle.

### Diagnostic and effect evidence carried from Ticket 23

The design contract and post-implementation structural artifacts must cover:

- The complete exported `Diagnostic` required/optional field model and exact `DiagnosticValue` tagged normalization domain.
- Finite and non-finite numbers, negative zero, bigint, symbols, sparse arrays, accessors, ordinary and null-prototype objects, Error without stack or class identity, Date, canonically ordered Map and Set values, every binary kind, shared binary, functions, class instances, host objects, Proxy, reflection failure, cycles, and repeated references.
- Recursive detachment and runtime immutability at every diagnostic, provenance, position, path, occurrence, context, cause, tuple, array, and nested-object level, without requiring a particular mutation exception or freeze helper.
- Exact `PrepareDiagnosticInput` own-data-property validation, the sole `addDiagnostic()` sink, synchronous cause snapshotting, duplicate and conflict behavior, sink closure, late-call behavior, hook throw/rejection, and absence of `PrepareResult.diagnostics`.
- `collectEffect(effect, context)` with record-rooted semantic path, stable declaration ordinal, and exactly one valid stable occurrence; system-owned provenance cannot be forged.
- Record-atomic effect promotion, symmetric uniqueness failure, exact duplicate identity, malformed declaration behavior, and invariant results when custom transforms or hook declarations execute or complete in reversed orders.
- Root exports, declarations, built declarations, export maps, deep-import checks, runtime own keys, and reflection proving that the normalizer, comparator implementation, Proxy detector, effect and diagnostic transactions, registries, mutable collectors, sink state, owner/source enrichers, broker, and branch state remain private.

Independent diagnostic fixtures implement the written normalizer and comparator without candidate-private imports. Diagnostic and effect identity, equality, and canonical ordering never use original class/reference identity, Error stacks, property or Map/Set insertion order, call order, or Promise completion order.

### Generation, cleanup, reader, and disposal evidence carried from Ticket 24

The structural event schema must include, in addition to the existing candidate/stage/commit/pointer/epoch/watch events:

- cleanup plan snapshot, awaited first-attempt start, per-item terminal `deleted`, `absent`, `failed`, `timeout`, or `partially-deleted` outcome, first-attempt terminal settlement, retry-backlog update, later retry, immutable operational snapshot, `BuildResult` construction, and return;
- current and direct-predecessor publication labels, complete protected-manifest membership, managed-reader acquire/release, pin-blocked retirement, generation retirement eligibility, blob reference protection, and external-reader one-successor-window fixtures;
- crash after pointer commit and before first cleanup, cold-start current/predecessor/backlog recovery, staging/trash/blob residue, corrupt or unverifiable metadata, and explicit-clean separation without directory-scan ownership inference;
- operation admission, `open -> disposing`, rejected post-disposal admission, admitted-operation fence acquisition/commit/settlement, disposal wait-set membership, and terminal `disposed`;
- epoch supersession as a publication-revocation reason distinct from Builder disposal, including stale base, stale watermark, consumed fence, and old-epoch settlement;
- never-settling admitted operation, non-terminal adapter operation, never-released managed-reader lease, persisted inactive backlog, concurrent disposal settlement, and parallel Builder isolation.

The sequence oracle requires pointer commit before synchronous in-memory install, then cleanup-plan snapshot, awaited first cleanup attempt, immutable operational snapshot, detached immutable `BuildResult` construction, and return. Cleanup, logger, reporting, result-construction, or evidence-retention failure cannot reclassify a confirmed pointer commit as uncommitted.

An operation admitted before Builder disposal retains its ordinary publication authority while disposal waits. An operation presented after disposal linearizes is rejected before derivation or publication. Successful epoch replacement may still revoke an earlier admitted old-epoch operation; Builder disposal alone may not. Parallel Builders share no admission ledger, publication term, epoch, fence, reader pin, protected manifest, cleanup plan, backlog, or disposal state.

### Timed-region correction

Every timed `build()` or `apply()` interval ends only after that operation's awaited first cleanup attempt, immutable operational snapshot, `BuildResult` construction, and return:

- The 100-document cold and stress full-build intervals include built-dist import, configuration, Builder construction, derivation, publication, first cleanup, result construction and return, and terminal Builder disposal as already selected.
- The 1,000-document mixed full interval stops after the full `build()` returns, not merely after pointer commit. The no-op interval and single-file `apply()` interval likewise include their first cleanup attempt and result construction.
- Mixed-worker disposal remains a separate advisory interval after incremental settlement. Peak RSS still covers the complete worker lifetime.
- A later retry not admitted into an operation is excluded from that operation's timer. Cleanup events and timing attribution must describe the same finite attempt.

This supersedes the earlier mixed-worker wording that stopped the full interval immediately after commit and any implication that generic `cleanup.attempt` counters alone satisfy Ticket 24's final sequence oracle.

### Artifact kinds and acceptance responsibility

Acceptance owners below are responsibilities for approving evidence, not new implementation tickets or organizational assignments.

| Artifact kind                                | Required schema and evidence                                                                                                          | Accountable acceptance owner                   | Phase                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------- |
| Protocol and report schema                   | Protocol manifest, artifact manifest, field dictionary, gate registry, canonical encoding and hash rules                              | Performance protocol acceptance                | Contract before implementation; instantiated artifacts after implementation |
| Baseline qualification and dependency bridge | Fixed/replacement qualification schema, A/B/C role, source/manifest/lock/resolution/build/import/dist evidence and attribution result | Baseline and dependency attribution acceptance | Contract before; qualification and bridge reports after                     |
| Fixture, workload, adapter, and oracle       | Versioned descriptors, generator/seed rules, revision syntax boundary, byte/count hashes, semantic oracle inputs                      | Workload and harness acceptance                | Contract before; source, fixtures, configs and reports after                |
| Semantic correctness                         | Markdown/MDX output, excerpt, TOC, metadata, explicit/fallback, combined/projection-only reports and independent calculators          | Projection semantic acceptance                 | Oracle contract before; tests and reports after                             |
| Diagnostic and effect correctness            | Complete normalizer/comparator fixtures, prepare/effect transaction traces, mutation and reversed-order reports                       | Diagnostic and effect acceptance               | Oracle contract before; fixtures and reports after                          |
| Generation, publication, and lifecycle       | Logical event stream, state-machine assertions, cleanup/result, reader, recovery, admission/disposal and parallel-Builder reports     | Publication lifecycle acceptance               | Event/oracle contract before; traces and reports after                      |
| Timing and RSS raw evidence                  | Warm-up and measured JSONL, RSS samples, worker outcomes, operation regions, idle evidence and raw digests                            | Release performance measurement acceptance     | Schema before; release-host samples after                                   |
| Environment and host qualification           | Host manifest, Node/pnpm binary identity, OS/kernel, CPU/topology, memory, power and environment allowlist                            | Release host qualification acceptance          | Policy/schema before; qualification report after                            |
| Public/private export evidence               | Source and built declarations, root/runtime exports, export maps, deep-import negatives, own-key/reflection reports                   | Public interface and private-seam acceptance   | Negative-surface contract before; reports after                             |
| Independent calculator and final verdict     | Bundle-only calculator input/output, recalculated gates, discrepancies and final classification                                       | Independent release verdict acceptance         | Calculator contract before; calculator artifact and verdict after           |

### Ticket 11 reapproval oracle

Ticket 11 passes this performance portion of pre-implementation reapproval only when:

1. Protocol, report, workload, fixture, adapter, oracle, host-policy, and calculator artifacts each have stable version and hash fields.
2. Every hard gate has exact typed inputs, formula or structural oracle, owner, phase, pass/fail/invalid classification, and rerun eligibility.
3. Every retained field has a source, type, requiredness rule, validation rule, and independent-recalculation purpose.
4. Baseline replacement, A/B/C bridge, host qualification, boundary classification, and the single-rerun rule permit no result-dependent implementation choice.
5. Ticket 20 projection, Ticket 23 diagnostic/effect, and Ticket 24 publication/lifecycle contracts are completely represented.
6. Candidate correctness is independent of pre-1.0 results, and the revision adapter is strictly harness-only.
7. Structural/lifecycle gates use deterministic logical evidence and no forbidden private/live oracle.
8. Public and private negative surfaces and all failure conditions are explicit.

Ticket 11 fails this portion if any required schema, field mapping, formula, owner, phase, classification, independent oracle, negative surface, or failure condition is absent or ambiguous; if a baseline, bridge, host, adapter, validity, or rerun choice is deferred to implementation; or if the contract contradicts Tickets 18, 20, 23, or 24. It must not fail merely because implementation has not yet produced actual distributions, samples, reports, bundles, measurements, or verdicts.

This resolution makes the performance evidence contract ready for Ticket 11 reapproval. Ticket 11 still owns the complete-map review and receives no complete-design approval decision from this ticket.

### Post-implementation release artifacts

Release acceptance requires the actual immutable or content-addressed artifacts promised by the design contract:

- fixed-baseline qualification or an explicitly approved replacement decision and qualification report;
- isolated A, B, and C source/build roots, manifests, lockfiles, resolved dependency summaries, build/import reports, and built-distribution hashes, or a recorded A/B identity bridge;
- protocol, report, workload, fixture-generator, adapter, oracle, host-policy, and independent-calculator versions and hashes;
- fixture manifests and bundles with exact source and asset bytes, paths, sizes, counts, seed, event sequence, and hashes;
- every generated revision-specific configuration and its hash, with an adapter-boundary report;
- all warm-up and measured raw JSONL records, including every failed worker and both complete batches after the one permitted rerun;
- complete host and environment qualification, raw RSS and idle-worker evidence, output and fixture digests, and worker exit/timeout/crash/OOM records;
- projection semantic reports, independent excerpt/slug/metadata calculations, complete diagnostic normalizer/comparator results, effect and prepare transaction reports, and recursive mutation/reversed-order evidence;
- content, asset, retention, generation, publication, cleanup/result, reader, recovery, admission/disposal, watch/epoch, and parallel-Builder structural event reports;
- source and built public/private export, declaration, export-map, deep-import, own-key, and reflection reports;
- derived metrics, validity classifications, per-gate results, target/advisory observations, final producer verdict, and the independently recalculated bundle-only verdict.

### Post-implementation pass, fail, and invalid oracle

A release run is **invalid** and produces no performance acceptance conclusion when a required artifact, field, hash, raw sample, environment value, structural report, or retained first-batch/rerun record is missing or malformed; the baseline is unqualified, silently replaced, or cannot be qualified by the selected procedure; the A/B/C bridge is absent or cannot isolate dependency attribution; the adapter changes semantic workload, dialect, options, plugins, assets, events, counters, oracle, or threshold; required raw evidence is deleted, filtered, or overwritten by a rerun; or the independent calculator cannot reproduce every validity and gate result using only the retained bundle.

A protocol-valid release run **fails** when candidate correctness depends on baseline output; any semantic, diagnostic, effect, structural, publication, reader, disposal, retention, isolation, timing, RSS, or numeric hard gate fails; cleanup/reporting failure is represented as uncommitted; the measured build/apply region omits first cleanup, operational snapshot, result construction, or return; an unfavorable product result is hidden by another run; or any broker, identity, normalizer, transaction, registry, generation, reader, epoch, lifecycle, cleanup, instrumentation, or debug capability prohibited by this contract appears on a supported public surface.

A release run **passes** only when every required artifact is present and hash-consistent, the baseline and bridge qualify, every structural/correctness/public-private hard gate passes, every valid numeric and RSS hard gate passes on the designated host, the stress and retention gates pass, every rerun rule is satisfied, and the independent calculator reproduces the same passing verdict from the retained bundle with no unresolved discrepancy. Targets and advisory observations cannot turn a hard failure into a pass.

### CI, release host, scheduled, and platform responsibility

- **Ordinary CI** may approve deterministic protocol/report-schema validation, formula units, adapter invariance, semantic and diagnostic/effect oracles, structural state machines, failure and retention behavior, private-surface negatives, and the small built-dist smoke. It cannot approve canonical wall-time, RSS, host qualification, or the final release verdict.
- **Dedicated Linux release host** may approve host qualification and produce the canonical paired timing/RSS/stress evidence for the exact candidate. It cannot waive or replace ordinary-CI structural, semantic, lifecycle, or private-surface hard gates, and host measurements alone are not a final verdict.
- **Scheduled runs** provide advisory trend evidence only. They cannot substitute for the exact release-candidate run, consume the sole release rerun, or approve a release.
- **macOS and Windows** may approve platform compatibility and deterministic behavior on those platforms. They cannot approve the canonical Linux numeric/RSS gate unless a separately versioned platform-specific protocol is later approved.
- **Independent release verdict acceptance** combines all required ordinary-CI, release-host, export, and retained-bundle evidence and recalculates the final result. No single producer may self-certify omitted evidence or waive a hard gate.

### Public and private seam preservation

The revision adapter, event sink, logical labels, artifact writer, report aggregator, normalizer/comparator fixtures, retained bundle, and independent calculator are acceptance infrastructure. None is a user migration shim or product correctness helper. Product instrumentation remains a narrow private write-only seam at explicit factories; harness aggregation and queries stay outside product state.

No root declaration, runtime export, export-map subpath, public context, reflection-visible product object, or shipped debug operation may expose broker/cache state, pristine artifacts, VFile seeds, branch identities, diagnostic/effect transactions, normalizers, registries, generation/publication identities, manifests as ownership authority, reader leases, cleanup handles, fences, epochs, journals, lifecycle tokens, event sinks, raw events, counters, or statistics services.

### Final supersession and cross-ticket reconciliation

This final resolution preserves the historical answer as decision history and supersedes every conflicting evidence-phase or lifecycle clause in it. Specifically:

- The **Effects on related tickets** statement requiring Ticket 11 to inspect the complete raw acceptance bundle and independent measured recalculation before implementation is superseded. Ticket 11 inspects their schemas, field mappings, owners, formulas, failure rules, and bundle-only recalculation contract; actual artifacts and verdict follow implementation.
- Test-oracle item 73 is superseded where it implies Ticket 11 must determine gates from actual implementation evidence. Before implementation, Ticket 11 determines that every gate is completely and independently executable; after implementation, the retained bundle determines the measured verdict.
- Any earlier phrase treating built distributions, generated fixtures, raw JSONL, structural reports, RSS evidence, export reports, or independently recalculated measured verdict as a pre-implementation prerequisite is superseded by the two-phase contract above.
- The earlier timed-region statement that the 1,000-document full interval stops after commit is superseded by inclusion of the awaited first cleanup attempt, immutable operational snapshot, result construction, and return.
- The earlier generic cleanup event list is strengthened by Ticket 24's cleanup plan, terminal outcomes, operational snapshot, result, reader, protected-manifest, admission/disposal, and epoch-supersession events.
- The earlier semantic and diagnostic shorthand is strengthened by Ticket 20's exact projection calculators and Ticket 23's complete exported diagnostic/effect oracle.
- The harness-only adapter boundary, private instrumentation prohibition, fixed baseline, A/B/C bridge, formulas, gates, host policy, workload matrix, evidence retention, and single-rerun decisions remain unchanged.

Ticket 18's two-phase evidence contract is now consistent with this ticket. Tickets 20, 23, and 24 are carried forward without reopening their settled public composition, diagnostic/effect, generation, reader, cleanup, or disposal decisions. No new cross-ticket hard contradiction was found.

No product code, documentation, examples, tests, benchmark implementation, knowledge file, prototype, report, implementation ticket, specification, or implementation plan was created or changed while resolving this ticket.

## Final concept-convergence resolution

### Authority and supersession

This section and its linked acceptance artifacts are the current and complete Ticket 25 contract. Earlier sections remain decision history only. This section supersedes every conflicting meta-schema requirement, uninstantiated gate list, event-name-only oracle, circular or unspecified bundle-root clause, broad boundary-unit phrase, managed-reader fixture, diagnostic host taxonomy fixture, and pre/post-implementation phase ambiguity in this ticket.

The retained protocol decisions are unchanged: fixed first-kernel baseline, accepted-release comparison thereafter, A/B/C attribution, harness-only revision adapter, pinned host, paired raw measurements, exact formulas, one controlled rerun, complete raw retention, structural hard gates, independent semantic oracles, bundle-only recalculation, and separate design and release phases.

### Authoritative design artifacts

The pre-implementation acceptance contract is instantiated by exactly these authoritative artifacts:

- [`evidence-schema.v1.json`](../artifacts/acceptance/evidence-schema.v1.json) - one closed JSON Schema 2020-12 bundle defining `EvidenceProtocol`, core `EvidenceBundle`, external `IndependentVerdict`, the artifact manifest entry, raw measurements, structural witnesses, semantic evidence, export evidence, run control, derived reports, and every retained artifact payload.
- [`evidence-protocol.v1.json`](../artifacts/acceptance/evidence-protocol.v1.json) - the concrete versioned `velite-content-derivation-acceptance/1` protocol instance containing canonical bytes, hash domains, phase policy, fixed baseline, A/B/C roles, adapter restrictions, host and pairing policy, sole-rerun policy, typed path syntax, artifact kinds, retained-field dictionary, exact workload and fixture descriptors, formulas, complete stable gate registry, result rules, and negative surfaces.

These files are design contracts. They are not benchmark implementation, generated fixtures, measured evidence, a core bundle, a producer report, or an independent release verdict. Those are post-implementation release artifacts validated by the design contracts.

No additional protocol manifest, gate-registry schema, retained-field schema, workload schema, fixture schema, raw schema, witness schema, report schema, or verdict schema may become an independent acceptance authority. Such shapes are sections or `$defs` of the one versioned protocol contract.

### Three-object evidence model

The final evidence model has exactly three conceptual objects:

1. **EvidenceProtocol** is the immutable design-phase authority. Its canonical bytes and SHA-256 identity fix all schemas, retained fields, workloads, fixtures, formulas, stable gates, owners, phases, rerun rules, and negative surfaces.
2. **EvidenceBundle** is the release-phase content-addressed core manifest. It references every retained raw, semantic, structural, export, environment, calculator-source, producer-report, and producer-verdict artifact by schema, coordinates, byte size, dependencies, CAS path, and content hash.
3. **IndependentVerdict** is an external bundle-only recalculation attestation. It references the protocol hash and completed core bundle root, records every consumed artifact/hash and gate result, and is never contained by or required to calculate the core bundle root.

Derived reports and producer verdicts are recalculable core-bundle artifacts, not truth authority. Raw evidence, independently executable structural/semantic oracles, and the external recalculation decide acceptance.

### Canonical bytes and hash domains

JSON uses UTF-8 RFC 8785 JSON Canonicalization Scheme bytes with no BOM or trailing bytes. JSON-sequence records each use JCS followed by one LF in schema-defined stable order, including the final LF. Text retains exact UTF-8 bytes with no newline normalization. Binary retains exact bytes. Directory trees use the JCS array specified by the protocol. Numeric JSON is finite I-JSON; durations, byte counts, indexes, and counters are safe integers in their declared domains.

Every retained hash uses SHA-256 and the exact domain prefix and byte concatenation in `EvidenceProtocol.hashDomains`. Git object identities remain explicitly tagged Git identities and never substitute for retained SHA-256 source-tree, distribution-tree, artifact, or bundle identities.

The core `EvidenceBundle` manifest contains no `bundleRoot`, `bundleRootHash`, self artifact, or `IndependentVerdict`. Its root is calculated from the canonical core manifest bytes:

```text
SHA256(
  UTF8("velite-evidence-bundle-v1") || 0x00 ||
  JCS(EvidenceBundle manifest)
)
```

The manifest commits every core artifact indirectly through its ordered artifact entries, coordinates, dependency hashes, CAS paths, byte sizes, and content hashes. `IndependentVerdict` is stored outside the bundle hash domain and only references the resulting root. Artifact kind `independent-verdict` is forbidden in the core manifest schema.

### Concrete schemas and typed paths

The schema artifact directly defines, rather than asks implementation to define:

- artifact manifest entries and dependency integrity;
- baseline, dependency bridge, host, fixture, adapter, run-control, raw measurement, RSS, semantic, structural, export, derived-report, calculator-source, and producer-verdict payloads;
- core bundle manifest with no self root;
- independent verdict input/output, consumed artifacts, discrepancies, gate results, and final classification; and
- a closed recursive JSON value where retained reports need generic calculated values.

The protocol's retained-field dictionary maps every artifact field family to exact type, source, requiredness, validation, meaning, recalculation use, and omission result. Typed gate inputs use the fixed `P#`, `M#`, `A[...]#`, and `V#` selectors. A selector must resolve exactly once unless the schema-declared `*` sequence is explicit; zero, duplicate, hash-mismatched, or type-mismatched selection is invalid.

### Stable gate registry

`EvidenceProtocol.gates` is the complete stable registry. Every entry is instantiated with:

- one stable ID;
- `hard`, `target`, or `advisory` class;
- `design` or `release` phase;
- one accountable owner;
- exact typed input paths;
- an exact formula or structural oracle;
- exhaustive pass, fail, and invalid rules, plus fixed inapplicability where relevant;
- explicit rerun eligibility; and
- retained output paths.

Design gates prove closed schemas, field and gate coverage, non-circular hash domains, phase separation, baseline/A/B/C/host/adapter determinism, independent oracles, cross-checked structural evidence, unit-correct rerun boundaries, and complete negative surfaces.

Release gates cover schema/hash/retention integrity, baseline/bridge/host/adapter/fixture validity, pairing/rerun/calculator reproducibility, semantic values, parse sharing, VFile continuity and branch isolation, rejected-parse retention, narrow diagnostics, prepare/effect transactions, asset behavior, one Builder authority, atomic publication, cleanup/result ordering, external predecessor protection, recovery/residue, watch/reload, admission/disposal, parallel Builder isolation, optional-pool lifecycle or absence, public/private surfaces, every numeric hard gate, targets, and advisories.

No prose-only test-oracle numbering is a second gate registry. Ticket 20, Ticket 23, Ticket 24, and migration requirements map into these semantic gate IDs.

### Numeric and boundary formulas

All formulas are exact protocol entries. Numeric hard thresholds include:

- primary full time ratio `<= 1.05` for each dialect;
- combined full time ratio `<= 1.03` for each dialect;
- plugin/asset full time ratio `<= 1.05`;
- mixed full time ratio `<= 1.05`;
- no-op and incremental exact median delta `candidate_ms - reference_ms <= max(0.10 * reference_ms, 2)`;
- paired peak-RSS ratio `<= 1.10` for Markdown combined, MDX combined, plugin/assets, mixed, and 20,000 stress;
- 20,000 full time ratio `<= 1.10`;
- first-kernel static-projection overhead reduction `>= 0.30` per dialect with both overheads strictly positive; and
- positive early and `late <= 1.25 * early` time/RSS affine slopes, plus stress completion and zero-retention predicates.

Boundary/noise units are no longer overloaded:

- a ratio gate uses `abs(gate_ratio - limit_ratio)`, a dimensionless ratio margin;
- a reduction gate uses `abs(reduction - required_reduction)`, a dimensionless reduction margin; and
- a millisecond delta gate uses `abs(delta_ms - allowance_ms) / allowance_ms`, a dimensionless normalized margin relative to its exact allowed delta.

Each boundary predicate uses `<= 0.02` in its own dimensionless domain. No millisecond gate is described in percentage points.

### Pass, fail, invalid, inapplicable, and rerun

A gate passes when all required inputs are valid and its predicate is true. It fails when valid evidence demonstrates a false predicate, a worker crash/timeout/OOM/wrong count, incomplete declared structural coverage, semantic mismatch, lifecycle violation, or prohibited surface. It is invalid when required evidence is missing, malformed, hash-inconsistent, contradictory, non-unique, or cannot support a conclusion. The one-time improvement gates are inapplicable for later accepted-release comparisons.

Any hard invalid makes the final result invalid. Otherwise any hard fail makes the final result fail. Otherwise the result passes. Target and advisory results never override hard results. A missing structural report is invalid; a complete report stating `coverage.complete = false` is a hard failure.

Exactly one complete same-protocol rerun is available only for the enumerated performance-noise reasons. Baseline, bridge, host, schema, hash, fixture, adapter, worker, semantic, structural, publication, lifecycle, export, and retention failures are not noise-rerunnable. Both batches remain retained. Protocol, host, seed, workload, fixture, threshold, and formula remain fixed.

### Structural evidence and instrumentation

Product instrumentation is a private write-only witness injected at explicit internal factories. It exposes no query interface, report object, registry, stable object identity, or public/debug operation. The harness owns storage, aggregation, and validation outside product state.

Event names and event presence are never sufficient hard-gate oracles. Every structural gate cross-checks at least one independent semantic value, controlled adapter call, persisted manifest, state predicate, counter, retention snapshot, or export observation. The structural witness schema retains all of those channels and declares coverage explicitly.

The final lifecycle fixtures observe one BuilderCoordinator semantic authority, not separate publication and epoch owners. They require operation admission, immutable candidate production, staging result, authorization acceptance/rejection with reason, atomic-pointer adapter result, synchronous Generation/Publication/epoch install, replay-checkpoint comparison, first cleanup and backlog update, result settlement, and disposal transition. Private representation names are not gate identities.

Reader evidence covers only current-plus-direct-predecessor protection, manifest-derived generation/blob eligibility, shared blobs, recovery, residue, and explicit clean. There is no reader acquisition, lease, pin, pin-blocked retirement, or reader-blocked disposal fixture.

Diagnostic evidence uses Ticket 23's narrow `DiagnosticValue`, three public custom occurrence variants, private controlled source ranges, one generic opaque representation, no host taxonomy, and no dedicated Proxy detector.

### Independent verdict

The independent calculator accepts only the schema artifact, `EvidenceProtocol`, core `EvidenceBundle`, and CAS bytes referenced by the manifest. It may not access a checkout, network, clock, environment variable, directory enumeration, live Builder, product-private helper, mutable statistics object, or candidate module.

It revalidates every schema and hash, recomputes every statistic from raw samples, re-executes every structural oracle from semantic/adapters/manifests/state/counters/retention evidence, treats producer reports as comparison inputs only, records every discrepancy, and emits `IndependentVerdict` outside the core bundle. Any unresolved discrepancy makes the verdict invalid.

### Cross-ticket effect

Ticket 18's harness adapter has no migration action ID. Ticket 23 supplies the complete diagnostic/effect oracle. Ticket 24 supplies the one-coordinator publication/lifecycle oracle and external predecessor window. Ticket 11 may reapprove design readiness from these concrete design artifacts without requiring fabricated release measurements, but implementation and release acceptance still require the actual core bundle and external independent verdict.

No compatibility shim, product benchmark interface, public/process-global registry, implementation ticket, implementation plan, benchmark implementation, measured result, or release verdict is created by this resolution.
