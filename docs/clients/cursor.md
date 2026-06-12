# Connect Cursor

[Cursor](https://cursor.com) is an AI code editor. This adds the SignalK server
to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

Edit Cursor's MCP file:

| Scope | File |
|-------|------|
| Just this project | `.cursor/mcp.json` in the project folder |
| Everywhere | `~/.cursor/mcp.json` |

Add the server (create the file with this content if it's empty):

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

Change the values to match your server. Add `"SIGNALK_TOKEN": "your-token"`
inside `env` if your server needs a login.

## Check it works

Open **Settings → MCP** (or **Tools & Integrations → MCP**) in Cursor. You should
see `signalk` listed and connected.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
