const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const zhBackup = path.join(root, '.multilingual-build-zh');
const enBackup = path.join(root, '.multilingual-build-en');
const zhOutputConfig = path.join(root, '.multilingual-output-zh.yml');
const enOutputConfig = path.join(root, '.multilingual-output-en.yml');
const hexoCli = path.join(root, 'node_modules', 'hexo', 'bin', 'hexo');

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function useSharedStaticAssets(target) {
  const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml']);
  const sharedPath = /\/en\/(img|files|video|font|garph_code)\//gu;

  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const file = path.join(target, entry.name);
    if (entry.isDirectory()) {
      useSharedStaticAssets(file);
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const content = fs.readFileSync(file, 'utf8');
      const rewritten = content
        .replace(sharedPath, '/$1/')
        // Butterfly passes every menu URL through url_for(), which always
        // prepends the English root (/en/). This sentinel is the only
        // language-menu link that must escape that root to reach Chinese.
        .replaceAll('/en/_switch-to-zh/', '/');
      if (rewritten !== content) fs.writeFileSync(file, rewritten);
    }
  }
}

function runHexo(args) {
  const result = spawnSync(process.execPath, [hexoCli, ...args], {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Hexo failed with exit code ${result.status}`);

  // Hexo processors may log a per-file ERROR while still exiting with status 0.
  // Treat those partial builds as failures so translated posts cannot silently
  // disappear from the generated site.
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (/\bERROR\b|Process failed:/u.test(output)) {
    throw new Error('Hexo reported processing errors even though it exited successfully');
  }
}

function main() {
  remove(publicDir);
  remove(zhBackup);
  remove(enBackup);
  remove(zhOutputConfig);
  remove(enOutputConfig);

  // Building directly into isolated directories avoids renaming a large,
  // recently-written directory, which is unreliable on Windows due to brief
  // file locks from antivirus/indexing software.
  fs.writeFileSync(zhOutputConfig, 'public_dir: .multilingual-build-zh\n');
  fs.writeFileSync(enOutputConfig, 'public_dir: .multilingual-build-en\n');

  try {
    runHexo(['clean']);
    runHexo(['generate', '--config', '_config.yml,config-zh.yml,.multilingual-output-zh.yml']);

    // Run the English build in a fresh Hexo process with the English overrides.
    runHexo(['clean']);
    runHexo(['generate', '--config', '_config.yml,config-en.yml,.multilingual-output-en.yml', '--force']);
    useSharedStaticAssets(enBackup);

    fs.cpSync(zhBackup, publicDir, { recursive: true });
    if (fs.existsSync(enBackup)) {
      const enTarget = path.join(publicDir, 'en');
      remove(enTarget);
      fs.cpSync(enBackup, enTarget, { recursive: true });
    }
  } finally {
    // Restore the default site if the English build failed halfway through.
    if (!fs.existsSync(publicDir) && fs.existsSync(zhBackup)) {
      fs.cpSync(zhBackup, publicDir, { recursive: true });
    }
    remove(zhBackup);
    remove(enBackup);
    remove(zhOutputConfig);
    remove(enOutputConfig);
    remove(path.join(root, 'db.json'));
    remove(path.join(root, '_multiconfig.yml'));
  }
}

// Hexo automatically requires every JavaScript file in scripts/. Only execute
// the build orchestrator when Node runs this file directly from package.json.
if (require.main === module) main();
