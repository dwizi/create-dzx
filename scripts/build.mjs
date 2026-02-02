import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "../..");
const dzxTemplatesDir = path.resolve(rootDir, "dzx/templates");
const createDzxDir = path.resolve(__dirname, "..");
const createDzxTemplatesDir = path.resolve(createDzxDir, "templates");

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

// Ensure templates directory exists
if (!fs.existsSync(createDzxTemplatesDir)) {
  fs.mkdirSync(createDzxTemplatesDir, { recursive: true });
}

// Copy templates from dzx package
if (!fs.existsSync(dzxTemplatesDir)) {
  console.error(`Error: Templates directory not found: ${dzxTemplatesDir}`);
  process.exit(1);
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
  fs.writeFileSync(templatePackagePath, JSON.stringify(pkg, null, 2) + "\n");
}

const dzxPackagePath = path.resolve(rootDir, "dzx", "package.json");
const dzxPackage = JSON.parse(fs.readFileSync(dzxPackagePath, "utf8"));
const dzxVersion = dzxPackage.version;
const templateNames = ["basic", "tools-only", "full"];
for (const name of templateNames) {
  updateTemplateDependency(name, dzxVersion);
}
