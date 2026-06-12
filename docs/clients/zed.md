# Connect Zed

[Zed](https://zed.dev) is a fast code editor with AI built in. This adds the
SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

Open Zed's settings file:

| Your computer | File |
|---------------|------|
| macOS / Linux | `~/.config/zed/settings.json` |
| Windows | `%APPDATA%\Zed\settings.json` |

You can also open it from Zed: **Command Palette → `zed: open settings`**. Add a
`context_servers` section — note Zed calls it `context_servers`, not
`mcpServers`:

```json
{
  "context_servers": {
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

If your settings file already has other settings, add `context_servers` as
another top-level key — don't replace what's there. Change the values to match
your server, and add `"SIGNALK_TOKEN": "your-token"` inside `env` if your server
needs a login.

## Check it works

Open the AI panel in Zed and check the tools list — `signalk` should appear.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
