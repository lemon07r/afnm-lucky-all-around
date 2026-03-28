# Release Process

1. Update `package.json` version.
2. Run validation:
   - `bun run build`
   - `bun run runtime:oracle`
   - confirm the in-game config and live inspector results in `docs/VALIDATION.md`
3. Push the release commit to `main`.
4. Upload the built zip to Steam Workshop from this repo:
   - update an existing item: `bun run workshop:upload -- --change-note "vX.Y.Z - What changed"`
   - create a new item intentionally: `bun run workshop:upload -- --change-note "vX.Y.Z - Initial release" --allow-create`
5. After the Workshop upload succeeds, push `git tag vX.Y.Z` to trigger `.github/workflows/release.yml`.

Notes:
- The GitHub Actions workflow only creates the GitHub Release asset. Steam Workshop publishing is the local pre-tag step, matching the CraftBuddy pipeline.
- `../ModUploader-AFNM` must exist locally and Steam must be running and logged in.
- Keep release notes explicit about the current default mode and multiplier when behavior changes.
