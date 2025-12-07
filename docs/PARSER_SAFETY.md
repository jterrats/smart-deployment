# Parser Safety & Forward Compatibility

## Problem

Salesforce constantly evolves, adding new metadata types, fields, and enum values. Our TypeScript types need to be **strict enough** for type safety, but **flexible enough** to handle unknown metadata without breaking.

## Risks

### ❌ Type 1: Too Strict Types Break on New Metadata

```typescript
// ❌ BREAKS when Salesforce adds new flow types
export type FlowProcessType = 'AutoLaunchedFlow' | 'Flow' | 'Workflow';

const flow: FlowMetadata = {
  processType: 'NewType2025', // ❌ TypeScript error!
  // ...
};
```

### ❌ Type 2: Required Fields Break on Optional Metadata

```typescript
// ❌ BREAKS if Salesforce makes a field optional
export type FlowMetadata = {
  label: string;
  processType: FlowProcessType; // Required
  apiVersion: string; // Required
};
```

## Solution: Two-Tier Type System

### Tier 1: **Parser Types** (Permissive)

Use these when **parsing** metadata from XML/source:

```typescript
import { ParsedFlowMetadata, validateFlowMetadata } from '../types/salesforce/parser-types.js';

function parseFlow(xmlContent: string): FlowMetadata {
  // Step 1: Parse with permissive types
  const parsed: ParsedFlowMetadata = {
    label: extractLabel(xmlContent),
    processType: extractProcessType(xmlContent), // ✅ Accepts ANY string
    status: extractStatus(xmlContent), // ✅ Accepts ANY string
  };

  // Step 2: Validate and warn about unknown values
  return validateFlowMetadata(parsed); // Logs warnings, doesn't throw
}
```

### Tier 2: **Strict Types** (Type Safety)

Use these for **internal logic** where you need strong type guarantees:

```typescript
import { FlowMetadata } from '../types/salesforce/index.js';

function analyzeFlow(flow: FlowMetadata): void {
  // ✅ Type-safe operations
  if (flow.processType === 'AutoLaunchedFlow') {
    // ...
  }
}
```

## Usage Patterns

### Pattern 1: Parse → Validate → Use

```typescript
import { ParsedFlowMetadata, validateFlowMetadata, isKnownFlowProcessType } from '../types/salesforce/parser-types.js';
import type { FlowMetadata } from '../types/salesforce/index.js';

export function parseFlow(xmlContent: string): FlowMetadata {
  // 1. Parse with permissive types
  const parsed: ParsedFlowMetadata = {
    label: extractLabel(xmlContent),
    processType: extractProcessType(xmlContent),
    status: extractStatus(xmlContent),
  };

  // 2. Validate (warns but doesn't throw)
  const validated = validateFlowMetadata(parsed);

  // 3. Additional custom validation if needed
  if (!isKnownFlowProcessType(validated.processType)) {
    logger.info('Encountered new Flow type. Consider updating metadata models.');
  }

  return validated;
}
```

### Pattern 2: Graceful Degradation

```typescript
import { parseUnknownMetadata } from '../types/salesforce/parser-types.js';

export function parseMetadata(xmlContent: string, metadataType: string): unknown {
  switch (metadataType) {
    case 'Flow':
      return parseFlow(xmlContent);
    case 'ApexClass':
      return parseApexClass(xmlContent);
    // ... other known types

    default:
      // ✅ Gracefully handle unknown types
      return parseUnknownMetadata(xmlContent, metadataType);
  }
}
```

### Pattern 3: Type Guards for Safe Narrowing

```typescript
import { isKnownFlowProcessType } from '../types/salesforce/parser-types.js';

function processFlow(flow: FlowMetadata): void {
  if (isKnownFlowProcessType(flow.processType)) {
    // ✅ Known type - full type safety
    switch (flow.processType) {
      case 'AutoLaunchedFlow':
        // ...
        break;
      case 'Flow':
        // ...
        break;
    }
  } else {
    // ⚠️ Unknown type - handle gracefully
    logger.warn(`Unknown flow type: ${flow.processType}`);
    // Continue with generic processing
  }
}
```

## Best Practices

### ✅ DO

1. **Use Parser Types in parsers**

   ```typescript
   import { ParsedFlowMetadata } from '../types/salesforce/parser-types.js';
   ```

2. **Use Strict Types in business logic**

   ```typescript
   import { FlowMetadata } from '../types/salesforce/index.js';
   ```

3. **Validate but don't throw**

   ```typescript
   if (!isKnownValue(value)) {
     logger.warn(`Unknown value: ${value}. Proceeding anyway...`);
   }
   ```

4. **Make most fields optional**
   ```typescript
   type ParsedMetadata = {
     requiredField: string;
     optionalField?: string; // ✅ Won't break if missing
   };
   ```

### ❌ DON'T

1. **Don't use strict types in parsers**

   ```typescript
   // ❌ BAD
   const flow: FlowMetadata = parseXml(content); // Will break on unknown types
   ```

2. **Don't throw on unknown values**

   ```typescript
   // ❌ BAD
   if (!isKnownValue(value)) {
     throw new Error('Unknown value'); // Breaks deployment!
   }
   ```

3. **Don't make everything required**
   ```typescript
   // ❌ BAD
   type StrictMetadata = {
     field1: string; // Required
     field2: string; // Required
     field3: string; // Required - will break if SF makes it optional
   };
   ```

## Testing Forward Compatibility

### Test with Unknown Values

```typescript
describe('Flow Parser - Forward Compatibility', () => {
  it('should handle unknown processType gracefully', () => {
    const xml = `
      <Flow>
        <label>Test</label>
        <processType>FutureType2026</processType>
        <status>Active</status>
      </Flow>
    `;

    // ✅ Should NOT throw
    const flow = parseFlow(xml);
    expect(flow.processType).to.equal('FutureType2026');
  });

  it('should handle missing optional fields', () => {
    const xml = `
      <Flow>
        <label>Test</label>
        <processType>Flow</processType>
        <status>Active</status>
      </Flow>
    `;

    // ✅ Should NOT throw on missing optional fields
    const flow = parseFlow(xml);
    expect(flow.description).to.be.undefined;
  });
});
```

## Migration Strategy

### If a Parser Already Uses Strict Types

1. **Add Parser Types**

   ```typescript
   // Before
   function parseFlow(xml: string): FlowMetadata {
     const flow: FlowMetadata = { ... }; // ❌ Too strict
     return flow;
   }

   // After
   import { ParsedFlowMetadata, validateFlowMetadata } from '...';

   function parseFlow(xml: string): FlowMetadata {
     const parsed: ParsedFlowMetadata = { ... }; // ✅ Permissive
     return validateFlowMetadata(parsed);
   }
   ```

2. **Update Tests**

   ```typescript
   it('should handle unknown metadata', () => {
     const flow = parseFlow(xmlWithUnknownType);
     expect(flow).to.not.be.null; // ✅ Doesn't throw
   });
   ```

## Summary

| Scenario                   | Use This Type           | Why                                |
| -------------------------- | ----------------------- | ---------------------------------- |
| Parsing XML                | `ParsedFlowMetadata`    | Accepts unknown values             |
| After parsing (validation) | `validateFlowMetadata`  | Warns about unknowns               |
| Business logic             | `FlowMetadata`          | Strong type safety                 |
| Unknown metadata type      | `UnknownMetadata`       | Graceful degradation               |
| Type checking              | `isKnownFlowProcessType | Safe narrowing without throwing    |
| Testing                    | Both types              | Test both known and unknown values |

**Key Principle**: **Warn, don't throw**. Allow the deployment to continue even if we encounter unknown metadata.
