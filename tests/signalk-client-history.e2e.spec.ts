/**
 * SignalK Client History API Integration Tests
 *
 * Exercises getHistory/listHistoryPaths/listHistoryContexts against a live
 * SignalK server. The History API needs a history provider plugin (for example
 * signalk-to-influxdb); these tests probe for it in beforeAll and SKIP
 * gracefully (still passing) when it is absent, so they do not fail on a vanilla
 * server such as the Docker CI image (which runs with DISABLEPLUGINS=true).
 *
 * To run against a history-enabled server, point SIGNALK_HOST/PORT/TLS at it.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { SignalKClient } from '../src/signalk-client.js';
import * as dotenv from 'dotenv';

dotenv.config();

describe('SignalK Client History API - Live Integration', () => {
  let client: SignalKClient;
  let historyEnabled = false;
  let knownPaths: string[] = [];

  const CONNECTION_TIMEOUT = 30000;

  beforeAll(async () => {
    client = new SignalKClient({
      hostname: process.env.SIGNALK_HOST,
      port: parseInt(process.env.SIGNALK_PORT || '3000'),
      useTLS: process.env.SIGNALK_TLS === 'true',
      context: process.env.SIGNALK_CONTEXT || 'vessels.self',
    });

    try {
      await client.connect();
    } catch (error) {
      console.log(
        `History tests skipped - could not reach a SignalK server: ${(error as Error).message}`,
      );
      return;
    }

    // Probe for a history provider. available:false means none is installed.
    const contexts = await client.listHistoryContexts();
    if (!contexts.available) {
      console.log(
        'History tests skipped - SignalK server has no history provider installed',
      );
      return;
    }
    historyEnabled = true;

    const paths = await client.listHistoryPaths();
    knownPaths = paths.paths || [];
    console.log(
      `History provider present; ${knownPaths.length} historized paths found`,
    );
  }, CONNECTION_TIMEOUT);

  afterAll(() => {
    if (client && client.connected) {
      client.disconnect();
    }
  });

  test('listHistoryPaths reports an available provider and an array of paths', () => {
    if (!historyEnabled) {
      return; // skipped - no provider on this server
    }
    expect(Array.isArray(knownPaths)).toBe(true);
  });

  test(
    'getHistory returns a bounded per-path series for a recent window',
    async () => {
      if (!historyEnabled) {
        return; // skipped - no provider on this server
      }

      const preferred = [
        'navigation.speedOverGround',
        'navigation.position',
      ].filter((p) => knownPaths.includes(p));
      const target = preferred[0] || knownPaths[0];
      if (!target) {
        console.log('No historized paths to query - skipping');
        return;
      }

      const to = new Date();
      const from = new Date(to.getTime() - 60 * 60 * 1000); // last hour

      const h = await client.getHistory({
        paths: target,
        from: from.toISOString(),
        to: to.toISOString(),
        resolution: 300,
      });

      expect(h.available).toBe(true);
      expect(h.requestedPaths).toContain(target);
      expect(Array.isArray(h.series)).toBe(true);
      // Bounded result: ~12 buckets for one hour at 300s, never the full table.
      expect(typeof h.rowCount).toBe('number');
      expect(h.rowCount as number).toBeLessThan(1000);

      if (h.series.length > 0) {
        const points = h.values[h.series[0].path];
        expect(Array.isArray(points)).toBe(true);
        if (points.length > 0) {
          expect(points[0]).toHaveProperty('timestamp');
          expect(points[0]).toHaveProperty('value');
        }
      }
    },
    CONNECTION_TIMEOUT,
  );
});
