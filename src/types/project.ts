/**
 * Salesforce Project Structure Type Definitions
 * Soporte para cualquier estructura de proyecto
 */

/**
 * Definición de proyecto Salesforce (sfdx-project.json)
 */
export type SfdxProject = {
  /** Versión del archivo de configuración */
  sourceApiVersion: string;
  /** Paths de packages */
  packageDirectories: PackageDirectory[];
  /** Namespace (opcional) */
  namespace?: string;
  /** Configuración de plugins */
  plugins?: Record<string, unknown>;
  /** Paths a incluir */
  sourcePaths?: string[];
};

/**
 * Directorio de package
 */
export type PackageDirectory = {
  /** Path relativo al proyecto */
  path: string;
  /** Si es el package por defecto */
  default?: boolean;
  /** Nombre del package */
  package?: string;
  /** Versión del package */
  versionName?: string;
  /** Número de versión */
  versionNumber?: string;
  /** Dependencies */
  dependencies?: PackageDependency[];
};

/**
 * Dependencia de package
 */
export type PackageDependency = {
  /** Nombre del package */
  package: string;
  /** Número de versión */
  versionNumber?: string;
};

/**
 * Estructura de proyecto detectada
 */
export type ProjectStructure = {
  /** Tipo de estructura */
  type: ProjectStructureType;
  /** Path raíz del proyecto */
  rootPath: string;
  /** Paths donde se encuentra metadata */
  metadataPaths: string[];
  /** Formato de metadata */
  format: MetadataFormat;
  /** Packages detectados */
  packages: DetectedPackage[];
  /** Versión de API */
  apiVersion: string;
};

/**
 * Tipos de estructura de proyecto
 */
export type ProjectStructureType =
  | 'sfdx-standard' // force-app/main/default
  | 'sfdx-multi-package' // Múltiples packages
  | 'metadata-api' // src/ (formato antiguo)
  | 'modular' // Estructura custom modular
  | 'monorepo' // Monorepo con múltiples proyectos
  | 'unknown'; // Estructura no estándar

/**
 * Formato de metadata
 */
export type MetadataFormat =
  | 'source' // Source format (SFDX)
  | 'metadata' // Metadata API format
  | 'mixed'; // Mixto

/**
 * Package detectado
 */
export type DetectedPackage = {
  /** Nombre del package */
  name: string;
  /** Path al package */
  path: string;
  /** Es el package por defecto */
  isDefault: boolean;
  /** Tipo de package */
  type: PackageType;
  /** Subdirectorios de metadata */
  metadataDirectories: string[];
};

/**
 * Tipo de package
 */
export type PackageType =
  | 'unlocked' // Unlocked package
  | 'managed' // Managed package
  | 'unmanaged' // Unmanaged
  | 'source'; // Source-tracked

/**
 * Opciones de escaneo de proyecto
 */
export type ProjectScanOptions = {
  /** Paths a incluir (override de sfdx-project.json) */
  includePaths?: string[];
  /** Paths a excluir */
  excludePaths?: string[];
  /** Seguir .forceignore */
  respectForceignore?: boolean;
  /** Escanear recursivamente */
  recursive?: boolean;
  /** Profundidad máxima de recursión */
  maxDepth?: number;
  /** Detectar packages automáticamente */
  autoDetectPackages?: boolean;
};

/**
 * Resultado del escaneo de proyecto
 */
export type ProjectScanResult = {
  /** Estructura detectada */
  structure: ProjectStructure;
  /** Archivos de metadata encontrados */
  metadataFiles: string[];
  /** Estadísticas */
  stats: ProjectStats;
  /** Warnings */
  warnings: string[];
};

/**
 * Estadísticas del proyecto
 */
export type ProjectStats = {
  /** Total de archivos de metadata */
  totalFiles: number;
  /** Archivos por tipo */
  filesByType: Record<string, number>;
  /** Tamaño total (bytes) */
  totalSize: number;
  /** Packages encontrados */
  packagesFound: number;
  /** Tiempo de escaneo (ms) */
  scanTime: number;
};

/**
 * Patrón de metadata
 * Define cómo identificar cada tipo de metadata
 */
export type MetadataPattern = {
  /** Tipo de metadata */
  type: string;
  /** Patrón de directorio (glob) */
  directoryPattern: string;
  /** Patrón de archivo (glob) */
  filePattern: string;
  /** Extensión de archivo */
  fileExtension: string;
  /** Formato (source o metadata) */
  format: 'source' | 'metadata' | 'both';
  /** Requiere directorio contenedor */
  requiresContainer?: boolean;
};

/**
 * Patrones de metadata conocidos
 */
export const METADATA_PATTERNS: MetadataPattern[] = [
  {
    type: 'ApexClass',
    directoryPattern: '**/classes',
    filePattern: '*.cls',
    fileExtension: '.cls',
    format: 'both',
  },
  {
    type: 'ApexTrigger',
    directoryPattern: '**/triggers',
    filePattern: '*.trigger',
    fileExtension: '.trigger',
    format: 'both',
  },
  {
    type: 'LightningComponentBundle',
    directoryPattern: '**/lwc/*',
    filePattern: '*.js',
    fileExtension: '.js',
    format: 'source',
    requiresContainer: true,
  },
  {
    type: 'AuraDefinitionBundle',
    directoryPattern: '**/aura/*',
    filePattern: '*.cmp',
    fileExtension: '.cmp',
    format: 'source',
    requiresContainer: true,
  },
  {
    type: 'Flow',
    directoryPattern: '**/flows',
    filePattern: '*.flow-meta.xml',
    fileExtension: '.flow-meta.xml',
    format: 'both',
  },
  {
    type: 'CustomObject',
    directoryPattern: '**/objects/*',
    filePattern: '*.object-meta.xml',
    fileExtension: '.object-meta.xml',
    format: 'source',
    requiresContainer: true,
  },
  // ... más patrones
];
