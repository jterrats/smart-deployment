import type { MetadataValidationType, ValidationResult } from './xml-validation-types.js';

export function detectMetadataType(filePath: string): MetadataValidationType {
  if (filePath.includes('/classes/')) return 'ApexClass';
  if (filePath.includes('/triggers/')) return 'ApexTrigger';
  if (filePath.includes('/objects/')) return 'CustomObject';
  if (filePath.includes('/profiles/')) return 'Profile';
  if (filePath.includes('/permissionsets/')) return 'PermissionSet';
  return 'Unknown';
}

export function validateSchema(content: string, filePath: string, result: ValidationResult): void {
  const metadataType = detectMetadataType(filePath);

  if (metadataType === 'ApexClass' || metadataType === 'ApexTrigger') {
    validateApexMetadata(content, result);
  } else if (metadataType === 'CustomObject') {
    validateObjectMetadata(content, result);
  } else if (metadataType === 'Profile' || metadataType === 'PermissionSet') {
    validateSecurityMetadata(content, result);
  }
}

function validateApexMetadata(content: string, result: ValidationResult): void {
  if (!content.includes('<ApexClass') && !content.includes('<ApexTrigger')) {
    result.errors.push({
      type: 'schema',
      message: 'Missing ApexClass or ApexTrigger root element',
      severity: 'error',
    });
    return;
  }

  if (!content.includes('<status>')) {
    result.errors.push({
      type: 'schema',
      message: 'Missing required field: status',
      severity: 'error',
    });
  }
}

function validateObjectMetadata(content: string, result: ValidationResult): void {
  if (!content.includes('<CustomObject')) {
    result.errors.push({
      type: 'schema',
      message: 'Missing CustomObject root element',
      severity: 'error',
    });
    return;
  }

  if (!content.includes('<label>')) {
    result.errors.push({
      type: 'schema',
      message: 'Missing required field: label',
      severity: 'error',
    });
  }

  if (!content.includes('<pluralLabel>')) {
    result.warnings.push({
      message: 'Missing pluralLabel field',
      suggestion: 'Add pluralLabel for better user experience',
    });
  }
}

function validateSecurityMetadata(content: string, result: ValidationResult): void {
  if (!content.includes('<Profile') && !content.includes('<PermissionSet')) {
    result.errors.push({
      type: 'schema',
      message: 'Missing Profile or PermissionSet root element',
      severity: 'error',
    });
  }
}
