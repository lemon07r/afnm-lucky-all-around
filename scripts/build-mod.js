const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { packageJson, buildModMetadata } = require('./mod-package');

const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.resolve(rootDir, 'src/modContent/index.ts');
const outputDir = path.resolve(rootDir, 'dist', packageJson.name);
const outputPath = path.resolve(outputDir, 'mod.js');

function compileModContent() {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
      removeComments: false,
      sourceMap: false,
      inlineSourceMap: false,
      inlineSources: false,
      newLine: ts.NewLineKind.LineFeed,
    },
    fileName: sourcePath,
    reportDiagnostics: true,
  });

  const diagnostics = result.diagnostics ?? [];

  if (diagnostics.length > 0) {
    const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => '\n',
    });

    throw new Error(`TypeScript transpile diagnostics:\n${formatted}`);
  }

  const sanitizedOutput = result.outputText
    .replace(/^\s*export\s*\{\s*\};?\s*$/gm, '')
    .trim();

  const unexpectedModuleSyntax = sanitizedOutput.match(/^\s*(?:export|import)\s/m);
  if (unexpectedModuleSyntax) {
    throw new Error(
      `Browser bundle still contains module syntax: ${unexpectedModuleSyntax[0].trim()}`,
    );
  }

  return sanitizedOutput;
}

function buildUmdBundle(modContentCode) {
  const serializedMetadata = JSON.stringify(buildModMetadata());

  return `(function webpackUniversalModuleDefinition(root, factory) {
\tif(typeof exports === 'object' && typeof module === 'object')
\t\tmodule.exports = factory();
\telse if(typeof define === 'function' && define.amd)
\t\tdefine([], factory);
\telse if(typeof exports === 'object')
\t\texports["AFNMMod"] = factory();
\telse
\t\troot["AFNMMod"] = factory();
})(this, function () {
\t"use strict";
\tconst MOD_METADATA = ${serializedMetadata};

${modContentCode}

\treturn {
\t\tgetMetadata: function () {
\t\t\treturn MOD_METADATA;
\t\t},
\t};
});
`;
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const modContentCode = compileModContent();
  const bundle = buildUmdBundle(modContentCode);
  fs.writeFileSync(outputPath, bundle, 'utf8');
  console.log(`Built ${outputPath}`);
}

main();
