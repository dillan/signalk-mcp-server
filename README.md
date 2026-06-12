# SignalK MCP Server

A Model Context Protocol (MCP) server that provides AI agents with efficient access to SignalK marine data using **code execution in V8 isolates**. This approach reduces token usage by **90-96%** compared to traditional MCP tools.

> **🚀 Version 1.0.6**: Now using code execution engine for massive token savings! See [CHANGELOG.md](CHANGELOG.md) for details.

## Why Code Execution?

Traditional MCP tools return ALL data to the AI, consuming massive amounts of tokens. This server uses **V8 isolates** (like Cloudflare Workers) to let AI agents run JavaScript code that filters data **before** returning it.

**Token Savings:**
- Vessel state queries: **94% reduction** (2,000 → 120 tokens)
- AIS target filtering: **95% reduction** (10,000 → 500 tokens)
- Multi-call workflows: **97% reduction** (13,000 → 300 tokens)

## Quick Start

### Installation

```bash
# Via npx (recommended)
npx signalk-mcp-server

# Or install globally
npm install -g signalk-mcp-server
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "signalk": {
      "command": "npx",
      "args": ["signalk-mcp-server"],
      "env": {
        "SIGNALK_HOST": "localhost",
        "SIGNALK_PORT": "3000",
        "SIGNALK_TLS": "false"
      }
    }
  }
}
```

### Basic Usage

**AI Agent Query:** "What's my vessel's position and the 3 closest AIS targets?"

**Code Execution (Automatic):**
```javascript
(async () => {
  // Get vessel position
  const vessel = await getVesselState();
  const position = vessel.data["navigation.position"]?.value;

  // Get AIS targets and filter in isolate
  const ais = await getAisTargets({ pageSize: 50 });
  const closest = ais.targets.slice(0, 3);

  return JSON.stringify({ position, closest });
})()
// Returns: ~300 tokens (97% savings vs legacy tools!)
```

## Features

### Code Execution Engine
- **V8 Isolate Sandbox**: Secure JavaScript execution
- **Client-side Filtering**: Process data before returning to AI
- **Multiple API Calls**: Combine operations in one execution
- **90-96% Token Savings**: Massive reduction in context window usage
- **Sub-100ms Overhead**: Fast execution with memory/timeout limits

### Available SDK Functions

When using `execute_code`, these functions are available. **IMPORTANT: ALL functions are async and MUST be awaited:**

```javascript
// Vessel data
const vessel = await getVesselState();

// AIS targets (with pagination and optional distance filter)
const ais = await getAisTargets({ page: 1, pageSize: 50, maxDistance: 5000 });

// System alarms
const alarms = await getActiveAlarms();

// Discover available data paths
const paths = await listAvailablePaths();

// Get specific path value (both string and object syntax work)
const speed = await getPathValue("navigation.speedOverGround");
const heading = await getPathValue({ path: "navigation.headingTrue" });

// Connection status - ALSO requires await!
const status = await getConnectionStatus();

// Recorded history over a time range (see "Historical Data" below)
const past = await getHistory({ paths: 'navigation.speedOverGround', from: '2026-06-11T06:00:00Z', resolution: 300 });
const historyPaths = await listHistoryPaths();    // which paths have history
```

### Real-time Marine Data
- Vessel position, heading, speed, wind
- AIS target tracking with distance calculations
- System notifications and alarms
- Dynamic SignalK path discovery
- Connection health monitoring

## Configuration

### Environment Variables

```env
# SignalK Connection (Required)
SIGNALK_HOST=localhost          # SignalK server hostname/IP
SIGNALK_PORT=3000              # SignalK server port
SIGNALK_TLS=false              # Use WSS/HTTPS (true/false)

# Execution Mode (Optional)
EXECUTION_MODE=code            # code (default) | tools (legacy) | hybrid

# Optional Settings
SERVER_NAME=signalk-mcp-server
SERVER_VERSION=1.0.6
```

### Execution Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **code** (default) | V8 isolate execution only | Production use, maximum efficiency |
| **tools** | Legacy MCP tools | Backward compatibility |
| **hybrid** | Both approaches available | Migration period |

## Examples

### Example 1: Filtered Vessel Data

**Query:** "Get my vessel name and position"

**Code:**
```javascript
(async () => {
  const vessel = await getVesselState();
  return JSON.stringify({
    name: vessel.data.name?.value,
    position: vessel.data["navigation.position"]?.value
  });
})()
```

**Result:** ~200 tokens (vs 2,000 with legacy tools)

### Example 2: Nearby Vessels

**Query:** "Show vessels within 1 nautical mile"

**Code:**
```javascript
(async () => {
  const ais = await getAisTargets({ pageSize: 50 });

  // Filter in isolate - huge savings!
  const nearby = ais.targets.filter(t =>
    t.distanceMeters && t.distanceMeters < 1852
  );

  return JSON.stringify({
    total: ais.count,
    nearby: nearby.length,
    vessels: nearby.slice(0, 5)
  });
})()
```

**Result:** ~300 tokens (vs 10,000 with legacy tools)

### Example 3: Critical Alarms Only

**Query:** "Any critical alarms?"

**Code:**
```javascript
(async () => {
  const alarms = await getActiveAlarms();

  const critical = alarms.alarms.filter(a =>
    a.state === "alarm" || a.state === "emergency"
  );

  return JSON.stringify({
    hasCritical: critical.length > 0,
    count: critical.length,
    details: critical
  });
})()
```

**Result:** ~100 tokens (vs 1,000 with legacy tools)

### Example 4: Multi-Call Workflow

**Query:** "Give me a situation report"

**Code:**
```javascript
(async () => {
  // All calls in ONE execution!
  const vessel = await getVesselState();
  const ais = await getAisTargets({ pageSize: 50 });
  const alarms = await getActiveAlarms();

  // Process everything in isolate
  const closeVessels = ais.targets.filter(t =>
    t.distanceMeters && t.distanceMeters < 1852
  ).length;

  const criticalAlarms = alarms.alarms.filter(a =>
    a.state === "alarm" || a.state === "emergency"
  ).length;

  return JSON.stringify({
    position: vessel.data["navigation.position"]?.value,
    speed: vessel.data["navigation.speedOverGround"]?.value,
    vesselsNearby: closeVessels,
    criticalAlarms: criticalAlarms
  });
})()
```

**Result:** ~300 tokens (vs 13,000 with 3 separate tool calls!)

## Historical Data (History API)

The SDK functions above return **live** values. The History API lets the AI look at **recorded** data over time - your track from this morning, how the wind built over the afternoon, how much the batteries drained overnight. As with everything else, the code runs in the isolate, so the AI can boil thousands of recorded points down to a few numbers before any of it reaches the model.

### Requirements

History is recorded by a separate SignalK plugin, so the requirements are on your **SignalK server** (not on this MCP server):

- **SignalK Server 2.15 or newer** (this is where the v2 History API lives).
- **A history provider plugin that is installed and recording**, most commonly [`signalk-to-influxdb`](https://www.npmjs.com/package/@signalk/signalk-to-influxdb) writing to an InfluxDB database. (`signalk-to-timescaledb` works too.)

If no provider is installed, the history functions still return safely with `available: false` - they never break code execution mode.

### Setup (on the SignalK server)

1. In the SignalK admin web page, open **Appstore → Available** and install **signalk-to-influxdb** (plus an InfluxDB database for it to write to - many boat setups already run one).
2. Turn the plugin on and let it record for a while so there is some history to query.
3. Point this MCP server at that SignalK server the usual way (`SIGNALK_HOST` / `SIGNALK_PORT` / `SIGNALK_TLS`). If your server needs a login to read history, set `SIGNALK_TOKEN`.

To check at any time whether history is turned on:

```javascript
(async () => {
  const probe = await listHistoryContexts();
  return JSON.stringify({ historyAvailable: probe.available });
})()
```

### History SDK functions

```javascript
// Query recorded values for one or more paths over a time range
const h = await getHistory({
  paths: 'navigation.speedOverGround',  // a path, or an array of paths
  from: '2026-06-11T06:00:00Z',         // ISO-8601; give "from" or "duration"
  to:   '2026-06-11T12:00:00Z',         // ISO-8601 (optional, defaults to now)
  resolution: 300                        // bucket size in SECONDS (300 = 5 min)
});

// Discover what is recorded
const paths    = await listHistoryPaths();     // which paths have history
const contexts = await listHistoryContexts();  // which vessels have history
```

**Good to know:**

- **Times are ISO-8601** (like `2026-06-11T06:00:00Z`) and **`resolution` is in seconds**, not milliseconds.
- Pick an **aggregation method per path** by adding it to the path: `'navigation.speedOverGround:max'` or `'environment.wind.speedApparent:sma:5'`. The default is `average` (and `first` for position).
- `getHistory` returns `{ available, values, series, rowCount }`. `values` is grouped by path, so `values['navigation.speedOverGround']` is a list of `{ timestamp, value }`.
- **Positions are `[longitude, latitude]` arrays** in history (the live API uses `{ latitude, longitude }`). `null` means there was no data in that bucket - drop nulls before averaging.
- Always check **`available`** first. `available: false` means no history provider is installed on the server.

### Sample use cases

| Ask | What the code does in the isolate |
|-----|-----------------------------------|
| "How far did we sail today, and our average speed while moving?" | Adds up speed over time for distance; ignores time at the dock |
| "How did the wind build this afternoon?" | Averages wind into short steps and reports the trend and biggest gust |
| "Show this morning's track" | Pulls position history and thins it down to a handful of waypoints |
| "How much did the batteries drain overnight?" | Totals battery current over the night into a simple energy summary |
| "When will we need to refuel?" | Fits a line through tank-level history to estimate burn rate and days left |
| "Any engine temperature spikes today?" | Scans engine-temp history for spikes and time at high RPM |
| "What was the roughest weather in the last two days?" | Finds the peak wind and the barometer trend |
| "The low-battery alarm just fired - what led up to it?" | Pulls the 30 minutes before the alarm and finds where the voltage dropped |

### Example 5: Distance sailed today

**Query:** "How far have we sailed today, and what's our average speed while moving?"

**Code:**
```javascript
(async () => {
  const h = await getHistory({
    paths: 'navigation.speedOverGround',
    from: '2026-06-11T00:00:00Z',
    to:   '2026-06-11T23:59:59Z',
    resolution: 60                       // 1-minute buckets
  });
  if (!h.available) return JSON.stringify({ note: h.error });

  const points = h.values['navigation.speedOverGround'].filter(p => p.value != null);

  let meters = 0, movingMinutes = 0;
  for (const p of points) {
    meters += p.value * 60;              // speed (m/s) over a 60s bucket
    if (p.value > 0.26) movingMinutes++; // moving if faster than ~0.5 knots
  }
  const movingHours = movingMinutes / 60;

  return JSON.stringify({
    distanceNm: (meters / 1852).toFixed(1),
    movingHours: movingHours.toFixed(1),
    avgKnotsWhileMoving: movingHours
      ? ((meters / (movingHours * 3600)) * 1.94384).toFixed(1)
      : '0'
  });
})()
```

**Result:** A 3-number summary instead of ~1,400 raw speed readings.

### Example 6: This morning's track

**Query:** "Show me the route we took this morning."

**Code:**
```javascript
(async () => {
  const h = await getHistory({
    paths: 'navigation.position',        // recorded as [longitude, latitude]
    from: '2026-06-11T06:00:00Z',
    to:   '2026-06-11T12:00:00Z',
    resolution: 120                      // a fix every 2 minutes
  });
  if (!h.available) return JSON.stringify({ note: h.error });

  const track = h.values['navigation.position']
    .filter(p => p.value != null)
    .map(p => ({ lon: p.value[0], lat: p.value[1], time: p.timestamp })); // [lon, lat]!

  return JSON.stringify({
    fixes: track.length,
    start: track[0],
    end: track[track.length - 1]
  });
})()
```

**Result:** A short list of waypoints instead of thousands of position fixes.

## Development

### Prerequisites

- Node.js 18.0.0 or higher
- Access to a SignalK server

### Setup

```bash
# Clone repository
git clone <repository-url>
cd signalk-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test:unit

# Run in development mode
npm run dev
```

### Testing

```bash
# Unit tests (fast)
npm run test:unit

# Integration tests (requires live SignalK server)
npm run test:e2e

# Full CI pipeline
npm run ci
```

## Architecture

### Code Execution Flow

```
AI Agent
  ↓
execute_code tool
  ↓
V8 Isolate Sandbox (isolated-vm)
  ↓
SignalK SDK Functions (all async, must await)
  ↓
SignalK Binding Layer (RPC-style)
  ↓
SignalK Client (HTTP REST API)
  ↓
SignalK Server
```

> **Note:** HTTP-only mode ensures fresh data on every request. WebSocket code is preserved for future streaming support.

### Key Components

- **Isolate Sandbox** (`src/execution-engine/isolate-sandbox.ts`): Secure V8 isolate execution
- **SignalK Binding** (`src/bindings/signalk-binding.ts`): RPC-style method invocation
- **SDK Generator** (`src/sdk/generator.ts`): Auto-generates SDK from tool definitions
- **SignalK Client** (`src/signalk-client.ts`): HTTP/WebSocket client for SignalK

### Security

- **Complete Isolation**: No access to Node.js globals
- **Memory Limits**: 128MB per execution
- **Timeout Protection**: 30s maximum execution time
- **No Credential Exposure**: SignalK auth handled by binding layer
- **Read-Only**: No write operations to SignalK server

## Migration from 1.x

### Breaking Changes

Version 1.0.6 changes the default mode from `hybrid` to `code`. Legacy tools are no longer available by default.

### Backward Compatibility

To use legacy tools, set the execution mode:

```json
{
  "mcpServers": {
    "signalk": {
      "env": {
        "EXECUTION_MODE": "tools"
      }
    }
  }
}
```

### Migration Guide

See [TOOL-MIGRATION-GUIDE.md](TOOL-MIGRATION-GUIDE.md) for complete migration examples.

**Before (Legacy):**
```
Tool: get_vessel_state
Returns: All vessel data (~2000 tokens)
```

**After (Code):**
```javascript
(async () => {
  const vessel = await getVesselState();
  return JSON.stringify({
    name: vessel.data.name?.value,
    position: vessel.data["navigation.position"]?.value
  });
})()
// Returns: ~200 tokens
```

## Troubleshooting

### Connection Issues

Check connection status (note: `await` is required):
```javascript
(async () => {
  const status = await getConnectionStatus();  // await is required!
  return JSON.stringify(status);
})()
```

### Legacy Mode

If you need legacy tools temporarily:
```bash
EXECUTION_MODE=tools npx signalk-mcp-server
```

### Debug Mode

Enable verbose logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Resources

- [SignalK Documentation](https://signalk.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [CHANGELOG.md](CHANGELOG.md) - Version history and migration guide
- [TOOL-MIGRATION-GUIDE.md](TOOL-MIGRATION-GUIDE.md) - Detailed migration examples
- [Claude Desktop MCP Docs](https://modelcontextprotocol.io/docs/tools/claude-desktop)

## Credits

Built with:
- [isolated-vm](https://github.com/laverdet/isolated-vm) - V8 isolate execution
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP TypeScript SDK
- SignalK community for the excellent marine data protocol

---

**🚢 Happy sailing with AI-powered marine data!**
