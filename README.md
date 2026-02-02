# create-dzx

Scaffold a new dzx MCP server project.

## Usage

```bash
npx create-dzx
```

Or with options:

```bash
npx create-dzx my-agent --template basic --runtime node
```

## Options

- `--dir <path>` - Target directory (default: `my-agent`)
- `--template <basic|tools-only|full>` - Template to scaffold
- `--runtime <node|deno>` - Runtime to configure
- `--install` - Install dependencies after scaffolding
- `--no-install` - Skip dependency installation
- `--yes` - Accept defaults
- `--force` - Overwrite existing files

## Templates

- **basic** - Includes tools, resources, and prompts
- **tools-only** - Minimal template with tools only
- **full** - Full-featured template with all features

## Package Manager Detection

`create-dzx` automatically detects your package manager by checking for lockfiles:
- `pnpm-lock.yaml` → pnpm
- `package-lock.json` → npm
- `yarn.lock` → yarn
- `bun.lockb` → bun

If no lockfile is found, it defaults to `pnpm`.
