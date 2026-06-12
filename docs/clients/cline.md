# Connect Cline

[Cline](https://cline.bot) is an AI assistant that runs as a VS Code extension.
This adds the SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

The reliable way is from inside the extension: open the **MCP Servers** icon in
Cline and choose **Configure MCP Servers**. That opens Cline's
`cline_mcp_settings.json` file for you, wherever it lives, and you paste the
server into it.

If you'd rather open the file yourself and you run Cline inside VS Code, it's in
VS Code's extension storage:

| Your computer | File |
|---------------|------|
| macOS | `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Windows | `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json` |
| Linux | `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |

Add the server:

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
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Change the values to match your server. Add `"SIGNALK_TOKEN": "your-token"`
inside `env` if your server needs a login. `"disabled": false` keeps the server
on, and `"autoApprove": []` means Cline asks before each tool runs — you can
leave both as shown.

## Check it works

Open the MCP Servers panel in Cline; `signalk` should show as connected.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
