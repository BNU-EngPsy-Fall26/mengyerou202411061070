import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "src");
const outputPath = join(projectRoot, "index.html");

const [html, css, coreSource, appSource] = await Promise.all([
  readFile(join(sourceRoot, "index.html"), "utf8"),
  readFile(join(sourceRoot, "styles.css"), "utf8"),
  readFile(join(sourceRoot, "core.js"), "utf8"),
  readFile(join(sourceRoot, "app.js"), "utf8"),
]);

const bundledCore = coreSource.replace(/^export\s+/gm, "");
const bundledApp = appSource.replace(/^import\s*\{[\s\S]*?\}\s*from\s*["']\.\/core\.js["'];\s*/u, "");

// 在写入文件前进行一次语法检查。
new Function(`${bundledCore}\n${bundledApp}`);

const standalone = html
  .replace('  <link rel="stylesheet" href="./styles.css">', () => `  <style>\n${css}\n  </style>`)
  .replace('  <script type="module" src="./app.js"></script>', () => `  <script>\n${bundledCore}\n${bundledApp}\n  </script>`);

if (standalone.includes('./styles.css') || standalone.includes('./app.js') || standalone.includes('./core.js')) {
  throw new Error("生成失败：index.html 中仍包含外部源码引用");
}

await writeFile(outputPath, standalone, "utf8");
console.log(`已生成：${outputPath}`);

