const { zip } = require('zip-a-folder');
const path = require('path');
const fs = require('fs');
const { packageJson, buildDistPackageJson } = require('./mod-package');

async function zipDist() {
  const distPath = path.resolve(__dirname, `../dist/${packageJson.name}`);
  const buildsDir = path.resolve(__dirname, '../builds');
  const zipPath = path.resolve(buildsDir, `${packageJson.name}.zip`);
  const distPackageJsonPath = path.resolve(distPath, 'package.json');

  try {
    if (!fs.existsSync(buildsDir)) {
      fs.mkdirSync(buildsDir, { recursive: true });
    }

    fs.writeFileSync(
      distPackageJsonPath,
      `${JSON.stringify(buildDistPackageJson(), null, 2)}\n`,
      'utf8',
    );
    console.log('Wrote dist package.json with afnm-types gameVersion');

    await zip(distPath, zipPath);
    console.log(`Successfully zipped ${packageJson.name} to ${zipPath}`);
  } catch (error) {
    console.error('Error zipping dist folder:', error);
    process.exitCode = 1;
  }
}

zipDist();
