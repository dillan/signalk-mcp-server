# Connect Windsurf

[Windsurf](https://windsurf.com) is an AI code editor. This adds the SignalK
server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

Edit Windsurf's MCP file:

```
~/.codeium/windsurf/mcp_config.json
```

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
inside `env` if your server needs a login. You can also open this file from
**Windsurf Settings → Cascade → MCP servers → Manage MCPs**.

## Check it works

Open the MCP servers panel in Windsurf (Cascade) and refresh — `signalk` should
appear and connect.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
