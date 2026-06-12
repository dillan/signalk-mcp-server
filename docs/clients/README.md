# Connect your AI assistant

This SignalK MCP server lets an AI assistant read live data from your boat —
position, AIS targets, alarms, and more. These guides show how to connect the
assistant you use. Each one is short and copy-paste friendly.

## Pick your assistant

| Assistant | Type | Guide |
|-----------|------|-------|
| Claude Code | Command line | [claude-code.md](claude-code.md) |
| Claude Desktop | Desktop app | [claude-desktop.md](claude-desktop.md) |
| Codex (OpenAI) | Command line + editor | [codex-cli.md](codex-cli.md) |
| Gemini CLI (Google) | Command line | [gemini-cli.md](gemini-cli.md) |
| Cursor | Code editor | [cursor.md](cursor.md) |
| VS Code (GitHub Copilot) | Code editor | [vscode.md](vscode.md) |
| Windsurf | Code editor | [windsurf.md](windsurf.md) |
| Cline | VS Code extension | [cline.md](cline.md) |
| Zed | Code editor | [zed.md](zed.md) |

Don't see yours? Most assistants that support MCP use one of the formats above.
The [config in plain terms](#the-config-in-plain-terms) section explains the
pieces so you can adapt them.

## Before you start

You need three things:

1. **Node.js 18 or newer.** This comes with the `npx` command the assistant uses
   to start the server. Check it by running `node --version`. If you don't have
   it, install it from [nodejs.org](https://nodejs.org/).
2. **A running SignalK server** that this computer can reach.
3. **Your SignalK connection details** (below).

### Your SignalK connection details

You give these to the assistant as environment variables. Change the example
values to match your own server.

| Setting | What it is | Example |
|---------|------------|---------|
| `SIGNALK_HOST` | The address of your SignalK server. If it runs on this same computer, use `localhost`. | `localhost` |
| `SIGNALK_PORT` | The port your SignalK server listens on. Usually `3000`. | `3000` |
| `SIGNALK_TLS` | `true` if your server uses a secure connection (https/wss), otherwise `false`. | `false` |
| `SIGNALK_TOKEN` | Only needed if your server requires a login. Leave it out if it doesn't. | _(optional)_ |

## The config in plain terms

Every assistant starts the server the same way. It runs:

```
npx -y signalk-mcp-server
```

and passes your connection details as environment variables. You don't install
anything by hand — `npx` downloads the server the first time and reuses it after
that. The only difference between assistants is **which file** they read and
**what they call the section** that holds the server. Each guide gives you the
exact file and the exact text.

## Web assistants (the ChatGPT and Claude.ai websites)

These can't connect yet, and that's a real limit, not a missing setup step. A
website can only reach a server that is published on the public internet over a
secure (HTTPS) address. This server is built to run on your own machine and talk
over a local connection, so a website has no way to reach it. Use one of the
desktop or command-line assistants above instead.

## If something doesn't work

- **The assistant doesn't show any SignalK tools.** Fully quit and reopen the
  assistant after you edit its config — most read the file only at startup. Also
  check the file is valid; a single missing comma or bracket stops it loading.
- **The first run is slow or times out.** The very first start downloads the
  server, which can take a while on a slow connection. Open a terminal, run
  `npx -y signalk-mcp-server` once, and when it prints that it has started press
  `Ctrl+C` and try the assistant again.
- **It connects but shows no data.** Check `SIGNALK_HOST`, `SIGNALK_PORT`, and
  `SIGNALK_TLS` match your server. Confirm SignalK is running by opening
  `http://<host>:<port>/signalk` in a browser. If your server needs a login, set
  `SIGNALK_TOKEN`.
- **Keep numbers and true/false in quotes.** In these config files every value
  is text, so write `"3000"` and `"false"`, not `3000` or `false`.
