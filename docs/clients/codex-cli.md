# Connect Codex (OpenAI)

[Codex](https://developers.openai.com/codex) is OpenAI's coding assistant. It
comes as a command-line tool and as an editor extension, and the two share the
same setup. This adds the SignalK server to both.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server (easiest)

Run this in a terminal, changing the values to match your server:

```bash
codex mcp add signalk \
  --env SIGNALK_HOST=localhost \
  --env SIGNALK_PORT=3000 \
  --env SIGNALK_TLS=false \
  -- npx -y signalk-mcp-server
```

Add `--env SIGNALK_TOKEN=your-token` if your server needs a login. The `--`
separates Codex's options from the command that starts the server.

## Or edit the file by hand

Codex reads `~/.codex/config.toml`. This file uses TOML, not JSON. Add:

```toml
[mcp_servers.signalk]
command = "npx"
args = ["-y", "signalk-mcp-server"]
env = { SIGNALK_HOST = "localhost", SIGNALK_PORT = "3000", SIGNALK_TLS = "false" }
```

Two things to watch for:

- The section is named `mcp_servers`, with an underscore.
- Keep every value in quotes, including `"3000"` and `"false"`. In TOML, leaving
  the quotes off turns them into a number or a true/false value, but these
  settings have to be plain text.

## Using Codex in your editor

Codex's editor extension shares the same `~/.codex/config.toml` file as the
command line, so you only set the server up once. If you'd rather edit the file
from the extension, open its gear menu and choose **Codex Settings → Open
config.toml**. Everything above applies the same way.

## Check it works

Start Codex and run `/mcp` to see connected servers, or run `codex mcp list`.

## Notes

- The first start downloads the server with `npx`, which can be slow. If Codex
  says the server timed out starting up, run `npx -y signalk-mcp-server` once in
  a terminal to download it, then try again.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
