# 0006. Versions and releases

- Status: accepted
- Date: 2026-10-03

## Decision

- The rebuilt app is `1.0.0-beta.N` until the owner accepts it. `package.json`, `src-tauri/tauri.conf.json`
  and every `Cargo.toml` in the workspace carry the same version; `tools/check-versions.mjs` fails CI when
  they differ.
- Windows Installer (MSI) versions must be numeric, so `bundle.windows.wix.version` is set to
  `1.0.0.N` for `1.0.0-beta.N`.
- Releases are tagged `vX.Y.Z[-beta.N]`; `.github/workflows/release.yml` builds the MSI, the NSIS
  installer and the extension zip and attaches them. `CHANGELOG.md` gets one section per release.
- Code signing is prepared (`bundle.windows.certificateThumbprint` and `signCommand` are documented in
  `docs/RELEASING.md`) and done last, by the owner's decision.
