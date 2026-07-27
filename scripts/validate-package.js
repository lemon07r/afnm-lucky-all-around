const { execFileSync } = require('child_process');
const path = require('path');
const packageJson = require('../package.json');

const root = path.resolve(__dirname, '..');
const zipPath = path.join(root, 'builds', `${packageJson.name}.zip`);
const entries = execFileSync('unzip', ['-Z1', zipPath], {
  encoding: 'utf8',
})
  .trim()
  .split('\n');

for (const required of ['mod.js', 'package.json']) {
  if (!entries.some((entry) => entry.endsWith(required))) {
    throw new Error(`Release ZIP is missing ${required}`);
  }
}

const packageEntry = entries.find((entry) => entry.endsWith('package.json'));
const modEntry = entries.find((entry) => entry.endsWith('mod.js'));
const bundledPackage = JSON.parse(
  execFileSync('unzip', ['-p', zipPath, packageEntry], { encoding: 'utf8' }),
);
const bundle = execFileSync('unzip', ['-p', zipPath, modEntry], {
  encoding: 'utf8',
});

if (
  bundledPackage.version !== packageJson.version ||
  bundledPackage.gameVersion !== '0.7.6'
) {
  throw new Error('Release metadata version/gameVersion mismatch');
}
if (bundle.includes('node_modules/afnm-types') || bundle.includes('GAME_VERSION')) {
  throw new Error('Bundle contains runtime afnm-types payload');
}
console.log(`Validated ${path.relative(root, zipPath)} (${entries.length} files)`);
