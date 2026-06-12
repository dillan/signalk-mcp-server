# Connect Claude Desktop

[Claude Desktop](https://claude.com/download) is Anthropic's desktop app for
macOS and Windows. This adds the SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Open the config file

| Your computer | File to edit |
|---------------|--------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

You can also reach it from the app: **Settings → Developer → Edit Config**. If
the file is empty or missing, create it with the content below. (Claude Desktop
is not available on Linux.)

## Add the server

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

Fully quit and reopen Claude Desktop — this is required, because it reads the
file only at startup. Then ask it something like "what's my vessel's position?"
and the SignalK tools should be available.

## Notes

- **Windows:** if starting the server fails with an error mentioning `APPDATA` or
  a file that can't be found, add
  `"APPDATA": "C:\\Users\\<your-name>\\AppData\\Roaming\\"` inside `env`, and make
  sure Node.js is installed.

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
