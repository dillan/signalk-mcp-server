/**
 * Domain Interfaces
 *
 * Business logic interfaces for the SignalK MCP server
 */

export interface AISTarget {
  mmsi: string;
  lastUpdate: string;
  distanceMeters?: number; // Distance in meters from self vessel (optional)
  [key: string]: any;
}

export interface ActiveAlarm {
  path: string;
  state: string;
  message: string;
  timestamp?: string;
}

export interface VesselState {
  connected: boolean;
  context: string;
  data: Record<string, any>;
  timestamp: string;
  error?: string;
}

export interface AISTargetsResponse {
  connected: boolean;
  count: number;
  targets: AISTarget[];
  timestamp: string;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface ActiveAlarmsResponse {
  connected: boolean;
  count: number;
  alarms: ActiveAlarm[];
  timestamp: string;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  url: string;
  wsUrl: string;
  httpUrl: string;
  hostname: string;
  port: number;
  useTLS: boolean;
  context: string;
  pathCount: number;
  aisTargetCount: number;
  activeAlarmCount: number;
  timestamp: string;
}

export interface AvailablePathsResponse {
  connected: boolean;
  count: number;
  paths: string[];
  timestamp: string;
  error?: string;
}

export interface PathValueResponse {
  connected: boolean;
  path: string;
  data: any;
  timestamp: string;
  error?: string;
}

export interface HistoryDataPoint {
  timestamp: string;
  // Aggregated value for one time bucket. May be a scalar (number / string /
  // boolean), a position [longitude, latitude] array (GeoJSON order, unlike the
  // live API's {latitude, longitude}), or null for a gap with no data.
  value: number | number[] | string | boolean | null;
}

export interface HistoryQueryOptions {
  // One or more SignalK paths. Each entry may include an inline aggregation
  // method: 'path', 'path:method', or 'path:method:param'
  // (e.g. 'navigation.speedOverGround:sma:5').
  paths: string | string[];
  // ISO-8601 start time. At least one of `from` or `duration` is required.
  from?: string;
  // ISO-8601 end time (defaults to now on the server).
  to?: string;
  // ISO-8601 duration ('PT1H') or whole seconds; use instead of `from`/`to`.
  duration?: string | number;
  // Bucket size in SECONDS (not milliseconds).
  resolution?: number;
  // Default aggregation method applied to bare paths (e.g. 'average', 'max').
  aggregate?: string;
  // Vessel context (default 'vessels.self').
  context?: string;
  // Optional history provider id (e.g. 'signalk-to-influxdb2').
  provider?: string;
}

export interface HistorySeries {
  path: string;
  method: string;
  points: HistoryDataPoint[];
}

export interface HistoryResponse {
  // True when the history provider answered (even if the window was empty).
  // False only when no history provider is installed/reachable.
  available: boolean;
  connected: boolean;
  context?: string;
  range?: { from: string; to: string };
  resolution?: number;
  requestedPaths: string[];
  // One entry per response column, in server order (never lossy).
  series: HistorySeries[];
  // Convenience map keyed by path. If the same path is requested with two
  // methods, the last one wins here - use `series` to keep both.
  values: Record<string, HistoryDataPoint[]>;
  // Requested paths the server returned no column for.
  missingPaths: string[];
  rowCount?: number;
  timestamp: string;
  error?: string;
}

export interface HistoryPathsResponse {
  available: boolean;
  connected: boolean;
  count: number;
  paths: string[];
  timestamp: string;
  error?: string;
}

export interface HistoryContextsResponse {
  available: boolean;
  connected: boolean;
  count: number;
  contexts: string[];
  timestamp: string;
  error?: string;
}

export interface CourseStatusResponse {
  available: boolean;
  connected: boolean;
  // false when there is no active destination / route
  navigating: boolean;
  // the raw /navigation/course body (activeRoute, nextPoint, arrivalCircle, ...),
  // or null when unavailable
  course: any;
  // /navigation/course/calcValues (distance, bearing, ETA, cross-track error,
  // VMG, time-to-go), or null when not navigating or unavailable
  calcValues: any;
  timestamp: string;
  error?: string;
}
