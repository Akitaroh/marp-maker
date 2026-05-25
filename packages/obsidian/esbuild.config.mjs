import esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';

const production = process.argv.includes('production');

// Dev サイクル用に、ビルド成果物を直接 Vault のプラグインディレクトリに書き出す
//（既存 mermaid-maker と同形態）。release 時は production フラグで minify。
const PLUGIN_OUT_DIR =
  '/Users/akitaroh/Desktop/Akitaroh/.obsidian/plugins/marp-maker';

const ensureDir = (p) => {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
};
const copyManifest = () => {
  ensureDir(PLUGIN_OUT_DIR);
  copyFileSync('manifest.json', `${PLUGIN_OUT_DIR}/manifest.json`);
};

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  outfile: `${PLUGIN_OUT_DIR}/main.js`,
  sourcemap: production ? false : 'inline',
  minify: production,
  treeShaking: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'copy-manifest',
      setup(build) {
        build.onStart(() => copyManifest());
      },
    },
    {
      // import された CSS は main.css で出る。Obsidian は plugin/styles.css を自動ロード。
      name: 'rename-css',
      setup(build) {
        build.onEnd(() => {
          const src = `${PLUGIN_OUT_DIR}/main.css`;
          const dst = `${PLUGIN_OUT_DIR}/styles.css`;
          if (existsSync(src)) {
            try {
              renameSync(src, dst);
            } catch {}
          }
        });
      },
    },
  ],
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  console.log('[marp-maker] esbuild watching... (output → Vault plugin dir)');
}
