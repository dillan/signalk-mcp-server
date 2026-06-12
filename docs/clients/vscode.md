# Connect VS Code (GitHub Copilot)

VS Code's [GitHub Copilot](https://code.visualstudio.com/docs/copilot/overview)
can use MCP servers in agent mode. This adds the SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

Create a file named `.vscode/mcp.json` in your project folder. **VS Code is
different from most assistants in two ways:** the section is called `servers`
(not `mcpServers`), and each server needs a `"type": "stdio"` line.

```json
{
  "servers": {
    "signalk": {
      "type": "stdio",
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

To make the server available in every project instead of just one, run
**MCP: Open User Configuration** from the Command Palette and add the same
`signalk` block there.

## Check it works

Open Copilot Chat, switch to **Agent** mode, and open the tools list — `signalk`
should appear. Then ask something like "what's my vessel's position?"

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
