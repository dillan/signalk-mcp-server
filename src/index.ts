#!/usr/bin/env node

import * as dotenv from 'dotenv';
import { SignalKMCPServer } from './signalk-mcp-server.js';

// `quiet: true` suppresses dotenv v17's startup banner so nothing extraneous is
// written to stdout, which must carry only MCP JSON-RPC frames.
dotenv.config({ quiet: true });

// Handle unhandled promise rejections gracefully
process.on('unhandledRejection', (reason, _promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  // Don't exit the process for SignalK connection issues
});

const server = new SignalKMCPServer();
server.run().catch((error: any) => {
  console.error('Server startup failed:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
