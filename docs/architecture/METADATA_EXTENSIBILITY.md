# Metadata Type Extensibility

## Philosophy

Salesforce has **100+ metadata types** and releases new ones regularly (e.g., GenAI features, Einstein, Industries).

**This plugin must work with ANY metadata type**, even ones we haven't defined yet.

## Current Approach

### 1. Core Types Defined (~78 types)

We explicitly define deployment order for the **most common** metadata types:

```typescript
export const DEPLOYMENT_ORDER = {
  CustomObject: 6,
  ApexClass: 31,
  Flow: 48,
  // ... ~78 core types
} as const;
```

### 2. Fallback for Unknown Types

For metadata types NOT in our list, we use a **safe fallback priority**:

```typescript
export function getDeploymentPriority(metadataType: MetadataType): number {
  return DEPLOYMENT_ORDER[metadataType] ?? 99; // Unknown types deploy LAST
}
```

**Why 99?**

- ✅ Safe default - deploying unknown types last minimizes risk
- ✅ Doesn't block deployment of new Salesforce features
- ✅ Plugin works without updates when new types are released

### 3. MetadataType Union is Intentionally Limited

The `MetadataType` union in `src/types/metadata.ts` contains ~78 types, but this is **NOT a hard limit**:

```typescript
export type MetadataType =
  | 'CustomObject'
  | 'ApexClass'
  | ...
  | string; // ❌ Too permissive, loses type safety
```

**Trade-off Decision**:

- ✅ Define common types explicitly (type safety, autocomplete)
- ✅ Use `as MetadataType` casting for unknown types in parsers
- ✅ Runtime code (deployment-order.ts) handles ANY string via fallback

## How to Add New Types

### When Salesforce Releases New Metadata Types:

1. **Add to `MetadataType` union** (optional, for type safety):

   ```typescript
   // src/types/metadata.ts
   export type MetadataType =
     | ...
     | 'NewEinsteinFeature' // ← Add here
     | ...
   ```

2. **Add to `DEPLOYMENT_ORDER`** (optional, for proper prioritization):

   ```typescript
   // src/constants/deployment-order.ts
   export const DEPLOYMENT_ORDER = {
     ...
     NewEinsteinFeature: 76, // ← Add with appropriate priority
     ...
   }
   ```

3. **Create parser if needed** (for dependency extraction):
   ```typescript
   // src/parsers/new-feature-parser.ts
   export function parseNewFeature(content: string): string[] {
     // Extract dependencies
   }
   ```

**If you DON'T add the type**:

- ❌ No autocomplete/type safety
- ❌ No parser (dependencies won't be detected automatically)
- ✅ **Plugin still works** - type gets priority 99, deploys last

## Examples

### Example 1: Future Salesforce Type (Not Yet Defined)

```typescript
// Salesforce releases "AgentforceWorkflow" in Summer '26
// We haven't updated the plugin yet

const unknownType = 'AgentforceWorkflow' as MetadataType;
const priority = getDeploymentPriority(unknownType); // 99 (safe fallback)

// Plugin works immediately, no update required!
```

### Example 2: Industry-Specific Type

```typescript
// Health Cloud, Financial Services Cloud, etc. have unique types
const healthCloudType = 'CareSystemFieldMapping' as MetadataType;
const priority = getDeploymentPriority(healthCloudType); // 99

// Works out of the box, can be optimized later by adding to DEPLOYMENT_ORDER
```

### Example 3: Custom Metadata from AppExchange Packages

```typescript
// Installed packages may have custom metadata
const packageType = 'SomeVendor__ConfigRecord' as MetadataType;
const priority = getDeploymentPriority(packageType); // 99

// Deploys last (safe), won't block other metadata
```

## Testing Strategy

Tests should NOT hardcode the exact number of types:

```typescript
// ❌ BAD: Hardcoded count
expect(metadataTypes.length).to.equal(78); // Breaks when we add types

// ✅ GOOD: Verify minimum and critical types
expect(metadataTypes.length).to.be.at.least(50);
expect(metadataTypes).to.include('CustomObject');
```

## Future Enhancements

### Option A: Dynamic Type Discovery

Query Salesforce org for all metadata types:

```typescript
const orgTypes = await connection.metadata.describeMetadata();
// Use org's actual metadata types
```

### Option B: Metadata Type Registry

Allow users to extend via config:

```json
{
  "customMetadataOrder": {
    "MyCustomType": 85,
    "AnotherNewType": 42
  }
}
```

### Option C: ML-Based Priority

Use Agentforce to infer priority for unknown types:

```typescript
const priority = await agentforce.inferMetadataPriority('NewType');
```

## Current Stats

- **Defined types**: ~78 (most common/critical)
- **Salesforce total**: 100+ (and growing)
- **Coverage**: ~70-80% of typical org metadata
- **Fallback**: Priority 99 for undefined types

## References

- [Salesforce Metadata Coverage Report](https://developer.salesforce.com/docs/metadata-coverage/61)
- [Metadata API Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta)
- Related Issue: #6 (Metadata Type Definitions)
