# Connect Claude Code

[Claude Code](https://docs.claude.com/en/docs/claude-code) is Anthropic's
command-line assistant. This adds the SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server (easiest)

Run this in a terminal, changing the values to match your server:

```bash
claude mcp add signalk \
  -e SIGNALK_HOST=localhost \
  -e SIGNALK_PORT=3000 \
  -e SIGNALK_TLS=false \
  -- npx -y signalk-mcp-server
```

- `signalk` is the name you'll see for the server. You can change it.
- Each `-e` sets one connection detail. Add `-e SIGNALK_TOKEN=your-token` if your
  server needs a login.
- The `--` separates Claude Code's own options from the command that starts the
  server. Keep it.

By default the server is added for the current project only. Add `--scope user`
to use it everywhere on your computer, or `--scope project` to write a shared
`.mcp.json` file you can commit for your team.

## Or edit the file by hand

For a project, create `.mcp.json` in the project folder:

```json
{
  "mcpServers": {
    "signalk": {
      "command": "npx",
      "args": ["-y", "signalk-mcp-server"],
      "env": {
        "SIGNALK_HOST": "localhost",
        "SIGNALK_PORT": "3000",
        "SIGNALK_TLS": "false"
      }
    }
  }
}
```

## Check it works

Run `claude mcp list` and look for `signalk`, or start Claude Code and ask it
something like "what's my vessel's position?"

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
