export {
  startConfiguredServer,
  startServer,
  extractRoutes,
  extractConfiguredRoutes,
  type MockServerConfig,
  type MockServerHandle,
  type CommonServerOptions,
  type InternalEndpointsOptions,
  type LogEntry,
  type LogEntryData,
  type LogEntryRequest,
  type LogEntryResponse,
  type LogSystem,
} from './mockServer';

export {
  createLogger,
  createSilentLogger,
  type Logger,
  type CreateLoggerOptions,
} from './logger';

export {
  createMetrics,
  type MockServerMetrics,
  type CreateMetricsOptions,
} from './metrics';

export {
  loadSpec,
  loadSpecFile,
  SpecFileNotFoundError,
  SpecParseError,
  type OpenApiDocument,
  type OpenApiPathItem,
  type OpenApiOperation,
  type OpenApiResponse,
  type OpenApiMediaType,
  type OverridesDocument,
  type OverrideValue,
} from './specLoader';

export type {
  AdapterRequest,
  AdapterResponse,
  AdapterResponseOrigin,
  AdapterHeaders,
  AdapterHeaderValue,
  MockAdapter,
  RouteSummary,
} from './adapters/types';

export {
  OpenApiAdapter,
  buildRoutes,
  applyRouteOverrides,
  type Route,
} from './adapters/openApiAdapter';

export {
  FigmaProxyAdapter,
  FIGMA_API_BASE_URL,
  FIGMA_ASSET_PATH_PREFIX,
  listFigmaCassettes,
  clearFigmaCassettes,
  type FigmaProxyOptions,
  type FigmaProxyMode,
  type FigmaFetcher,
  type FigmaAssetFetcher,
  type FigmaFetchedResponse,
} from './adapters/figmaProxyAdapter';

export {
  CassetteStore,
  FigmaAssetStore,
  DEFAULT_FIGMA_CASSETTE_DIR,
  buildCassetteKey,
  sanitizeHeaders,
  encodeBody,
  decodeBody,
  type Cassette,
  type CassetteAsset,
  type CassetteAssets,
  type CassetteKey,
  type StoredBody,
} from './adapters/cassetteStore';

export {
  upsertOverride,
  getOverride,
  getAllOverrides,
  deleteOverride,
  setOverridesDbPath,
  type OverrideRow,
} from './db';
