# 06 — Complete the Phase 3 collectEffect migration (flagship)

Status: resolved

## Outcome

The dual-surface `collectEffect` is gone; the two-arg declaration form is the single API, and the committed `Effect` shape is final.

- **`schema/effects.ts`**: deprecated `owner` fields deleted; `system` provenance now required; `AssetReferenceEffect` reshaped to `{ assetKey, template, metadata, blur?, system, request? }` (was `assetPath/publicUrl/resolved/isImage`); new exported `builtinDeclarationContext` (the `{ path: [], declaration: 0, occurrence: singleton }` context built-ins declare with); `AssetReferenceEffectDeclaration.source` documented as the **absolute** source path (round-1 docs said content-root-relative — wrong, contradicted by the existing two-arg tests).
- **Call sites migrated**: `s.unique` (`schema/unique.ts`), `s.file` / `s.image` (no longer embed `publicUrl`/`resolved` in effects — pure declarations), asset links (`content/execution/record.ts`), and the `ContentDeclaration` journal type is now the single `[declaration, context]` pair (variadic `...args` passthroughs in `record.ts` / `runner.ts` became explicit two-arg signatures).
- **`validate.ts` `normalizeEffect`**: declaration-only — drops the legacy spread branch; asset effects commit `assetKey` (via `assetKeyOf(effect.source, root)`) + `template` + `metadata` + `blur`.
- **Driver asset flow is now demand-based** (the real design decision): the driver re-demands `pipeline.asset` per distinct effect key instead of trusting effect-carried URLs.
  - `s.file`/`s.image` references: memo hit on the schema's own demand.
  - Declared-only references: the demand triggers the derivation's lazy read — **fixing the pre-existing gap where two-arg declared assets passed the missing-file gate but were never copied** (`content-html`/`content-mdx` fixtures' `declare` helpers now prove declared assets land in `public/static`).
  - Pass-2 condition simplified to `assetBytes.size > 0` (`hasUnresolvedAssets` was provably redundant); unresolved detection comes from the demanded `AssetResult.resolved`.
- **`emit.ts`**: `uniqueCandidates` + the final effect filter read `system.*` only; the `collectionByOwner` fallback map is deleted.
- **Tests updated**: `content-review` fixture (legacy asset call → two-arg), `content-html`/`content-mdx` `declare` helpers (legacy shape → two-arg declaration with `project.output.name` template), `slug.tests.ts` (asserts declarations, not committed effects), `schema-context` helper (single-aritiy forwarding).
- **Docs synced**: `types.md` (committed Effect shape, declaration section, single-signature `collectEffect`), `custom-schema.md`/`lifecycle.md` (round 1 already showed two-arg), `.agents/knowledge/schema-context.md`.

Verified: `pnpm build` + 629/629 tests green; `pnpm docs:build` green.
