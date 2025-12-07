# Salesforce Metadata Type Models

Comprehensive TypeScript type definitions for Salesforce metadata, eliminating the need for `any` types in parsers and improving code quality.

## Overview

This module provides **type-safe models** for all major Salesforce metadata types. These models ensure:

- ✅ **No `any` types** - Fully typed metadata structures
- ✅ **IDE autocomplete** - Better developer experience
- ✅ **Compile-time safety** - Catch errors before runtime
- ✅ **Self-documenting** - Types serve as documentation

## Available Types

### Apex Types (`apex.ts`)

- `ApexClassMetadata` - Apex class metadata
- `ApexTriggerMetadata` - Apex trigger metadata
- `ApexMethodSignature` - Method signatures
- `ApexParameter` - Method parameters
- `ApexProperty` - Class properties
- `ApexInnerClass` - Inner classes
- `ApexTriggerInfo` - Trigger information

### Aura Types (`aura.ts`)

- `AuraComponentMetadata` - Aura component metadata
- `AuraAttribute` - Component attributes
- `AuraHandler` - Event handlers
- `AuraMethod` - Component methods
- `AuraInterface` - Interfaces
- `AuraExtends` - Inheritance
- `AuraImplements` - Interface implementations

### Flow Types (`flow.ts`)

- `FlowMetadata` - Flow metadata
- `FlowNode` - Base flow node
- `FlowActionCall` - Action calls
- `FlowApexPluginCall` - Apex calls
- `FlowDecision` - Decision nodes
- `FlowLoop` - Loop nodes
- `FlowRecordCreate` - Record create
- `FlowRecordUpdate` - Record update
- `FlowRecordDelete` - Record delete
- `FlowRecordLookup` - Record lookup
- `FlowScreen` - Screen flows
- `FlowSubflow` - Subflow calls

### LWC Types (`lwc.ts`)

- `LWCMetadata` - LWC metadata
- `LWCTarget` - Target platforms
- `LWCProperty` - Component properties
- `LWCImport` - Import statements
- `LWCWireAdapter` - Wire adapters
- `LWCApiProperty` - @api properties
- `LWCNavigationReference` - Navigation

### Object Types (`object.ts`)

- `CustomObjectMetadata` - Custom object metadata
- `CustomField` - Field definitions
- `FieldSet` - Field sets
- `ListView` - List views
- `RecordType` - Record types
- `ValidationRule` - Validation rules
- `WebLink` - Web links

### Permission Types (`permission.ts`)

- `PermissionSetMetadata` - Permission set metadata
- `ProfileMetadata` - Profile metadata
- Object permissions
- Field permissions
- Class/Page access
- Tab visibilities

### Email Types (`email.ts`)

- `EmailTemplateMetadata` - Email template metadata
- `EmailMergeField` - Merge fields
- `Attachment` - Attachments

### Resource Types (`resource.ts`)

- `StaticResourceMetadata` - Static resource metadata
- `CustomLabel` - Custom labels
- `DocumentMetadata` - Documents
- `ContentAssetMetadata` - Content assets

### Visualforce Types (`visualforce.ts`)

- `VisualforcePageMetadata` - VF page metadata
- `VisualforceComponentMetadata` - VF component metadata
- `VisualforceAttribute` - Component attributes
- `VisualforceControllerReference` - Controllers

## Usage Examples

### Apex Class Parser

```typescript
import type { ApexClassMetadata, ApexMethodSignature } from '../types/salesforce/index.js';

function parseApexClass(content: string): ApexClassMetadata {
  const metadata: ApexClassMetadata = {
    apiVersion: '60.0',
    status: 'Active',
  };

  return metadata;
}
```

### Flow Parser

```typescript
import type { FlowMetadata, FlowActionCall } from '../types/salesforce/index.js';

function parseFlow(xmlContent: string): FlowMetadata {
  const flow: FlowMetadata = {
    label: 'My Flow',
    processType: 'AutoLaunchedFlow',
    status: 'Active',
  };

  return flow;
}
```

### LWC Parser

```typescript
import type { LWCMetadata, LWCImport } from '../types/salesforce/index.js';

function parseLWCMetadata(jsMetaXml: string): LWCMetadata {
  const metadata: LWCMetadata = {
    apiVersion: '60.0',
    isExposed: true,
    targets: {
      target: ['lightning__RecordPage'],
    },
  };

  return metadata;
}
```

### Custom Object Parser

```typescript
import type { CustomObjectMetadata, CustomField } from '../types/salesforce/index.js';

function parseCustomObject(xml: string): CustomObjectMetadata {
  const object: CustomObjectMetadata = {
    label: 'My Object',
    pluralLabel: 'My Objects',
    deploymentStatus: 'Deployed',
    sharingModel: 'ReadWrite',
  };

  return object;
}
```

## Benefits

### 1. Type Safety

```typescript
// ✅ Type-safe
const flow: FlowMetadata = {
  label: 'Test',
  processType: 'Flow',
  status: 'Active',
};

// ❌ Compile error - invalid status
const badFlow: FlowMetadata = {
  label: 'Test',
  processType: 'Flow',
  status: 'InvalidStatus', // Error: Type '"InvalidStatus"' is not assignable
};
```

### 2. IDE Autocomplete

When you type `flow.processType = '...`, your IDE will show all valid options:

- AutoLaunchedFlow
- Flow
- Workflow
- CustomEvent
- etc.

### 3. Self-Documentation

Types serve as inline documentation:

```typescript
type FlowMetadata = {
  label: string;
  processType: FlowProcessType; // Hover to see all valid types
  status: FlowStatus; // Hover to see all valid statuses
  // ... more fields
};
```

### 4. Refactoring Safety

When Salesforce adds/changes metadata:

1. Update the type definition
2. TypeScript finds all affected code
3. Fix compilation errors
4. No runtime surprises

## Migration from `any`

### Before (with `any`)

```typescript
function parseFlow(xml: string): any {
  const flow: any = {
    label: 'Test',
    processType: 'InvalidType', // No error, runtime bug
  };

  return flow;
}
```

### After (with types)

```typescript
function parseFlow(xml: string): FlowMetadata {
  const flow: FlowMetadata = {
    label: 'Test',
    processType: 'Flow', // Type-checked
    status: 'Active',
  };

  return flow;
}
```

## Testing

All types are validated with comprehensive unit tests:

```bash
yarn test test/unit/types/salesforce-types.test.ts
```

Tests ensure:

- All types compile correctly
- Enum values are validated
- Optional fields work as expected
- No `any` types leak through

## Adding New Types

To add a new Salesforce metadata type:

1. Create a new file in `src/types/salesforce/` (e.g., `mycustomtype.ts`)
2. Define your types:
   ```typescript
   export type MyCustomTypeMetadata = {
     field1: string;
     field2: number;
   };
   ```
3. Export from `index.ts`:
   ```typescript
   export * from './mycustomtype.js';
   ```
4. Add tests in `test/unit/types/salesforce-types.test.ts`
5. Document usage in this README

## References

- [Salesforce Metadata API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Type Safety Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
