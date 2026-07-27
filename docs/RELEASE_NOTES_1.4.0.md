# Lucky All Around 1.4.0

- Targets AFNM `0.7.6` and `afnm-types@0.7.6`.
- Preserves Force/Never Worse settings, rarity multipliers, legacy flag
  migration, Workshop identity, and `window.luckyAllAroundDebug`.
- Moves the runtime to the project Webpack bootstrap and splits weighting,
  configuration, interception, options, diagnostics, and bootstrap concerns.
- Adds deterministic weighting and interceptor-restoration tests.
- Revalidates the Explore hook order against installed `0.7.6-7c586da` and
  extends the runtime oracle for stat-filter buff interception, the complete
  buff registry, and Core Formation altar aggregation.
- Validates ZIP contents, metadata, and the absence of runtime `afnm-types`
  JavaScript before release.
