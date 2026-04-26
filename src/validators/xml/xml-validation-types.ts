export type ValidationResult = {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  filePath: string;
};

export type ValidationError = {
  type: 'syntax' | 'schema' | 'reference' | 'version';
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
};

export type ValidationWarning = {
  message: string;
  line?: number;
  suggestion?: string;
};

export type ValidationSuggestion = {
  issue: string;
  fix: string;
  autoFixable: boolean;
};

export type MetadataValidationType =
  | 'ApexClass'
  | 'ApexTrigger'
  | 'CustomObject'
  | 'Profile'
  | 'PermissionSet'
  | 'Unknown';
