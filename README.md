# @dwizi/create-dzx

Scaffold a new dzx MCP server project.

If you are new to MCP, think of it as a standard JSON-RPC protocol for exposing tools, resources, and prompts. `@dwizi/create-dzx` sets up a working repo so you can start building immediately.

## Usage

```bash
npx @dwizi/create-dzx@latest
```

Or with options:

```bash
npx @dwizi/create-dzx@latest my-agent --template basic --runtime node
```

## What it creates

Depending on the template, the scaffold includes:
- `mcp.json`
- `src/server.ts` (runtime entrypoint)
- `tools/` with a sample tool
- `resources/` and `prompts/` (for templates that include content)
- Package scripts for `dev`, `inspect`, and `build`

## Options

- `--dir <path>` - Target directory (default: `my-agent`)
- `--template <basic|tools-only|full>` - Template to scaffold
- `--runtime <node|deno>` - Runtime to configure
- `--install` - Install dependencies after scaffolding
- `--no-install` - Skip dependency installation
- `--yes` - Accept defaults
- `--force` - Overwrite existing files

## Templates

- **basic** - Tools + resources + prompts (recommended)
- **tools-only** - Minimal template with tools only
- **full** - Full-featured template with all features

## Package manager detection

`create-dzx` automatically detects your package manager by checking for lockfiles:
- `pnpm-lock.yaml` → pnpm
- `package-lock.json` → npm
- `yarn.lock` → yarn
- `bun.lockb` → bun

If no lockfile is found, it defaults to `pnpm`.

## Related

- The same scaffolding flow is available via `dzx init` inside an existing folder.
- dzx docs: `packages/dzx/docs` and the public docs site.
