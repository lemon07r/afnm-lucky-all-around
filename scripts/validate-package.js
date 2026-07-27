const path = require('path');
const packageJson = require('../package.json');
const { readAfnmGameVersion } = require('./mod-package');
const { readZipFiles } = require('./read-zip');

const root = path.resolve(__dirname, '..');
const zipPath = path.join(root, 'builds', `${packageJson.name}.zip`);

async function main() {
  const { entries, files } = await readZipFiles(zipPath, [
    'mod.js',
    'package.json',
  ]);

  for (const required of ['mod.js', 'package.json']) {
    if (!entries.some((entry) => entry.endsWith(required))) {
      throw new Error(`Release ZIP is missing ${required}`);
    }
  }

  const packageEntry = entries.find((entry) => entry.endsWith('package.json'));
  const modEntry = entries.find((entry) => entry.endsWith('mod.js'));
  const bundledPackage = JSON.parse(files.get(packageEntry));
  const bundle = files.get(modEntry);
  const expectedGameVersion = readAfnmGameVersion();

  if (
    bundledPackage.version !== packageJson.version ||
    bundledPackage.gameVersion !== expectedGameVersion
  ) {
    throw new Error(
      `Release metadata mismatch: expected ${packageJson.version} / AFNM ${expectedGameVersion}, received ${bundledPackage.version} / AFNM ${bundledPackage.gameVersion}`,
    );
  }
  if (
    bundle.includes('node_modules/afnm-types') ||
    bundle.includes('GAME_VERSION')
  ) {
    throw new Error('Bundle contains runtime afnm-types payload');
  }
  console.log(
    `Validated ${path.relative(root, zipPath)} (${entries.length} files)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
