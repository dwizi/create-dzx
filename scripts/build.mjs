import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../..");
const createDzxDir = path.resolve(__dirname, "..");
const createDzxTemplatesDir = path.resolve(createDzxDir, "templates");
const srcEntry = path.resolve(createDzxDir, "src/index.ts");
const binOutput = path.resolve(createDzxDir, "bin/index.js");
const binDir = path.dirname(binOutput);

// Try to locate dzx/templates in monorepo sibling or node_modules
const monorepoTemplatesDir = path.resolve(rootDir, "dzx/templates");
const nodeModulesTemplatesDir = path.resolve(createDzxDir, "node_modules/@dwizi/dzx/templates");

let dzxTemplatesDir = monorepoTemplatesDir;
if (!fs.existsSync(dzxTemplatesDir)) {
  if (fs.existsSync(nodeModulesTemplatesDir)) {
    dzxTemplatesDir = nodeModulesTemplatesDir;
    console.log(`Using templates from node_modules: ${dzxTemplatesDir}`);
  } else {
    console.error(
      `Error: Templates directory not found in ${monorepoTemplatesDir} or ${nodeModulesTemplatesDir}`,
    );
    process.exit(1);
  }
} else {
  console.log(`Using templates from monorepo: ${dzxTemplatesDir}`);
}

/**
 * Copy a directory recursively.
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.mkdirSync(binDir, { recursive: true });
await esbuild.build({
  entryPoints: [srcEntry],
  outfile: binOutput,
  bundle: false,
  platform: "node",
  format: "esm",
  target: "node24",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
fs.chmodSync(binOutput, 0o755);

// Ensure templates directory exists
if (!fs.existsSync(createDzxTemplatesDir)) {
  fs.mkdirSync(createDzxTemplatesDir, { recursive: true });
}

console.log(`Copying templates from ${dzxTemplatesDir} to ${createDzxTemplatesDir}`);

// Remove existing templates
if (fs.existsSync(createDzxTemplatesDir)) {
  fs.rmSync(createDzxTemplatesDir, { recursive: true, force: true });
}

// Copy templates
copyDir(dzxTemplatesDir, createDzxTemplatesDir);

console.log("Templates copied successfully");

/**
 * Update the copied templates to pin the current @dwizi/dzx version.
 */
function updateTemplateDependency(templateName, version) {
  const templatePackagePath = path.resolve(createDzxTemplatesDir, templateName, "package.json");
  if (!fs.existsSync(templatePackagePath)) return;
  const contents = fs.readFileSync(templatePackagePath, "utf8");
  const pkg = JSON.parse(contents);
  pkg.dependencies = pkg.dependencies ?? {};
  pkg.dependencies["@dwizi/dzx"] = `^${version}`;
  fs.writeFileSync(templatePackagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

let dzxPackagePath = path.resolve(rootDir, "dzx", "package.json");
if (!fs.existsSync(dzxPackagePath)) {
  dzxPackagePath = path.resolve(createDzxDir, "node_modules/@dwizi/dzx/package.json");
}

if (!fs.existsSync(dzxPackagePath)) {
  console.error(`Error: dzx package.json not found at ${dzxPackagePath}`);
  process.exit(1);
}

const dzxPackage = JSON.parse(fs.readFileSync(dzxPackagePath, "utf8"));
const dzxVersion = dzxPackage.version;
const templateNames = ["basic", "tools-only", "full"];
for (const name of templateNames) {
  updateTemplateDependency(name, dzxVersion);
}
