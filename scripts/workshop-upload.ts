import * as fs from 'fs';
import * as path from 'path';

type CliArgs = {
  changeNote?: string;
  workshopId?: string;
  zipPath: string;
  previewImagePath?: string;
  title?: string;
  description?: string;
  tags?: string;
  visibility?: 'public' | 'friends' | 'private' | 'unlisted';
  skipBuild: boolean;
  skipUploaderPrepare: boolean;
  openWorkshopPage: boolean;
  allowCreate: boolean;
  json: boolean;
  help: boolean;
};

type PackageJson = {
  name: string;
  afnmWorkshop?: {
    workshopId?: string;
    title?: string;
    description?: string;
    tags?: string[];
    visibility?: 'public' | 'friends' | 'private' | 'unlisted';
    previewImagePath?: string;
  };
};

function printUsage(): void {
  console.log(`Lucky All Around workshop upload

Usage:
  bun run workshop:upload -- --change-note "What changed" --allow-create
  bun run workshop:upload -- --change-note "What changed" --workshop-id <id>

Options:
  --change-note <text>        Change notes for the workshop update
  --workshop-id <id>          Existing workshop item ID to update
  --allow-create              Create a new workshop item when no workshop ID exists
  --zip <path>                Override the default build zip path
  --title <text>              Override the default workshop title
  --description <text>        Override the default workshop description
  --tags <csv>                Override the default comma-separated workshop tags
  --visibility <value>        public | friends | private | unlisted
  --preview <path>            Optional preview image path
  --skip-build                Skip rebuilding before upload
  --skip-uploader-prepare     Skip rebuilding ModUploader-AFNM before upload
  --open-workshop-page        Open the workshop page in Steam overlay after upload
  --json                      Ask the uploader for machine-readable output
  --help                      Show this help
`);
}

function consumeValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[], packageJson: PackageJson, repoRoot: string): CliArgs {
  const workshopDefaults = packageJson.afnmWorkshop ?? {};
  const parsed: CliArgs = {
    workshopId: workshopDefaults.workshopId || undefined,
    zipPath: path.resolve(repoRoot, 'builds', `${packageJson.name}.zip`),
    previewImagePath: workshopDefaults.previewImagePath
      ? path.resolve(repoRoot, workshopDefaults.previewImagePath)
      : undefined,
    title: workshopDefaults.title,
    description: workshopDefaults.description,
    tags: workshopDefaults.tags?.join(','),
    visibility: workshopDefaults.visibility,
    skipBuild: false,
    skipUploaderPrepare: false,
    openWorkshopPage: false,
    allowCreate: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--help':
        parsed.help = true;
        break;
      case '--skip-build':
        parsed.skipBuild = true;
        break;
      case '--skip-uploader-prepare':
        parsed.skipUploaderPrepare = true;
        break;
      case '--open-workshop-page':
        parsed.openWorkshopPage = true;
        break;
      case '--allow-create':
        parsed.allowCreate = true;
        break;
      case '--json':
        parsed.json = true;
        break;
      case '--change-note':
        parsed.changeNote = consumeValue(argv, index, arg);
        index += 1;
        break;
      case '--workshop-id':
        parsed.workshopId = consumeValue(argv, index, arg);
        index += 1;
        break;
      case '--zip':
        parsed.zipPath = path.resolve(consumeValue(argv, index, arg));
        index += 1;
        break;
      case '--title':
        parsed.title = consumeValue(argv, index, arg);
        index += 1;
        break;
      case '--description':
        parsed.description = consumeValue(argv, index, arg);
        index += 1;
        break;
      case '--tags':
        parsed.tags = consumeValue(argv, index, arg);
        index += 1;
        break;
      case '--visibility':
        parsed.visibility = consumeValue(argv, index, arg) as CliArgs['visibility'];
        index += 1;
        break;
      case '--preview':
        parsed.previewImagePath = path.resolve(consumeValue(argv, index, arg));
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function runCommand(
  label: string,
  cmd: string[],
  cwd: string,
  captureOutput = false,
): { stdoutText?: string } {
  console.log(`\n== ${label} ==`);
  console.log(`$ ${cmd.join(' ')}`);

  const result = Bun.spawnSync({
    cmd,
    cwd,
    stdout: captureOutput ? 'pipe' : 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });

  if (result.exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${result.exitCode}`);
  }

  return {
    stdoutText:
      captureOutput && result.stdout
        ? Buffer.from(result.stdout).toString('utf8').trim()
        : undefined,
  };
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(import.meta.dir, '..');
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
  ) as PackageJson;
  const args = parseArgs(process.argv.slice(2), packageJson, repoRoot);

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.changeNote) {
    throw new Error('Missing required --change-note argument');
  }

  if (!args.workshopId && !args.allowCreate) {
    throw new Error(
      'Missing workshop ID. Set package.json#afnmWorkshop.workshopId, pass --workshop-id, or use --allow-create intentionally.',
    );
  }

  const uploaderRoot = path.resolve(repoRoot, '..', 'ModUploader-AFNM');

  if (!fs.existsSync(uploaderRoot)) {
    throw new Error(`ModUploader-AFNM not found at ${uploaderRoot}`);
  }

  if (!args.skipBuild) {
    runCommand('Build mod', [process.execPath, 'run', 'build'], repoRoot);
  }

  if (!fs.existsSync(args.zipPath)) {
    throw new Error(`Build zip not found at ${args.zipPath}`);
  }

  if (!args.skipUploaderPrepare) {
    runCommand(
      'Prepare ModUploader-AFNM',
      [process.execPath, 'run', 'cli:prepare'],
      uploaderRoot,
    );
  }

  const uploadArgs = [
    process.execPath,
    'run',
    'cli:upload',
    '--',
    '--zip',
    args.zipPath,
    '--change-note',
    args.changeNote,
  ];

  if (args.workshopId) {
    uploadArgs.push('--workshop-id', args.workshopId);
  } else if (args.allowCreate) {
    uploadArgs.push('--allow-create');
  }

  if (args.title) {
    uploadArgs.push('--title', args.title);
  }
  if (args.description) {
    uploadArgs.push('--description', args.description);
  }
  if (args.tags) {
    uploadArgs.push('--tags', args.tags);
  }
  if (args.visibility) {
    uploadArgs.push('--visibility', args.visibility);
  }
  if (args.previewImagePath) {
    uploadArgs.push('--preview', args.previewImagePath);
  }
  if (args.openWorkshopPage) {
    uploadArgs.push('--open-workshop-page');
  }
  if (args.json) {
    uploadArgs.push('--json');
  }

  const uploadResult = runCommand(
    'Upload to Steam Workshop',
    uploadArgs,
    uploaderRoot,
    args.json,
  );

  if (args.json && uploadResult.stdoutText) {
    console.log(uploadResult.stdoutText);
    return;
  }

  console.log('\nWorkshop upload completed.');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Workshop upload wrapper failed: ${message}`);
  printUsage();
  process.exit(1);
});
