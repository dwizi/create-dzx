#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as clack from "@clack/prompts";

const TEMPLATES = ["basic", "tools-only", "full"];
const RUNTIMES = ["node", "deno"];

/**
 * Normalize a string into a filesystem-safe slug.
 */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Parse CLI argv into a simple key/value map.
 */
function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      args.positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

/**
 * Return true when the directory is missing or empty.
 */
function isEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  return fs.readdirSync(dir).length === 0;
}

/**
 * Recursively list files relative to the base directory.
 */
function listFiles(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath, baseDir));
    } else {
      files.push(path.relative(baseDir, entryPath));
    }
  }
  return files;
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

/**
 * Detect package manager from lockfiles or environment.
 */
function detectPackageManager(cwd) {
  const lockfiles = {
    "pnpm-lock.yaml": "pnpm",
    "package-lock.json": "npm",
    "yarn.lock": "yarn",
    "bun.lockb": "bun",
  };

  for (const [lockfile, pm] of Object.entries(lockfiles)) {
    if (fs.existsSync(path.join(cwd, lockfile))) {
      return pm;
    }
  }

  // Check parent directories (monorepo context)
  let current = cwd;
  for (let i = 0; i < 5; i++) {
    const parent = path.dirname(current);
    if (parent === current) break;
    for (const [lockfile, pm] of Object.entries(lockfiles)) {
      if (fs.existsSync(path.join(parent, lockfile))) {
        return pm;
      }
    }
    current = parent;
  }

  // Default to pnpm
  return "pnpm";
}

/**
 * Get install command for a package manager.
 */
function getInstallCommand(pm) {
  return `${pm} install`;
}

/**
 * Run a shell command in a given working directory.
 */
async function runCommand(command, cwd) {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, stdio: "inherit", shell: true });
    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${command}`));
    });
  });
}

/**
 * Resolve the templates directory for create-dzx.
 */
function resolveTemplatesRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const localTemplatesRoot = path.resolve(here, "..", "templates");
  if (fs.existsSync(localTemplatesRoot)) return localTemplatesRoot;
  // Fallback for when installed as npm package
  return path.resolve(process.cwd(), "node_modules", "create-dzx", "templates");
}

/**
 * Color utilities for terminal output.
 */
const useColor = Boolean(process.stdout.isTTY);
function color(code) {
  return (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
}

const colorize = {
  green: color("32"),
  cyan: color("36"),
  blue: color("34"),
  gray: color("90"),
  bold: color("1"),
  dim: color("2"),
};

const symbols = {
  check: useColor ? "✔" : "OK",
  step: useColor ? "●" : "*",
  brand: useColor ? "▲" : ">",
};

/**
 * Create a terminal spinner controller.
 */
function createSpinner(enabled) {
  const frames = ["◐", "◓", "◑", "◒"];
  let timer = null;
  let message = "";
  let frameIndex = 0;

  const clearLine = () => {
    if (!enabled) return;
    process.stdout.write("\r\x1b[2K");
  };

  const render = () => {
    if (!enabled) return;
    const frame = frames[frameIndex % frames.length];
    frameIndex += 1;
    process.stdout.write(`\r${colorize.gray(frame)}  ${message}`);
  };

  const start = (nextMessage) => {
    message = nextMessage;
    if (!enabled || timer) return;
    render();
    timer = setInterval(render, 80);
  };

  const update = (nextMessage) => {
    message = nextMessage;
    if (!enabled || !timer) return;
    render();
  };

  const pause = () => {
    if (!enabled || !timer) return;
    clearInterval(timer);
    timer = null;
    clearLine();
  };

  const resume = () => {
    if (!enabled || timer || !message) return;
    render();
    timer = setInterval(render, 80);
  };

  const stop = () => {
    pause();
    message = "";
  };

  return { start, update, pause, resume, stop, isEnabled: enabled };
}

/**
 * Print a aligned key/value summary list.
 */
function printKeyValueList(items) {
  if (items.length === 0) return;
  const maxLabel = items.reduce((max, item) => Math.max(max, item.label.length), 0);
  for (const item of items) {
    const padded = item.label.padEnd(maxLabel);
    // eslint-disable-next-line no-console
    console.log(
      `${colorize.gray(symbols.step)} ${colorize.gray(padded)} : ${colorize.cyan(item.value)}`,
    );
  }
}

/**
 * Get the latest version of @dwizi/dzx from npm registry.
 */
async function getDzxVersion() {
  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const dzxPkgJsonPath = require.resolve("@dwizi/dzx/package.json", { paths: [process.cwd()] });
    const dzxPkg = JSON.parse(fs.readFileSync(dzxPkgJsonPath, "utf8"));
    if (dzxPkg && typeof dzxPkg.version === "string" && dzxPkg.version.trim()) {
      return dzxPkg.version.trim();
    }
  } catch {
  }
  // Fallback version if we cannot resolve an installed @dwizi/dzx
  return "*";
}

/**
 * Main scaffolding function.
 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = Boolean(args.force);
  const isYes = Boolean(args.yes);
  const shouldInstall = args.install
    ? true
    : args["no-install"]
      ? false
      : true; // Default to installing for scaffold mode

  if (args.help || args.h) {
    // eslint-disable-next-line no-console
    console.log(`
${colorize.blue(symbols.brand)} ${colorize.bold("create-dzx")}

${colorize.bold("Usage")} ${colorize.gray("create-dzx [options]")}

${colorize.bold("Options")}
  ${colorize.cyan("--dir <path>".padEnd(20))} ${colorize.gray("target directory (default: my-agent)")}
  ${colorize.cyan("--template <basic|tools-only|full>".padEnd(20))} ${colorize.gray("template to scaffold")}
  ${colorize.cyan("--runtime <node|deno>".padEnd(20))} ${colorize.gray("runtime to configure")}
  ${colorize.cyan("--install".padEnd(20))} ${colorize.gray("install dependencies after scaffolding")}
  ${colorize.cyan("--no-install".padEnd(20))} ${colorize.gray("skip dependency installation")}
  ${colorize.cyan("--yes".padEnd(20))} ${colorize.gray("accept defaults")}
  ${colorize.cyan("--force".padEnd(20))} ${colorize.gray("overwrite existing files")}
`);
    return;
  }

  clack.intro("create-dzx");

  const dirArg = args.dir ?? args.positional[0];
  const defaultDir = "my-agent";

  let targetDir = path.resolve(process.cwd(), dirArg || defaultDir);
  if (!isYes) {
    const dirResponse = await clack.text({
      message: "Project directory",
      initialValue: dirArg || defaultDir,
    });
    if (clack.isCancel(dirResponse)) {
      clack.cancel("Aborted.");
      process.exit(1);
    }
    targetDir = path.resolve(process.cwd(), dirResponse || defaultDir);
  }

  let template = args.template || (isYes ? "basic" : undefined);
  if (!template) {
    const templateResponse = await clack.select({
      message: "Template",
      options: [
        { value: "basic", label: "basic" },
        { value: "tools-only", label: "tools-only" },
        { value: "full", label: "full" },
      ],
      initialValue: "basic",
    });
    if (clack.isCancel(templateResponse)) {
      clack.cancel("Aborted.");
      process.exit(1);
    }
    template = templateResponse;
  }

  let runtime = args.runtime || (isYes ? "node" : undefined);
  if (!runtime) {
    const runtimeResponse = await clack.select({
      message: "Runtime",
      options: [
        { value: "node", label: "node" },
        { value: "deno", label: "deno" },
      ],
      initialValue: "node",
    });
    if (clack.isCancel(runtimeResponse)) {
      clack.cancel("Aborted.");
      process.exit(1);
    }
    runtime = runtimeResponse;
  }

  template = template ?? "basic";
  runtime = runtime ?? "node";

  if (!TEMPLATES.includes(template)) {
    throw new Error(`Unknown template: ${template}`);
  }
  if (!RUNTIMES.includes(runtime)) {
    throw new Error(`Unknown runtime: ${runtime}`);
  }

  if (!force && !isEmptyDir(targetDir)) {
    throw new Error(`Target directory is not empty: ${targetDir}. Use --force to overwrite.`);
  }

  const templatesRoot = resolveTemplatesRoot();
  const templateDir = path.join(templatesRoot, template);
  if (!fs.existsSync(templateDir)) {
    throw new Error(`Template not found: ${template}`);
  }

  if (force && !isYes) {
    const confirmation = await clack.confirm({
      message: "This will overwrite existing files. Continue?",
      initialValue: false,
    });
    if (clack.isCancel(confirmation) || confirmation === false) {
      clack.cancel("Aborted.");
      process.exit(1);
    }
  }

  const spinner = createSpinner(process.stdout.isTTY);
  const stepLabels = [
    "Validating destination",
    "Copying template",
    "Configuring manifest",
    ...(shouldInstall ? ["Installing dependencies"] : []),
    "Finalizing",
  ];
  const stepLabelWidth = stepLabels.reduce((max, label) => Math.max(max, label.length), 0);
  const stepTimes = [];
  let stepStart = Date.now();
  let lastStep = "";
  let spinnerStarted = false;

  const logStep = (label, ms) => {
    const paddedLabel = label.padEnd(stepLabelWidth);
    const paddedMs = `${ms}ms`.padStart(6);
    const line = `${colorize.cyan(symbols.step)} ${colorize.gray(paddedLabel)} ${colorize.dim(paddedMs)}`;
    if (spinner.isEnabled) {
      spinner.pause();
      // eslint-disable-next-line no-console
      console.log(line);
      spinner.resume();
    } else {
      // eslint-disable-next-line no-console
      console.log(line);
    }
  };

  const step = (message) => {
    const now = Date.now();
    if (lastStep) {
      const ms = now - stepStart;
      stepTimes.push({ label: lastStep, ms });
      logStep(lastStep, ms);
    }
    lastStep = message;
    stepStart = now;
    if (spinner.isEnabled) {
      if (spinnerStarted) {
        spinner.update(message);
      } else {
        spinner.start(message);
        spinnerStarted = true;
      }
    }
  };

  const dzxVersion = await getDzxVersion();
  const banner = `${colorize.blue(symbols.brand)} ${colorize.bold("create-dzx")} ${colorize.gray("scaffold")}`;
  // eslint-disable-next-line no-console
  console.log(banner);

  step("Validating destination");
  if (!force) {
    const templateFiles = listFiles(templateDir);
    const collisions = templateFiles.filter((file) => fs.existsSync(path.join(targetDir, file)));
    if (collisions.length > 0) {
      const preview = collisions
        .slice(0, 8)
        .map((file) => `- ${file}`)
        .join("\n");
      const suffix = collisions.length > 8 ? "\n- ..." : "";
      throw new Error(
        `Refusing to overwrite existing files. Use --force to proceed.\n${preview}${suffix}`,
      );
    }
  }

  step("Copying template");
  copyDir(templateDir, targetDir);

  step("Configuring manifest");
  const manifestPath = path.join(targetDir, "mcp.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.name = slugify(path.basename(targetDir));
    manifest.runtime = runtime;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // Update package.json with correct @dwizi/dzx version
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.dependencies && pkg.dependencies["@dwizi/dzx"]) {
      pkg.dependencies["@dwizi/dzx"] = `^${dzxVersion}`;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    }
  }

  if (shouldInstall) {
    step("Installing dependencies");
    if (!fs.existsSync(pkgPath)) {
      if (spinner.isEnabled) spinner.stop();
      throw new Error("Missing package.json in template. Cannot install dependencies.");
    }
    const pm = detectPackageManager(targetDir);
    const installCommand = getInstallCommand(pm);
    try {
      await runCommand(installCommand, targetDir);
    } catch {
      if (spinner.isEnabled) spinner.stop();
      throw new Error(`Dependency installation failed. Run \`${installCommand}\` manually.`);
    }
  }

  step("Finalizing");
  if (lastStep) {
    const ms = Date.now() - stepStart;
    stepTimes.push({ label: lastStep, ms });
    logStep(lastStep, ms);
  }
  spinner.stop();

  const totalMs = stepTimes.reduce((sum, item) => sum + item.ms, 0);
  const summaryLines = [
    { label: "dir", value: targetDir },
    { label: "template", value: template },
    { label: "runtime", value: runtime },
    { label: "install", value: shouldInstall ? "yes" : "no" },
    { label: "ready", value: `${totalMs}ms` },
  ];
  // eslint-disable-next-line no-console
  console.log("");
  // eslint-disable-next-line no-console
  console.log(`${colorize.green(symbols.check)} ${colorize.bold("Project ready")}`);
  printKeyValueList(summaryLines);
  const pm = shouldInstall ? detectPackageManager(targetDir) : "pnpm";
  const nextSteps = [
    `cd ${path.basename(targetDir)}`,
    shouldInstall ? "dzx dev" : `${pm} install`,
    shouldInstall ? "" : "dzx dev",
  ].filter(Boolean);
  // eslint-disable-next-line no-console
  console.log(`${colorize.gray("next")} ${colorize.cyan(nextSteps.join(" && "))}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
