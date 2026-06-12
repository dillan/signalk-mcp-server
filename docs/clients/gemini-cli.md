# Connect Gemini CLI (Google)

[Gemini CLI](https://github.com/google-gemini/gemini-cli) is Google's
command-line assistant. This adds the SignalK server to it.

New to this? Read the [setup checklist](README.md) first — you'll need Node.js
and your SignalK connection details.

## Add the server

Edit Gemini's settings file:

| Scope | File |
|-------|------|
| Just this project | `.gemini/settings.json` in the project folder |
| Everywhere | `~/.gemini/settings.json` |

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

Recent versions of Gemini CLI also have a `gemini mcp add` command, but the
settings file above works on every version and is the simplest to get right.

## Check it works

Start Gemini CLI and run `/mcp` to list connected servers, then ask it something
like "what's my vessel's position?"

Trouble? See [If something doesn't work](README.md#if-something-doesnt-work).
