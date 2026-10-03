# Releasing

## A beta

1. Bump the version everywhere: `package.json`, `packages/cinv/package.json`, `Cargo.toml`
   (`[workspace.package]`), `src-tauri/tauri.conf.json` (`version` and `bundle.windows.wix.version`,
   which is `1.0.0.N` for `1.0.0-beta.N` because MSI takes numbers only) and `extension/manifest.json`
   (`version` `1.0.0.N`, `version_name` `1.0.0-beta.N`). `npm run check:versions` says what is out of
   step.
2. Move the CHANGELOG entry from "not tagged yet" to the date, and update `docs/release-notes.md`.
3. Commit, then tag and push the tag: `git tag v1.0.0-beta.N && git push origin v1.0.0-beta.N`.
4. `.github/workflows/release.yml` checks that the tag matches `package.json`, runs `npm run verify`,
   builds the MSI and NSIS installers and the extension zip, and publishes them as a pre-release.
5. Install the MSI over the previous version on a real machine and open it once: the data must still be
   there, and `backups/` must hold the copy made before any migration.

## Signing (prepared, not switched on)

The installers are unsigned, so SmartScreen warns on first run. When the owner has a certificate:

- **Azure Trusted Signing** (cheapest for individuals): add a `signCommand` to
  `src-tauri/tauri.conf.json` under `bundle.windows`, for example
  `"signCommand": "trusted-signing-cli -e https://weu.codesigning.azure.net -a <account> -c <profile> %1"`,
  and give the release workflow `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` and `AZURE_TENANT_ID` as
  secrets.
- **A code-signing certificate (.pfx)**: import it in the workflow (`certutil`), and set
  `bundle.windows.certificateThumbprint`, `digestAlgorithm: "sha256"` and `timestampUrl`
  (`http://timestamp.digicert.com`). Keep the `.pfx` and its password only in repository secrets.

Both sign the app exe, the MSI and the NSIS installer during `tauri build`. Nothing else changes.

The extension is distributed as a zip for "Load unpacked"; a store listing would need a developer
account and a privacy declaration (it reads shop pages only, sends nothing anywhere but the local app).

## The updater

The app does not update itself. It compares its version with GitHub Releases at start (pre-releases
count only while the running version is one) and shows a notice with a link. A signed self-update with
`tauri-plugin-updater` can come after signing is in place.
