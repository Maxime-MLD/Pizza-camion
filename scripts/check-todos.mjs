import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ignoredDirectories = new Set([
  ".astro",
  ".git",
  ".vercel",
  "coverage",
  "dist",
  "node_modules",
]);

const ignoredRelativeFiles = new Set([
  ".env.example",
  "package-lock.json",
  "scripts/check-todos.mjs",
]);

const documentationExtensions = new Set([".md", ".mdx"]);
const textExtensions = new Set([
  ".astro",
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".scss",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const placeholderPattern =
  /TODO_LEGAL|TODO_|TODO-|TODO:|example\.(?:com|org|net)|\.example\b/giu;

function toRelativePath(absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join("/");
}

function shouldIgnoreFile(relativePath) {
  return (
    ignoredRelativeFiles.has(relativePath) ||
    documentationExtensions.has(path.extname(relativePath).toLowerCase())
  );
}

function isTextFile(relativePath) {
  const basename = path.basename(relativePath);
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    textExtensions.has(path.extname(relativePath).toLowerCase())
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getForbiddenTermPatterns() {
  return (process.env.PRODUCTION_FORBIDDEN_TERMS ?? "")
    .split(";")
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term, index) => ({
      label: `PRODUCTION_FORBIDDEN_TERM_${index + 1}`,
      pattern: new RegExp(escapeRegExp(term), "giu"),
    }));
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function scanValue(value, relativePath, line, findings, patterns) {
  for (const { label, pattern } of patterns) {
    pattern.lastIndex = 0;

    if (pattern.test(value)) {
      findings.push({ relativePath, line, label });
    }
  }
}

async function main() {
  const findings = [];
  const forbiddenPatterns = getForbiddenTermPatterns();
  const patterns = [
    { label: "PLACEHOLDER_CRITIQUE", pattern: placeholderPattern },
    ...forbiddenPatterns,
  ];
  const files = await collectFiles(projectRoot);

  for (const absolutePath of files) {
    const relativePath = toRelativePath(absolutePath);

    if (shouldIgnoreFile(relativePath)) {
      continue;
    }

    scanValue(relativePath, relativePath, undefined, findings, patterns);

    if (!isTextFile(relativePath)) {
      continue;
    }

    const content = await readFile(absolutePath, "utf8");
    const lines = content.split(/\r?\n/u);

    lines.forEach((lineContent, index) => {
      scanValue(lineContent, relativePath, index + 1, findings, patterns);
    });
  }

  findings.sort((first, second) => {
    const pathComparison = first.relativePath.localeCompare(second.relativePath);
    return pathComparison || (first.line ?? 0) - (second.line ?? 0);
  });

  if (findings.length === 0) {
    console.log("✓ Aucun placeholder critique ni ancien identifiant configuré détecté.");
    return;
  }

  console.error(`✗ Livraison bloquée : ${findings.length} occurrence(s) critique(s) détectée(s).`);

  for (const finding of findings) {
    const location = finding.line
      ? `${finding.relativePath}:${finding.line}`
      : finding.relativePath;
    console.error(`- ${location} [${finding.label}]`);
  }

  console.error(
    "Remplacez les valeurs signalées ou déplacez les explications intentionnelles dans un fichier Markdown.",
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("Échec du contrôle de livraison.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
