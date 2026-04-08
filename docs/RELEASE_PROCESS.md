# Release Process

Release snapshot: `2026-04-06`

1. Update `package.json` version.
2. Run validation:
   - `bun run typecheck`
   - `bun run build`
   - `bun run runtime:oracle`
   - confirm the current inspector flow in `docs/VALIDATION.md`
   - if you will do a manual native-client pass, copy the freshly built zip into the installed game's `mods/` directory first so the live client is not testing a stale local build
   - if you did a manual native-client pass, make sure the Mod Manager `CONTINUE` apply step succeeded before loading the save
3. Upload the built zip to Steam Workshop from this repo:
   - update an existing item: `bun run workshop:upload -- --change-note "vX.Y.Z - What changed" --visibility public`
   - create a new item intentionally: `bun run workshop:upload -- --change-note "vX.Y.Z - Initial release" --allow-create --visibility public`
4. Push the release commit to `main`.
5. After the Workshop upload succeeds, push `git tag vX.Y.Z` to trigger `.github/workflows/release.yml`.

Notes:

- The GitHub Actions workflow only creates the GitHub Release asset. Steam Workshop publishing is the local pre-tag step, matching the CraftBuddy pipeline.
- `../ModUploader-AFNM` must exist locally and Steam must be running and logged in.
- Keep release notes explicit about the current default mode and multiplier when behavior changes.
- The built mod metadata now resolves `gameVersion` from the installed `afnm-types` package, so release validation should always include `bun run typecheck` plus a clean rebuild.
