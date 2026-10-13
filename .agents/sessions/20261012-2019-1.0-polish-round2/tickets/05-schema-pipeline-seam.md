# 05 — Break the schema ↔ pipeline folder-level dependency cycle

Status: resolved

## Outcome

- New `src/core/assets.ts` — the neutral seam holding the shared asset identity + naming contract: `AssetResult` / `BlurOptions` / `AssetKey` types, `assetInput`, `assetKeyOf`, `renderAssetName` (private), `publicUrlOf`. `publicUrlOf` now takes `base: string` instead of `ResolvedConfig`, decoupling the seam from config entirely.
- `pipeline/asset.ts` keeps only the derivation (`createAssetDerivation` + placeholder/resolvedFile); its header now points at `../assets` for the identity contract.
- Updated consumers: `schema/{context,file,image,index}.ts`, `content/execution/record.ts`, `pipeline/{validate,index}.ts`, `driver.ts` (imports asset helpers from `./assets` directly), plus 7 test files (asset.tests.ts updated for the `base` param).
- `diagnostic.ts`: the two inline `import('./schema/effects')` type references converted to one top-level type-only import (effects.ts is import-free — no cycle).
- Pipeline barrel no longer re-exports the moved asset helpers (driver imports them from `./assets`).

Verified: `grep schema|content → pipeline` returns zero edges; `pnpm build` + 629/629 tests green.
