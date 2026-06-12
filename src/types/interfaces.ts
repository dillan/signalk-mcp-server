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
  // alert methods the notification requests, e.g. ['visual', 'sound']
  method?: string[];
  // notification management status (silenced / acknowledged / canSilence / ...)
  status?: Record<string, any>;
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

export interface AutopilotStatusResponse {
  available: boolean;
  connected: boolean;
  // the autopilot device that was read (the default, or the requested pilotId)
  pilotId: string | null;
  // ids of all autopilot devices on the vessel
  pilotIds: string[];
  engaged: boolean | null;
  state: string | null;
  mode: string | null;
  // target heading converted to degrees, or null when there is no target
  targetDegrees: number | null;
  // raw target heading in radians (SignalK SI), or null
  targetRadians: number | null;
  // available states / modes / actions for the device
  options: any;
  timestamp: string;
  error?: string;
}

export interface WeatherQueryOptions {
  // Position to query. Defaults to the vessel's current position when omitted.
  latitude?: number;
  longitude?: number;
  // Weather provider plugin id. Defaults to the server's default provider.
  provider?: string;
  // Max number of entries to return (observations / forecast only).
  count?: number;
  // Start date as YYYY-MM-DD (observations / forecast only).
  date?: string;
  // Forecast resolution: 'daily' (per-day) or 'point' (per time point).
  // Ignored by observations and warnings.
  type?: 'daily' | 'point';
}

export interface WeatherResponse {
  available: boolean;
  connected: boolean;
  // 'observations' | 'forecast' | 'warnings'
  kind: string;
  // 'daily' | 'point' for forecasts; null for observations / warnings
  forecastType: string | null;
  // the position the weather was requested for, or null when there is no fix
  position: { latitude: number; longitude: number } | null;
  // the provider id that was requested, or null when the server default was used
  provider: string | null;
  // the raw weather entries (WeatherDataModel[] or WeatherWarningModel[]); SI units
  data: any[];
  count: number;
  timestamp: string;
  // why the data is unavailable, e.g. 'no vessel position'
  reason?: string;
  error?: string;
}

export interface ServerInfoResponse {
  available: boolean;
  connected: boolean;
  // the SignalK server implementation id and version, or null when unavailable
  name: string | null;
  version: string | null;
  // the raw endpoints block from GET /signalk (versions -> urls)
  endpoints: any;
  timestamp: string;
  error?: string;
}

export interface ServerFeaturesResponse {
  available: boolean;
  connected: boolean;
  // names of the APIs the server implements (e.g. 'course', 'weather', 'history')
  apis: string[];
  // installed plugins ({ id, name, version })
  plugins: any[];
  timestamp: string;
  error?: string;
}

export interface ResourcesQueryOptions {
  // which resource collection to read
  type: 'waypoints' | 'routes' | 'regions' | 'notes' | 'charts';
  // max records to return (charts has no limit param; the other types default
  // to 50 when omitted)
  limit?: number;
  // square-area filter in metres (>= 100), centred on the vessel position or
  // an explicit `position`; the server auto-centres on self. Charts: ignored.
  distance?: number;
  // bounding box [lon1, lat1, lon2, lat2]. Charts: ignored.
  bbox?: [number, number, number, number];
  // explicit centre [longitude, latitude] for `distance`. Charts: ignored.
  position?: [number, number];
  // map zoom level. Charts: ignored.
  zoom?: number;
  // weather/resources provider plugin id (all types)
  provider?: string;
  // notes only: a /resources/<type>/<uuid> reference to filter notes by
  href?: string;
}

export interface ResourcesResponse {
  available: boolean;
  connected: boolean;
  type: string;
  count: number;
  // the raw keyed object { uuid: resource }. MAY CONTAIN user PII (names,
  // coordinates, free text) - do not echo to an LLM unsanitised.
  resources: any;
  timestamp: string;
  // why the data is unavailable: 'invalid_type' | 'no_provider' | 'auth' | 'error'
  reason?: string;
  error?: string;
}
