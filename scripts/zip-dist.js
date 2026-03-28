const { zip } = require('zip-a-folder');
const packageJson = require('../package.json');
const path = require('path');
const fs = require('fs');

async function zipDist() {
  const distPath = path.resolve(__dirname, `../dist/${packageJson.name}`);
  const buildsDir = path.resolve(__dirname, '../builds');
  const zipPath = path.resolve(buildsDir, `${packageJson.name}.zip`);
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const distPackageJsonPath = path.resolve(distPath, 'package.json');

  try {
    if (!fs.existsSync(buildsDir)) {
      fs.mkdirSync(buildsDir, { recursive: true });
    }

    fs.copyFileSync(packageJsonPath, distPackageJsonPath);
    console.log('Copied package.json to dist folder');

    await zip(distPath, zipPath);
    console.log(`Successfully zipped ${packageJson.name} to ${zipPath}`);
  } catch (error) {
    console.error('Error zipping dist folder:', error);
    process.exitCode = 1;
  }
}

zipDist();
