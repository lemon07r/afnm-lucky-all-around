const fs = require('fs');
const path = require('path');
const packageJson = require('../package.json');

const GAME_VERSION_PATH = path.join(
  path.dirname(require.resolve('afnm-types')),
  'gameVersion.js',
);
const GAME_VERSION_PATTERN = /GAME_VERSION\s*=\s*["']([^"']+)["']/;

function readAfnmGameVersion() {
  const gameVersionSource = fs.readFileSync(GAME_VERSION_PATH, 'utf8');
  const match = gameVersionSource.match(GAME_VERSION_PATTERN);

  if (!match) {
    throw new Error(`Unable to read AFNM game version from ${GAME_VERSION_PATH}`);
  }

  return match[1];
}

function buildModMetadata() {
  return {
    name: packageJson.name,
    version: packageJson.version,
    author: packageJson.author,
    description: packageJson.description,
    gameVersion: readAfnmGameVersion(),
  };
}

function buildDistPackageJson() {
  return {
    ...packageJson,
    gameVersion: readAfnmGameVersion(),
  };
}

module.exports = {
  packageJson,
  readAfnmGameVersion,
  buildModMetadata,
  buildDistPackageJson,
};
