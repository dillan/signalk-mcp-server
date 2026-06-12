import { Client } from '@signalk/client';
import { EventEmitter } from 'events';
import type {
  SignalKClientOptions,
  SignalKValue,
  SignalKDelta,
  AISTarget,
  ActiveAlarm,
  VesselState,
  AISTargetsResponse,
  ActiveAlarmsResponse,
  ConnectionStatus,
  AvailablePathsResponse,
  PathValueResponse,
  HistoryQueryOptions,
  HistoryResponse,
  HistorySeries,
  HistoryDataPoint,
  HistoryPathsResponse,
  HistoryContextsResponse,
  CourseStatusResponse,
} from './types/index.js';

export class SignalKClient extends EventEmitter {
  public hostname!: string;
  public port!: number;
  public useTLS!: boolean;
  public originalUrl!: string;
  public context: string;
  public connected: boolean;
  public latestValues: Map<string, SignalKValue>;
  public availablePaths: Set<string>;
  public aisTargets: Map<string, AISTarget>;
  public activeAlarms: Map<string, ActiveAlarm>;
  private client: any;
  private token?: string;

  constructor(options: SignalKClientOptions = {}) {
    super();

    // Set SignalK connection configuration directly from environment variables
    this.setSignalKConfig(options);

    // Store authentication token for HTTP requests
    this.token = options.token || process.env.SIGNALK_TOKEN;

    // WEBSOCKET CLIENT PRESERVED FOR FUTURE STREAMING SUPPORT
    // When MCP servers support streaming, this WebSocket client will enable
    // real-time data updates for live vessel tracking, sensor monitoring, etc.
    // Currently operating in HTTP-only mode for guaranteed data freshness.
    this.client = new Client({
      hostname: this.hostname,
      port: this.port,
      useTLS: this.useTLS,
      reconnect: true,
      autoConnect: false,  // WebSocket connection disabled for HTTP-only mode
      notifications: true,
      token: this.token,
      subscribe: 'all',
      useHttp: false,
      subscriptions: [
        {
          context: '*',
          subscribe: [
            {
              path: '*',
              period: 1000,
              format: 'delta',
              policy: 'ideal',
              minPeriod: 200,
            },
          ],
        },
      ],
    });

    this.context =
      options.context || process.env.SIGNALK_CONTEXT || 'vessels.self';
    this.connected = false;
    
    // DATA STRUCTURES PRESERVED FOR FUTURE STREAMING SUPPORT
    // These Maps/Sets would be populated via WebSocket deltas when streaming is enabled
    this.latestValues = new Map();    // Would cache real-time sensor values
    this.availablePaths = new Set();  // Would track discovered paths from deltas
    this.aisTargets = new Map();      // Would track real-time AIS vessel movements
    this.activeAlarms = new Map();    // Would track alarm state changes in real-time

    this.setupEventHandlers();
  }

  /**
   * Set SignalK connection configuration from environment variables with sensible defaults
   *
   * Environment Variables:
   * - SIGNALK_HOST: Hostname/IP (default: 'localhost')
   * - SIGNALK_PORT: Port number (default: 3000)
   * - SIGNALK_TLS: Use secure connections - true/false (default: false)
   *
   * Sets instance properties:
   * - hostname: The server hostname/IP (e.g., 'localhost', '192.168.1.100')
   * - port: The server port (e.g., 3000, 443, 80)
   * - useTLS: Whether to use secure connections (WSS/HTTPS vs WS/HTTP)
   *
   * @param options - Override options
   */
  setSignalKConfig(options: SignalKClientOptions = {}): void {
    // Set configuration directly from environment variables with defaults
    this.hostname = options.hostname || process.env.SIGNALK_HOST || 'localhost';
    const portValue = parseInt(
      String(options.port || process.env.SIGNALK_PORT || '3000'),
    );
    this.port = isNaN(portValue) ? 3000 : portValue;
    this.useTLS = options.useTLS || process.env.SIGNALK_TLS === 'true' || false;

    // Build original URL for display purposes
    const protocol = this.useTLS ? 'wss://' : 'ws://';
    this.originalUrl = `${protocol}${this.hostname}:${this.port}`;
  }

  /**
   * Build WebSocket URL for streaming connections
   * @returns WebSocket URL (ws:// or wss://)
   */
  buildWebSocketUrl(): string {
    const protocol = this.useTLS ? 'wss:' : 'ws:';
    const port = this.port === (this.useTLS ? 443 : 80) ? '' : `:${this.port}`;
    return `${protocol}//${this.hostname}${port}`;
  }

  /**
   * Build HTTP URL for REST API calls
   * @returns HTTP URL (http:// or https://)
   */
  buildHttpUrl(): string {
    const protocol = this.useTLS ? 'https:' : 'http:';
    const port = this.port === (this.useTLS ? 443 : 80) ? '' : `:${this.port}`;
    return `${protocol}//${this.hostname}${port}`;
  }

  /**
   * Build SignalK REST API URL for a specific vessel and path
   * @param vesselContext - Vessel context (e.g., 'self', 'urn:mrn:imo:mmsi:123456789')
   * @param path - SignalK path in dot notation (e.g., 'navigation.position')
   * @returns Complete REST API URL
   */
  buildRestApiUrl(vesselContext: string = 'self', path: string = ''): string {
    const baseUrl = this.buildHttpUrl();
    const restPath = path ? `/${path.replace(/\./g, '/')}` : '';
    return `${baseUrl}/signalk/v1/api/vessels/${vesselContext}${restPath}`;
  }

  /**
   * Build a SignalK v2 History API URL.
   *
   * The History API lives at /signalk/v2/api/history/<endpoint> - a different
   * base path from buildRestApiUrl (/signalk/v1/api/vessels/...). Query values
   * that are undefined or empty are dropped. Reserved characters in the path
   * expression (':' and ',') are percent-encoded by URLSearchParams and decoded
   * by the server before it splits them.
   *
   * @param endpoint - 'values', 'contexts', or 'paths'
   * @param params - query parameters; undefined/empty values are omitted
   * @returns Complete History API URL
   */
  buildHistoryApiUrl(
    endpoint: 'values' | 'contexts' | 'paths',
    params: Record<string, string | number | undefined> = {},
  ): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    }
    const queryString = query.toString();
    const suffix = queryString ? `?${queryString}` : '';
    return `${this.buildHttpUrl()}/signalk/v2/api/history/${endpoint}${suffix}`;
  }

  /**
   * Build a SignalK v2 course API URL (under .../navigation/course).
   * @param endpoint - '' for the course root, or 'calcValues'
   */
  buildCourseApiUrl(endpoint: string = ''): string {
    const suffix = endpoint ? `/${endpoint}` : '';
    return `${this.buildHttpUrl()}/signalk/v2/api/vessels/self/navigation/course${suffix}`;
  }

  /**
   * Current navigation course: active route / destination plus calculated values
   * (cross-track error, bearing, ETA, VMG, time-to-go). Reads /navigation/course
   * (the source of truth for whether a destination is set) and, only when one is
   * active, /navigation/course/calcValues. Returns navigating:false with
   * calcValues:null when not navigating. Never throws.
   */
  async getCourseStatus(): Promise<CourseStatusResponse> {
    // STUB - real implementation follows in the next commit.
    return {
      available: false,
      connected: this.connected,
      navigating: false,
      course: null,
      calcValues: null,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Build fetch options with authentication headers if token is configured
   * @returns RequestInit object with authorization header if token exists
   */
  private buildFetchOptions(): RequestInit {
    const options: RequestInit = {};
    if (this.token) {
      options.headers = {
        'Authorization': `Bearer ${this.token}`,
      };
    }
    return options;
  }

  /**
   * fetch() wrapped with an AbortController timeout and one bounded retry, so a
   * hung or flaky SignalK server fails fast and legibly instead of stalling a
   * tool call. Auth headers (buildFetchOptions) are applied automatically.
   * Returns the Response; callers handle response.ok / .json() as before.
   */
  private async fetchJson(
    url: string,
    init: RequestInit = {},
    opts: { timeoutMs?: number; retries?: number } = {},
  ): Promise<Response> {
    const timeoutMs = opts.timeoutMs ?? 10000;
    const retries = opts.retries ?? 1;
    const base = this.buildFetchOptions();

    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, {
          ...base,
          ...init,
          headers: { ...(base.headers as any), ...(init.headers as any) },
          signal: controller.signal,
        });
      } catch (error: any) {
        const aborted = error?.name === 'AbortError';
        lastError = aborted
          ? new Error(`Request timed out after ${timeoutMs}ms`)
          : error;
        // Retry once on a timeout only; a hard network/parse error fails fast.
        if (!aborted || attempt >= retries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timer);
      }
    }
    // Unreachable (the loop either returns or throws), satisfies the type checker.
    throw lastError;
  }

  /**
   * Sets up WebSocket event handlers for connection, disconnection, errors, and delta messages
   *
   * Event handlers:
   * - 'connect': Sets connected flag and emits 'connected' event
   * - 'disconnect': Clears connected flag and emits 'disconnected' event
   * - 'error': Logs errors and emits 'error' event
   * - 'delta': Processes incoming SignalK delta messages with vessel data updates
   *
   * @example
   * const client = new SignalKClient();
   * client.on('connected', () => console.log('Connected to SignalK'));
   * client.on('delta', (delta) => console.log('Received data:', delta));
   */
  setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.connected = true;
      console.error('SignalK client connected');
      this.emit('connected');
    });

    this.client.on('disconnect', () => {
      this.connected = false;
      console.error('SignalK client disconnected');
      this.emit('disconnected');
    });

    this.client.on('error', (error: any) => {
      console.error('SignalK client error:', error);
      this.emit('error', error);
    });

    this.client.on('delta', (delta: any) => {
      this.handleDelta(delta);
    });
  }

  /**
   * Establishes connection to SignalK server (HTTP-only mode)
   *
   * This method now operates in HTTP-only mode for maximum data freshness.
   * WebSocket functionality is preserved but disabled for future streaming capabilities
   * when MCP servers support real-time data streams.
   *
   * Features:
   * - Tests HTTP connectivity to SignalK server
   * - Sets connected status based on HTTP availability
   * - WebSocket code preserved for future streaming implementation
   *
   * @returns Promise that resolves when HTTP connection is verified
   *
   * @example
   * const client = new SignalKClient({ hostname: 'localhost', port: 3000 });
   * try {
   *   await client.connect();
   *   console.log('Connected successfully');
   * } catch (error) {
   *   console.error('Connection failed:', error);
   * }
   */
  async connect(): Promise<void> {
    // Test HTTP connectivity
    try {
      const apiUrl = this.buildRestApiUrl('self');
      const response = await this.fetchJson(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      this.connected = true;
      console.error('SignalK HTTP connection verified');
      this.emit('connected');
      
      // WEBSOCKET CONNECTION DISABLED FOR HTTP-ONLY MODE
      // The WebSocket client code below is preserved for future use when
      // MCP servers support streaming. This will enable real-time data
      // updates for features like live AIS tracking, sensor monitoring, etc.
      
      /* PRESERVED FOR FUTURE STREAMING SUPPORT:
      return new Promise((resolve, reject) => {
        if (this.connected) {
          resolve();
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.client.once('connect', async () => {
          clearTimeout(timeout);
          resolve();
        });

        this.client.once('error', (error: any) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.client.connect();
      });
      */
    } catch (error: any) {
      this.connected = false;
      console.error('SignalK HTTP connection failed:', error.message);
      throw new Error(`Failed to connect to SignalK server: ${error.message}`);
    }
  }

  /**
   * Fetches initial complete vessel state via HTTP API to populate cache immediately
   *
   * This method is called after WebSocket connection to ensure getVesselState()
   * has immediate access to complete vessel data instead of waiting for deltas.
   *
   * Features:
   * - HTTP GET to /signalk/v1/api/vessels/self for complete state
   * - Populates latestValues Map with all available paths
   * - Preserves current timestamp for each value
   * - Updates availablePaths Set automatically
   * - Graceful error handling - logs errors but doesn't throw
   *
   * @returns Promise that resolves when initial state is fetched and cached
   *
   * @private
   */
  private async fetchInitialVesselState(): Promise<void> {
    try {
      const apiUrl = this.buildRestApiUrl('self');
      const response = await this.fetchJson(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Recursively populate latestValues Map from the HTTP response
      this.populateLatestValuesFromData(data, this.context);
    } catch (error: any) {
      console.error(
        'Failed to fetch initial vessel state via HTTP:',
        error.message,
      );
      throw error; // Re-throw to be caught in connect() method
    }
  }

  /**
   * Recursively populates latestValues Map from SignalK API response data
   *
   * This helper method traverses the nested SignalK data structure and
   * extracts all value objects, storing them in the latestValues Map
   * with proper full path keys (context.path).
   *
   * @param obj - The SignalK data object to traverse
   * @param context - The vessel context (e.g., 'vessels.self')
   * @param pathPrefix - Current path prefix being built
   *
   * @private
   */
  private populateLatestValuesFromData(
    obj: any,
    context: string,
    pathPrefix = '',
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      // Skip metadata fields and null/undefined keys
      if (
        !key ||
        key.startsWith('$') ||
        key === 'meta' ||
        key === 'timestamp'
      ) {
        continue;
      }

      const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      // If this object has a 'value' property, it's a SignalK data point
      if (value && typeof value === 'object' && 'value' in value) {
        const fullPath = `${context}.${currentPath}`;

        // Store in latestValues Map with SignalK structure
        this.latestValues.set(fullPath, {
          value: (value as any).value,
          timestamp: (value as any).timestamp || new Date().toISOString(),
          source: (value as any).source,
        });

        // Add to available paths (only if currentPath is valid)
        if (currentPath && currentPath !== 'undefined') {
          this.availablePaths.add(currentPath);
        }
      }
      // If it's an object without 'value', recurse deeper
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.populateLatestValuesFromData(value, context, currentPath);
      }
    }
  }

  /**
   * Processes incoming SignalK delta messages and updates internal data stores
   *
   * Delta message processing:
   * - Updates latest values cache with timestamps
   * - Tracks AIS targets from other vessels
   * - Monitors system notifications and alarms
   * - Discovers available data paths automatically
   * - Emits 'delta' event for external listeners
   *
   * @param delta - SignalK delta message with vessel updates
   *
   * @example
   * // Delta messages are received automatically via WebSocket
   * client.on('delta', (delta) => {
   *   console.log('Vessel context:', delta.context);
   *   console.log('Updates:', delta.updates);
   * });
   */
  handleDelta(delta: SignalKDelta): void {
    try {
      if (delta.updates) {
        this.processUpdates(delta);
      }
      this.emit('delta', delta);
    } catch (error) {
      console.error('Error processing delta:', error);
    }
  }

  /**
   * Processes individual value updates from SignalK delta messages
   *
   * Update processing:
   * - Stores latest values with full path keys (context.path)
   * - Maintains set of available data paths
   * - Updates AIS target data for other vessels
   * - Processes notification/alarm state changes
   * - Preserves timestamps and source information
   *
   * @param message - SignalK delta message containing updates array
   *
   * @example
   * // Updates are processed automatically from delta messages:
   * // {
   * //   "context": "vessels.self",
   * //   "updates": [{
   * //     "timestamp": "2023-06-22T10:30:15Z",
   * //     "values": [{
   * //       "path": "navigation.position",
   * //       "value": {"latitude": 37.8199, "longitude": -122.4783}
   * //     }]
   * //   }]
   * // }
   */
  processUpdates(message: SignalKDelta): void {
    const context = message.context || this.context;

    message.updates.forEach((update) => {
      if (update.values) {
        update.values.forEach((value) => {
          const fullPath = `${context}.${value.path}`;

          this.latestValues.set(fullPath, {
            value: value.value,
            timestamp: update.timestamp || new Date().toISOString(),
            source: update.source,
          });

          this.availablePaths.add(value.path);

          if (context.startsWith('vessels.') && context !== this.context) {
            this.updateAISTarget(
              context,
              value.path,
              value.value,
              update.timestamp,
            );
          }

          if (value.path.startsWith('notifications.')) {
            this.updateAlarms(value.path, value.value, update.timestamp);
          }
        });
      }
    });
  }

  /**
   * Updates AIS target information for other vessels detected in the area
   *
   * AIS data tracking:
   * - Creates new target entries for unknown vessels
   * - Updates existing targets with latest position/course/speed data
   * - Maintains MMSI identifier and last update timestamp
   * - Supports any SignalK path (position, course, speed, name, etc.)
   *
   * @param vesselContext - Vessel context (e.g., 'vessels.urn:mrn:imo:mmsi:123456789')
   * @param path - SignalK data path (e.g., 'navigation.position')
   * @param value - The data value for this path
   * @param timestamp - ISO timestamp of the update
   *
   * @example
   * // AIS targets are updated automatically from delta messages:
   * // Context: "vessels.urn:mrn:imo:mmsi:123456789"
   * // Path: "navigation.position"
   * // Value: {"latitude": 37.8200, "longitude": -122.4800}
   *
   * const targets = client.getAISTargets();
   * console.log('Nearby vessels:', targets.targets.length);
   */
  updateAISTarget(
    vesselContext: string,
    path: string,
    value: any,
    timestamp: string,
  ): void {
    // Only process vessels with proper MMSI format (AIS targets)
    // Example: "vessels.urn:mrn:imo:mmsi:123456789"
    const mmsiMatch = vesselContext.match(/urn:mrn:imo:mmsi:(\d+)/);
    if (!mmsiMatch) {
      // Skip non-MMSI vessels (UUID-based vessels, other formats)
      return;
    }

    const mmsi = mmsiMatch[1]; // Extract the MMSI number
    const vesselId = vesselContext.replace('vessels.', '');

    if (!this.aisTargets.has(vesselId)) {
      this.aisTargets.set(vesselId, {
        mmsi: mmsi, // Use the extracted MMSI number
        lastUpdate: timestamp,
      });
    }

    const target = this.aisTargets.get(vesselId);
    if (target) {
      target[path] = value;
      target.lastUpdate = timestamp;
    }
  }

  /**
   * Updates active alarm and notification states from SignalK notification paths
   *
   * Alarm processing:
   * - Adds alarms when state is not 'normal' (alert, warn, alarm, emergency)
   * - Removes alarms when state returns to 'normal' or null
   * - Preserves alarm message and metadata
   * - Tracks timestamp of alarm state changes
   *
   * @param path - Notification path (e.g., 'notifications.engines.temperature')
   * @param value - Notification object with state and message
   * @param timestamp - ISO timestamp of the notification
   *
   * @example
   * // Alarms are updated automatically from notification paths:
   * // Path: "notifications.engines.temperature"
   * // Value: {
   * //   "state": "alert",
   * //   "message": "Engine temperature high",
   * //   "method": ["visual", "sound"]
   * // }
   *
   * const alarms = client.getActiveAlarms();
   * console.log('Active alarms:', alarms.count);
   */
  updateAlarms(path: string, value: any, timestamp: string): void {
    if (value && value.state) {
      this.activeAlarms.set(path, {
        path,
        state: value.state,
        message: value.message,
        timestamp,
      });
    } else if (value === null || value === undefined) {
      // Only delete if value is truly null/undefined (path no longer exists)
      this.activeAlarms.delete(path);
    }
    // Keep alarms in normal state - do not delete them
  }


  /**
   * Returns current vessel state with all available sensor data, navigation information, and vessel identity
   *
   * This method fetches fresh data directly from the SignalK HTTP API on each request,
   * ensuring that stale cached data is never returned. The response includes:
   * - All SignalK paths for the current vessel context (vessels.self by default)
   * - Vessel identity information (name, MMSI, call sign)
   * - Position, heading, speed, wind, engine data, etc.
   * - Latest values with timestamps and source information
   * - Connection status and context information
   *
   * @returns Promise<VesselState> object with fresh data from SignalK server
   *
   * @example
   * const state = await client.getVesselState();
   * console.log('Vessel name:', state.data['name']?.value);
   * console.log('Position:', state.data['navigation.position']?.value);
   * console.log('Speed:', state.data['navigation.speedOverGround']?.value);
   * console.log('Wind:', state.data['environment.wind']?.value);
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "context": "vessels.self",
   * //   "timestamp": "2023-06-22T10:30:15.123Z",
   * //   "data": {
   * //     "name": {
   * //       "value": "My Vessel",
   * //       "timestamp": "2023-06-22T10:30:15.000Z",
   * //       "source": "vessel-identity"
   * //     },
   * //     "navigation.position": {
   * //       "value": {"latitude": 37.8199, "longitude": -122.4783},
   * //       "timestamp": "2023-06-22T10:30:15.000Z",
   * //       "source": {"label": "GPS1", "type": "NMEA0183"}
   * //     },
   * //     "navigation.speedOverGround": {
   * //       "value": 5.2,
   * //       "timestamp": "2023-06-22T10:30:15.000Z"
   * //     }
   * //   }
   * // }
   */
  async getVesselState(): Promise<VesselState> {
    try {
      const apiUrl = this.buildRestApiUrl('self');
      const response = await this.fetchJson(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const vesselData = await response.json();
      const state: any = {};
      
      // Format the vessel data into the expected structure
      const formatData = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          // Skip metadata fields
          if (key.startsWith('$') || key === 'meta' || key === 'timestamp') {
            continue;
          }
          
          const currentPath = prefix ? `${prefix}.${key}` : key;
          
          // If this object has a 'value' property, it's a SignalK data point
          if (value && typeof value === 'object' && 'value' in value) {
            state[currentPath] = {
              value: (value as any).value,
              timestamp: (value as any).timestamp || new Date().toISOString(),
              source: (value as any).source,
            };
          }
          // If it's an object without 'value', recurse deeper
          else if (value && typeof value === 'object' && !Array.isArray(value)) {
            formatData(value, currentPath);
          }
        }
      };
      
      // Process the nested vessel data
      formatData(vesselData);
      
      // Add top-level vessel properties as synthetic paths
      if (vesselData.name) {
        state['name'] = {
          value: vesselData.name,
          timestamp: new Date().toISOString(),
          source: 'vessel-identity',
        };
      }
      if (vesselData.mmsi) {
        state['mmsi'] = {
          value: vesselData.mmsi,
          timestamp: new Date().toISOString(),
          source: 'vessel-identity',
        };
      }
      if (vesselData.communication?.callsignVhf) {
        state['communication.callsignVhf'] = {
          value: vesselData.communication.callsignVhf,
          timestamp: new Date().toISOString(),
          source: 'vessel-identity',
        };
      }
      
      return {
        connected: this.connected,
        context: this.context,
        data: state,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      // Return empty state with error indication
      return {
        connected: false,
        context: this.context,
        data: {},
        timestamp: new Date().toISOString(),
        error: `Failed to fetch vessel state: ${error.message}`,
      };
    }
  }

  /**
   * Calculates the distance between two geographic coordinates using the Haversine formula
   * 
   * @param lat1 - Latitude of first point
   * @param lon1 - Longitude of first point
   * @param lat2 - Latitude of second point
   * @param lon2 - Longitude of second point
   * @returns Distance in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Pattern-based filtering for AIS data fields
   * Determines if a SignalK path should be included in AIS target data
   * 
   * @param path - SignalK data path to check
   * @returns true if the path should be included, false otherwise
   */
  private shouldIncludeAISPath(path: string): boolean {
    // Include patterns for navigation-relevant data
    const includePatterns = [
      /^navigation\./,     // All navigation data (position, speed, course, heading, etc.)
      /^design\./,         // Vessel characteristics (length, beam, type, etc.)
      /^name$/,            // Vessel name (top-level)
      /^communication\./,  // Call signs and communication identifiers
      /^registrations\./,  // IMO numbers and other registrations
      /^destination\./,    // Voyage-related information
    ];

    // Exclude patterns for internal vessel systems
    // Note: We don't need explicit exclude patterns since we're using a whitelist approach
    // Only paths matching include patterns will be included
    
    // Check if path matches any include pattern
    return includePatterns.some(pattern => pattern.test(path));
  }

  /**
   * Returns nearby AIS targets (other vessels) with their position and navigation data
   *
   * This method fetches fresh AIS data directly from the SignalK HTTP API on each request,
   * ensuring that stale cached data is never returned. The response includes:
   * - Only vessels with proper MMSI identifiers (true AIS targets)
   * - Position, course, speed, and vessel identification
   * - Distance in meters from self vessel (when positions available)
   * - Sorted by proximity (closest vessels first)
   * - Supports pagination with configurable page size
   * - Only includes targets updated within last 5 minutes
   *
   * @param page - Page number (1-based, default: 1)
   * @param pageSize - Number of targets per page (default: 10, max: 50)
   * @returns Promise<AISTargetsResponse> with array of nearby vessels
   *
   * @example
   * const targets = await client.getAISTargets(1, 10);
   * console.log(`Found ${targets.count} nearby vessels`);
   * console.log(`Page ${targets.pagination.page} of ${targets.pagination.totalPages}`);
   *
   * targets.targets.forEach(target => {
   *   console.log(`MMSI: ${target.mmsi}`);
   *   if (target.distanceMeters) {
   *     console.log(`Distance: ${target.distanceMeters}m`);
   *   }
   *   if (target['navigation.position']) {
   *     console.log(`Position: ${target['navigation.position'].value.latitude}, ${target['navigation.position'].value.longitude}`);
   *   }
   * });
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "count": 2,
   * //   "timestamp": "2023-06-22T10:30:15.123Z",
   * //   "targets": [
   * //     {
   * //       "mmsi": "123456789",
   * //       "distanceMeters": 1852.5,
   * //       "navigation.position": {
   * //         "value": {"latitude": 37.8200, "longitude": -122.4800},
   * //         "timestamp": "2023-06-22T10:29:45.000Z"
   * //       },
   * //       "lastUpdate": "2023-06-22T10:29:45.000Z"
   * //     }
   * //   ],
   * //   "pagination": {
   * //     "page": 1,
   * //     "pageSize": 10,
   * //     "totalCount": 15,
   * //     "totalPages": 2,
   * //     "hasNextPage": true,
   * //     "hasPreviousPage": false
   * //   }
   * // }
   */
  async getAISTargets(page: number = 1, pageSize: number = 10): Promise<AISTargetsResponse> {
    try {
      // Validate pagination parameters
      pageSize = Math.min(Math.max(1, pageSize), 50); // Clamp between 1 and 50
      page = Math.max(1, page);

      // First, get self vessel position and MMSI for distance calculation and filtering
      let selfPosition: { latitude: number; longitude: number } | undefined = undefined;
      let selfMmsi: string | undefined = undefined;
      try {
        const selfData = await this.getVesselState();
        const positionData = selfData.data['navigation.position'];
        if (positionData && positionData.value && 
            typeof positionData.value === 'object' &&
            'latitude' in positionData.value && 
            'longitude' in positionData.value) {
          selfPosition = positionData.value as { latitude: number; longitude: number };
        }
        // Get self vessel's MMSI if available
        if (selfData.data['mmsi'] && selfData.data['mmsi'].value) {
          selfMmsi = String(selfData.data['mmsi'].value);
        }
      } catch {
        // Failed to get self vessel data - continue without distance calculation
      }

      // Fetch all vessels from the API
      const apiUrl = `${this.buildHttpUrl()}/signalk/v1/api/vessels`;
      const response = await this.fetchJson(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const vesselsData = await response.json();
      const targets: AISTarget[] = [];
      const now = Date.now();
      
      // Process each vessel
      for (const [vesselId, vesselData] of Object.entries(vesselsData)) {
        // Skip self and non-object entries
        if (vesselId === 'self' || typeof vesselData !== 'object') {
          continue;
        }
        
        // Only process vessels with proper MMSI format (true AIS targets)
        const mmsiMatch = vesselId.match(/urn:mrn:imo:mmsi:(\d+)/);
        if (!mmsiMatch) {
          continue;
        }
        
        const mmsi = mmsiMatch[1];
        
        // Skip if this MMSI matches self vessel's MMSI
        if (selfMmsi && mmsi === selfMmsi) {
          continue;
        }
        const target: AISTarget = {
          mmsi: mmsi,
          lastUpdate: new Date().toISOString(),
        };
        
        // Extract vessel data and check freshness
        let mostRecentTimestamp = 0;
        let targetLatitude: number | undefined = undefined;
        let targetLongitude: number | undefined = undefined;
        
        const extractData = (obj: any, prefix = '') => {
          for (const [key, value] of Object.entries(obj)) {
            if (key.startsWith('$') || key === 'meta') {
              continue;
            }
            
            const path = prefix ? `${prefix}.${key}` : key;
            
            if (value && typeof value === 'object' && 'value' in value) {
              // Only include paths that match our AIS data patterns
              if (this.shouldIncludeAISPath(path)) {
                target[path] = value;
              }
              
              // Always capture position for distance calculation (even if not included in output)
              if (path === 'navigation.position' && value.value && 
                  typeof value.value === 'object' && 
                  'latitude' in value.value && 
                  'longitude' in value.value) {
                targetLatitude = Number(value.value.latitude);
                targetLongitude = Number(value.value.longitude);
              }
              
              // Track most recent update
              if ((value as any).timestamp) {
                const timestamp = new Date((value as any).timestamp).getTime();
                if (timestamp > mostRecentTimestamp) {
                  mostRecentTimestamp = timestamp;
                  target.lastUpdate = (value as any).timestamp;
                }
              }
            } else if (value && typeof value === 'object' && !Array.isArray(value)) {
              extractData(value, path);
            }
          }
        };
        
        extractData(vesselData);
        
        // Handle top-level vessel properties that don't have value structure
        if (vesselData && typeof vesselData === 'object' && 'name' in vesselData && this.shouldIncludeAISPath('name')) {
          target.name = (vesselData as any).name;
        }
        
        // Only include if data is less than 5 minutes old
        if (mostRecentTimestamp > 0 && (now - mostRecentTimestamp) < 300000) {
          // Calculate distance if both positions are available
          if (selfPosition && targetLatitude !== undefined && targetLongitude !== undefined) {
            target.distanceMeters = this.calculateDistance(
              selfPosition.latitude,
              selfPosition.longitude,
              targetLatitude,
              targetLongitude
            );
          }
          targets.push(target);
        }
      }
      
      // Sort by distance (closest first)
      targets.sort((a, b) => {
        // Targets with distance come first
        if (a.distanceMeters !== undefined && b.distanceMeters !== undefined) {
          return a.distanceMeters - b.distanceMeters;
        }
        if (a.distanceMeters !== undefined) return -1;
        if (b.distanceMeters !== undefined) return 1;
        // For targets without distance, sort by last update
        return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
      });
      
      // Calculate pagination
      const totalCount = targets.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedTargets = targets.slice(startIndex, endIndex);
      
      return {
        connected: this.connected,
        count: paginatedTargets.length,
        targets: paginatedTargets,
        timestamp: new Date().toISOString(),
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error: any) {
      // Return empty targets list with error indication
      return {
        connected: false,
        count: 0,
        targets: [],
        timestamp: new Date().toISOString(),
        error: `Failed to fetch AIS targets: ${error.message}`,
      };
    }
  }

  /**
   * Returns all alarms and system notifications including resolved (normal state) alarms
   *
   * This method fetches fresh alarm data directly from the SignalK HTTP API on each request,
   * ensuring that stale cached data is never returned. The response includes:
   * - All notification paths from the current vessel
   * - Alarm states: alert, warn, alarm, emergency, and normal (resolved)
   * - Notification messages and metadata
   * - Fresh timestamps for each notification
   *
   * @returns Promise<ActiveAlarmsResponse> with array of all notifications
   *
   * @example
   * const alarms = await client.getActiveAlarms();
   * console.log(`${alarms.count} total alarms (including resolved)`);
   *
   * // Filter for only critical alarms
   * const criticalAlarms = alarms.alarms.filter(alarm =>
   *   alarm.state !== 'normal'
   * );
   * console.log(`${criticalAlarms.length} critical alarms`);
   *
   * alarms.alarms.forEach(alarm => {
   *   console.log(`${alarm.state}: ${alarm.message || 'No message'}`);
   *   console.log(`Path: ${alarm.path}`);
   *   console.log(`Time: ${alarm.timestamp}`);
   * });
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "count": 2,
   * //   "timestamp": "2023-06-22T10:30:15.123Z",
   * //   "alarms": [
   * //     {
   * //       "path": "notifications.engines.temperature",
   * //       "state": "normal",
   * //       "message": "Engine temperature normal",
   * //       "timestamp": "2023-06-22T10:25:30.000Z"
   * //     },
   * //     {
   * //       "path": "notifications.battery.voltage",
   * //       "state": "alert",
   * //       "message": "Battery voltage low",
   * //       "timestamp": "2023-06-22T10:28:45.000Z"
   * //     }
   * //   ]
   * // }
   */
  async getActiveAlarms(): Promise<ActiveAlarmsResponse> {
    try {
      const apiUrl = this.buildRestApiUrl('self');
      const response = await this.fetchJson(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const vesselData = await response.json();
      const alarms: any[] = [];
      
      // Extract notifications from vessel data
      const extractNotifications = (obj: any, pathPrefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          if (key.startsWith('$') || key === 'meta') {
            continue;
          }
          
          const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
          
          // Check if this is a notification path
          if (currentPath.startsWith('notifications.') && value && typeof value === 'object' && 'value' in value) {
            const notifValue = (value as any).value;
            if (notifValue && notifValue.state) {
              alarms.push({
                path: currentPath,
                state: notifValue.state,
                message: notifValue.message || '',
                timestamp: (value as any).timestamp || new Date().toISOString(),
              });
            }
          } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            extractNotifications(value, currentPath);
          }
        }
      };
      
      // Extract all notifications
      if (vesselData.notifications) {
        extractNotifications({ notifications: vesselData.notifications });
      }
      
      return {
        connected: this.connected,
        count: alarms.length,
        alarms: alarms,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      // Return empty alarms list with error indication
      return {
        connected: false,
        count: 0,
        alarms: [],
        timestamp: new Date().toISOString(),
        error: `Failed to fetch alarms: ${error.message}`,
      };
    }
  }

  /**
   * Discovers and returns all available SignalK data paths on the server
   *
   * Path discovery:
   * - Primary: Uses HTTP REST API to get complete path list from server
   * - Fallback: Uses WebSocket-discovered paths if HTTP fails
   * - Filters out metadata fields ($schema, meta, timestamp)
   * - Returns sorted alphabetical list of available data paths
   *
   * @returns Promise<AvailablePathsResponse> with array of available paths
   *
   * @example
   * const pathsResponse = await client.listAvailablePaths();
   * console.log(`${pathsResponse.count} paths available`);
   *
   * pathsResponse.paths.forEach(path => {
   *   console.log(`Available: ${path}`);
   * });
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "count": 25,
   * //   "timestamp": "2023-06-22T10:30:15.123Z",
   * //   "paths": [
   * //     "electrical.batteries.house.voltage",
   * //     "environment.wind.speedApparent",
   * //     "navigation.courseOverGround",
   * //     "navigation.position",
   * //     "navigation.speedOverGround",
   * //     "propulsion.main.temperature"
   * //   ]
   * // }
   */
  async listAvailablePaths(): Promise<AvailablePathsResponse> {
    const paths = new Set<string>();

    try {
      // Use helper method to build REST API URL
      const apiUrl = this.buildRestApiUrl('self');

      const response = await this.fetchJson(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Recursively extract all paths from the data
      const extractPaths = (obj: any, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          // Skip metadata fields
          if (key.startsWith('$') || key === 'meta' || key === 'timestamp') {
            continue;
          }

          const currentPath = prefix ? `${prefix}.${key}` : key;

          // If this object has a 'value' property, it's a data point
          if (value && typeof value === 'object' && 'value' in value) {
            paths.add(currentPath);
          }
          // If it's an object without 'value', recurse deeper
          else if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value)
          ) {
            extractPaths(value, currentPath);
          }
        }
      };

      extractPaths(data);

      return {
        connected: this.connected,
        count: paths.size,
        paths: Array.from(paths).sort(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('Failed to fetch paths via HTTP:', error.message);

      // Fallback to WebSocket-discovered paths
      return {
        connected: this.connected,
        count: this.availablePaths.size,
        paths: Array.from(this.availablePaths).sort(),
        timestamp: new Date().toISOString(),
        error: `HTTP fetch failed: ${error.message}, using WebSocket-discovered paths`,
      };
    }
  }

  /**
   * Gets the latest value for a specific SignalK data path
   *
   * Value retrieval:
   * - Primary: Uses HTTP REST API for real-time data from server
   * - Fallback: Uses WebSocket-cached value if HTTP fails
   * - Returns complete value object with metadata
   * - Supports any valid SignalK path
   *
   * @param path - SignalK data path in dot notation (e.g., 'navigation.position')
   * @returns Promise<PathValueResponse> with latest value and metadata
   *
   * @example
   * // Get current position
   * const position = await client.getPathValue('navigation.position');
   * console.log('Latitude:', position.data.value.latitude);
   * console.log('Longitude:', position.data.value.longitude);
   *
   * // Get wind speed
   * const windSpeed = await client.getPathValue('environment.wind.speedApparent');
   * console.log('Wind speed:', windSpeed.data.value, 'm/s');
   *
   * // Get engine temperature
   * const engineTemp = await client.getPathValue('propulsion.main.temperature');
   * console.log('Engine temp:', engineTemp.data.value, 'K');
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "path": "navigation.position",
   * //   "timestamp": "2023-06-22T10:30:15.123Z",
   * //   "data": {
   * //     "value": {
   * //       "latitude": 37.8199,
   * //       "longitude": -122.4783
   * //     },
   * //     "timestamp": "2023-06-22T10:30:15.000Z",
   * //     "source": {
   * //       "label": "GPS1",
   * //       "type": "NMEA0183"
   * //     }
   * //   }
   * // }
   */
  async getPathValue(path: string): Promise<PathValueResponse> {
    try {
      // Use helper method to build REST API URL for the specific path
      const apiUrl = this.buildRestApiUrl('self', path);

      const response = await this.fetchJson(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        connected: this.connected,
        path,
        data: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`Failed to fetch path ${path} via HTTP:`, error.message);

      // Fallback to WebSocket-cached value
      const fullPath = `${this.context}.${path}`;
      const cachedData = this.latestValues.get(fullPath);

      return {
        connected: this.connected,
        path,
        data: cachedData || null,
        timestamp: new Date().toISOString(),
        error: `HTTP fetch failed: ${error.message}, using cached value`,
      };
    }
  }

  /**
   * Query aggregated historical time-series for one or more SignalK paths.
   *
   * Hits the SignalK v2 History API (/signalk/v2/api/history/values) and folds
   * its tabular response into per-path series. Unlike getPathValue there is NO
   * cache fallback - history has no live cache. The method never throws; it
   * always returns a HistoryResponse whose `available` flag tells callers
   * whether a history provider answered.
   *
   * @param options - paths plus a time window (from/to or duration), resolution
   *                  in SECONDS, optional default aggregate, and context
   * @returns HistoryResponse with `series` (one entry per response column) and a
   *          convenience `values` map keyed by path
   */
  async getHistory(options: HistoryQueryOptions): Promise<HistoryResponse> {
    // Normalize and coerce paths to strings up front so stray non-string input
    // from untyped isolate code can never throw before the request is built.
    const rawPaths = Array.isArray(options?.paths) ? options.paths : [options?.paths];
    const requestedPaths = rawPaths
      .filter((p) => p !== undefined && p !== null)
      .map((p) => String(p));

    const empty = (available: boolean, error?: string): HistoryResponse => ({
      available,
      connected: this.connected,
      resolution: options?.resolution,
      requestedPaths,
      series: [],
      values: {},
      missingPaths: requestedPaths.map((p) => p.split(':')[0]),
      timestamp: new Date().toISOString(),
      ...(error ? { error } : {}),
    });

    if (requestedPaths.length === 0) {
      return empty(true, 'Invalid history query: at least one path is required');
    }

    // Validate the time window. The server requires at least one of `from` or
    // `duration`; a missing/`to`-only window or a non-ISO time is a client
    // error, reported distinctly from a missing provider and without a request.
    const from = this.normalizeIso(options.from);
    if (options.from !== undefined && from === undefined) {
      return empty(true, 'Invalid history query: "from" must be an ISO-8601 time (e.g. 2026-06-11T06:00:00Z)');
    }
    const to = this.normalizeIso(options.to);
    if (options.to !== undefined && to === undefined) {
      return empty(true, 'Invalid history query: "to" must be an ISO-8601 time (e.g. 2026-06-11T12:00:00Z)');
    }
    const duration = options.duration !== undefined ? String(options.duration) : undefined;
    if (from === undefined && duration === undefined) {
      return empty(true, 'Invalid history query: provide "from" or "duration"');
    }

    const pathsParam = requestedPaths
      .map((p) => this.composeHistoryPath(p, options.aggregate))
      .join(',');

    const url = this.buildHistoryApiUrl('values', {
      context: options.context ?? this.context,
      paths: pathsParam,
      from,
      to,
      duration,
      resolution: options.resolution,
      provider: options.provider,
    });

    try {
      const response = await this.fetchJson(url);
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const { available, error } = this.classifyHistoryFailure(response.status, detail.slice(0, 200));
        return empty(available, error);
      }
      const body: any = await response.json();
      return this.transformHistoryValues(body, requestedPaths, options.resolution);
    } catch (error: any) {
      console.error('Failed to fetch history values via HTTP:', error.message);
      const { available, error: message } = this.classifyHistoryFailure(undefined, error?.message || String(error));
      return empty(available, message);
    }
  }

  /**
   * List SignalK paths that have historical data in a time window.
   * @returns HistoryPathsResponse; `available:false` means no history provider
   */
  async listHistoryPaths(
    options: { from?: string; to?: string; duration?: string | number; context?: string } = {},
  ): Promise<HistoryPathsResponse> {
    const r = await this.fetchHistoryStringList('paths', options);
    return {
      available: r.available,
      connected: this.connected,
      count: r.items.length,
      paths: r.items,
      timestamp: new Date().toISOString(),
      ...(r.error ? { error: r.error } : {}),
    };
  }

  /**
   * List vessel contexts that have historical data in a time window.
   * @returns HistoryContextsResponse; `available:false` means no history provider
   */
  async listHistoryContexts(
    options: { from?: string; to?: string; duration?: string | number } = {},
  ): Promise<HistoryContextsResponse> {
    const r = await this.fetchHistoryStringList('contexts', options);
    return {
      available: r.available,
      connected: this.connected,
      count: r.items.length,
      contexts: r.items,
      timestamp: new Date().toISOString(),
      ...(r.error ? { error: r.error } : {}),
    };
  }

  /**
   * Build one entry of the comma-separated `paths` param. A path may already
   * carry an inline aggregation method (path:method[:param]); if so it is left
   * untouched. Otherwise an optional default `aggregate` is applied - but never
   * to navigation.position (the server aggregates positions with "first").
   */
  private composeHistoryPath(pathExpr: string, aggregate?: string): string {
    const hasInlineMethod = pathExpr.split(':').length >= 2;
    if (hasInlineMethod || !aggregate) {
      return pathExpr;
    }
    if (pathExpr === 'navigation.position') {
      return pathExpr;
    }
    return `${pathExpr}:${aggregate}`;
  }

  /**
   * Coerce a time input to an ISO-8601 string. Accepts a Date or epoch-ms
   * number; passes a valid ISO-ish string through; returns undefined for input
   * that cannot be a real instant (so the caller can report a clear error).
   */
  private normalizeIso(value: unknown): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    if (typeof value === 'number') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? undefined : value;
    }
    return undefined;
  }

  /**
   * Map an HTTP status (or network error) to history availability + message.
   * 404/501 or a network error means no provider is installed (available:false).
   * 400/422 means the provider exists but the request was bad (available:true).
   * 401/403 means the provider exists but needs auth (available:true).
   */
  private classifyHistoryFailure(
    status: number | undefined,
    detail: string,
  ): { available: boolean; error: string } {
    const suffix = detail ? `: ${detail}` : '';
    if (status === 404 || status === 501) {
      return {
        available: false,
        error: `History API not available - no history provider installed on the SignalK server (HTTP ${status})`,
      };
    }
    if (status === 400 || status === 422) {
      return { available: true, error: `Invalid history query (HTTP ${status})${suffix}` };
    }
    if (status === 401 || status === 403) {
      return {
        available: true,
        error: `History API requires authentication - set SIGNALK_TOKEN (HTTP ${status})`,
      };
    }
    return {
      available: false,
      error: `History API request failed${status ? ` (HTTP ${status})` : ''}${suffix}`,
    };
  }

  /**
   * Convert the server's tabular history response into per-path series. The
   * response `values` array is authoritative: column i+1 of each data row maps
   * to values[i].path. We iterate the response columns (never the request) so
   * reordered, duplicate, or absent paths are handled correctly.
   */
  private transformHistoryValues(
    body: any,
    requestedPaths: string[],
    resolution?: number,
  ): HistoryResponse {
    const columns: Array<{ path: string; method: string }> = Array.isArray(body?.values)
      ? body.values
      : [];
    const rows: any[][] = Array.isArray(body?.data) ? body.data : [];

    const series: HistorySeries[] = columns.map((col, i) => ({
      path: col?.path,
      method: col?.method,
      points: rows.map(
        (row): HistoryDataPoint => ({
          timestamp: row?.[0],
          value: row?.[i + 1] ?? null,
        }),
      ),
    }));

    // Convenience map keyed by path; the last method wins on duplicate paths
    // (use `series` to keep every column).
    const values: Record<string, HistoryDataPoint[]> = {};
    for (const s of series) {
      values[s.path] = s.points;
    }

    const returnedPaths = new Set(columns.map((c) => c?.path));
    const missingPaths = requestedPaths
      .map((p) => p.split(':')[0])
      .filter((p) => !returnedPaths.has(p));

    return {
      available: true,
      connected: this.connected,
      context: body?.context,
      range: body?.range,
      resolution,
      requestedPaths,
      series,
      values,
      missingPaths,
      rowCount: rows.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Shared fetch + degradation handling for the history list endpoints
   * (paths/contexts), which both return a JSON array of strings.
   */
  private async fetchHistoryStringList(
    endpoint: 'paths' | 'contexts',
    options: { from?: string; to?: string; duration?: string | number; context?: string },
  ): Promise<{ available: boolean; items: string[]; error?: string }> {
    const from = this.normalizeIso(options.from);
    const to = this.normalizeIso(options.to);
    // The list endpoints scope to a time window; default to the last 24h when
    // the caller gives neither `from` nor `duration` so the result is not empty.
    const duration =
      options.duration !== undefined
        ? String(options.duration)
        : from === undefined
          ? 'PT24H'
          : undefined;

    const url = this.buildHistoryApiUrl(endpoint, {
      context: options.context,
      from,
      to,
      duration,
    });

    try {
      const response = await this.fetchJson(url);
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const { available, error } = this.classifyHistoryFailure(response.status, detail.slice(0, 200));
        return { available, items: [], error };
      }
      const body: any = await response.json();
      const items: string[] = Array.isArray(body) ? body : [];
      return { available: true, items };
    } catch (error: any) {
      console.error(`Failed to fetch history ${endpoint} via HTTP:`, error.message);
      const { available, error: message } = this.classifyHistoryFailure(undefined, error?.message || String(error));
      return { available, items: [], error: message };
    }
  }

  /**
   * Returns comprehensive connection status and client configuration information
   *
   * This method now reflects HTTP-only mode status. WebSocket information is
   * preserved for future streaming support but not actively used.
   *
   * Status information:
   * - HTTP connection state (verified during connect())
   * - Server URLs (both WebSocket and HTTP for reference)
   * - Configuration details (hostname, port, TLS)
   * - Vessel context being monitored
   *
   * Note: Cache statistics (pathCount, aisTargetCount, activeAlarmCount) will
   * always be 0 in HTTP-only mode as data is fetched fresh on each request.
   *
   * @returns ConnectionStatus object with detailed connection information
   *
   * @example
   * const status = client.getConnectionStatus();
   * console.log('Connected:', status.connected);
   * console.log('Server:', status.hostname + ':' + status.port);
   * console.log('TLS:', status.useTLS);
   * console.log('HTTP URL:', status.httpUrl);
   *
   * // Example response:
   * // {
   * //   "connected": true,
   * //   "url": "http://localhost:3000",
   * //   "wsUrl": "ws://localhost:3000",  // Preserved for future use
   * //   "httpUrl": "http://localhost:3000",
   * //   "hostname": "localhost",
   * //   "port": 3000,
   * //   "useTLS": false,
   * //   "context": "vessels.self",
   * //   "pathCount": 0,  // Always 0 in HTTP-only mode
   * //   "aisTargetCount": 0,  // Always 0 in HTTP-only mode
   * //   "activeAlarmCount": 0,  // Always 0 in HTTP-only mode
   * //   "timestamp": "2023-06-22T10:30:15.123Z"
   * // }
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      connected: this.connected,
      url: this.buildHttpUrl(),  // Changed to show HTTP URL as primary
      wsUrl: this.buildWebSocketUrl(),  // Preserved for future streaming
      httpUrl: this.buildHttpUrl(),
      hostname: this.hostname,
      port: this.port,
      useTLS: this.useTLS,
      context: this.context,
      pathCount: 0,  // Always 0 in HTTP-only mode (no cache)
      aisTargetCount: 0,  // Always 0 in HTTP-only mode (no cache)
      activeAlarmCount: 0,  // Always 0 in HTTP-only mode (no cache)
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cleanly disconnects from the SignalK server
   *
   * In HTTP-only mode, this simply sets the connected flag to false.
   * The WebSocket disconnect is preserved for future streaming support.
   *
   * @example
   * // Disconnect when done
   * client.disconnect();
   * console.log('Disconnected from SignalK server');
   */
  disconnect(): void {
    this.connected = false;
    // WebSocket disconnect preserved for future streaming support
    // this.client.disconnect();
  }
}
