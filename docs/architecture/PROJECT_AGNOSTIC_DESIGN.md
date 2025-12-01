# 🏗️ Project-Agnostic Design

## Philosophy

The Smart Deployment plugin is **completely agnostic to project structure**. It doesn't assume any specific directory structure. Instead:

1. **Reads `sfdx-project.json`** to identify package directories
2. **Detects metadata by patterns** instead of hardcoded paths
3. **Supports multiple formats** (source format, metadata API format, mixed)
4. **Works with any structure** (standard, modular, monorepo, custom)

---

## 🎯 Supported Structures

### 1. SFDX Standard (Force-app)

```
my-project/
├── sfdx-project.json
├── force-app/
│   └── main/
│       └── default/
│           ├── classes/
│           ├── triggers/
│           ├── lwc/
│           └── flows/
└── .forceignore
```

**Detection**:
- Reads `sfdx-project.json` → `packageDirectories[0].path = "force-app"`
- Scans recursively from `force-app/`
- Identifies metadata by patterns (*.cls, *.trigger, etc.)

---

### 2. Multi-Package (Modular)

```
my-project/
├── sfdx-project.json
├── core-package/
│   └── main/
│       └── default/
│           ├── classes/
│           └── objects/
├── sales-package/
│   └── main/
│       └── default/
│           ├── classes/
│           └── flows/
└── service-package/
    └── main/
        └── default/
            └── classes/
```

**sfdx-project.json**:
```json
{
  "packageDirectories": [
    { "path": "core-package", "default": true },
    { "path": "sales-package" },
    { "path": "service-package" }
  ]
}
```

**Detection**:
- Reads all `packageDirectories`
- Scans each package independently
- Merges metadata at the end

---

### 3. Metadata API Format (Legacy)

```
my-project/
├── package.xml
└── src/
    ├── classes/
    ├── triggers/
    ├── objects/
    └── pages/
```

**Detection**:
- Detects absence of `sfdx-project.json`
- Looks for `package.xml` in root
- Scans from `src/`
- Uses metadata API format

---

### 4. Monorepo

```
company-monorepo/
├── packages/
│   ├── salesforce-core/
│   │   ├── sfdx-project.json
│   │   └── force-app/
│   ├── salesforce-sales/
│   │   ├── sfdx-project.json
│   │   └── force-app/
│   └── salesforce-service/
│       ├── sfdx-project.json
│       └── force-app/
└── lerna.json
```

**Detection**:
- Detects multiple `sfdx-project.json` files
- Treats each as independent project
- Option for aggregate or individual deployment

---

### 5. Custom Structure (Enterprise)

```
my-custom-project/
├── sfdx-project.json
├── apex-code/
│   ├── controllers/
│   ├── services/
│   └── utils/
├── automation/
│   ├── flows/
│   └── process-builders/
└── ui/
    ├── lightning-components/
    └── pages/
```

**sfdx-project.json**:
```json
{
  "packageDirectories": [
    { "path": "apex-code", "default": true },
    { "path": "automation" },
    { "path": "ui" }
  ]
}
```

**Detection**:
- Respects defined `packageDirectories`
- Searches for metadata by patterns in each path
- Doesn't assume specific directory names

---

## 🔍 Metadata Detection Algorithm

### Step 1: Detect Project Type

```typescript
async function detectProjectStructure(
  projectPath: string
): Promise<ProjectStructure> {
  // 1. Look for sfdx-project.json
  const sfdxProjectPath = join(projectPath, 'sfdx-project.json');
  
  if (await exists(sfdxProjectPath)) {
    const sfdxProject = await readJson(sfdxProjectPath);
    return detectSfdxStructure(projectPath, sfdxProject);
  }
  
  // 2. Look for package.xml (legacy)
  const packageXmlPath = join(projectPath, 'package.xml');
  if (await exists(packageXmlPath)) {
    return detectMetadataApiStructure(projectPath);
  }
  
  // 3. Search for metadata in common directories
  return detectUnknownStructure(projectPath);
}
```

### Step 2: Scan Metadata by Patterns

```typescript
async function scanMetadataByPatterns(
  basePath: string
): Promise<ComponentFile[]> {
  const files: ComponentFile[] = [];
  
  // For each known metadata pattern
  for (const pattern of METADATA_PATTERNS) {
    const matches = await glob(
      `${basePath}/${pattern.directoryPattern}/${pattern.filePattern}`
    );
    
    for (const filePath of matches) {
      files.push({
        path: filePath,
        fileName: basename(filePath),
        metadataType: pattern.type,
      });
    }
  }
  
  return files;
}
```

### Step 3: Validate with .forceignore

```typescript
function filterByForceignore(
  files: ComponentFile[],
  forceignorePatterns: string[]
): ComponentFile[] {
  return files.filter(file => {
    const relativePath = relative(projectRoot, file.path);
    return !isIgnored(relativePath, forceignorePatterns);
  });
}
```

---

## 📦 Metadata Identification by Content

Instead of assuming paths, the plugin identifies metadata by:

### 1. File Extension

```typescript
const METADATA_EXTENSIONS = {
  '.cls': 'ApexClass',
  '.trigger': 'ApexTrigger',
  '.flow-meta.xml': 'Flow',
  '.object-meta.xml': 'CustomObject',
  '.permissionset-meta.xml': 'PermissionSet',
  // ... more extensions
};

function identifyMetadataType(fileName: string): MetadataType | null {
  for (const [ext, type] of Object.entries(METADATA_EXTENSIONS)) {
    if (fileName.endsWith(ext)) {
      return type;
    }
  }
  return null;
}
```

### 2. Directory Structure

```typescript
// LWC: directory with .js + .html + .js-meta.xml
function isLwcBundle(dirPath: string): boolean {
  const files = readdirSync(dirPath);
  return (
    files.some(f => f.endsWith('.js')) &&
    files.some(f => f.endsWith('.html')) &&
    files.some(f => f.endsWith('.js-meta.xml'))
  );
}

// Aura: directory with .cmp + .cmp-meta.xml
function isAuraBundle(dirPath: string): boolean {
  const files = readdirSync(dirPath);
  return (
    files.some(f => f.endsWith('.cmp')) &&
    files.some(f => f.endsWith('.cmp-meta.xml'))
  );
}
```

### 3. XML Content (Fallback)

```typescript
function identifyByXmlContent(filePath: string): MetadataType | null {
  const content = readFileSync(filePath, 'utf-8');
  const root = parseXml(content);
  
  // Identify by root element
  if (root.tagName === 'ApexClass') return 'ApexClass';
  if (root.tagName === 'Flow') return 'Flow';
  // ... more types
  
  return null;
}
```

---

## 🔧 Flexible Project API

### Usage Example

```typescript
import { ProjectScanner } from './services/project-scanner.js';

// Scan project without assuming structure
const scanner = new ProjectScanner({
  projectPath: '/path/to/any/salesforce/project',
  respectForceignore: true,
  autoDetectPackages: true,
});

const result = await scanner.scan();

console.log('Project Structure:', result.structure.type);
console.log('Metadata Paths:', result.structure.metadataPaths);
console.log('Total Files:', result.stats.totalFiles);

// Get all components (regardless of location)
const components = await scanner.getAllComponents();

// Analyze dependencies
const dependencies = await analyzeDependencies(components);
```

---

## 🎨 Flexible Configuration

### .sfsmartdeploy.json (Optional)

```json
{
  "project": {
    "sourcePaths": [
      "custom-path/apex",
      "custom-path/flows"
    ],
    "excludePaths": [
      "legacy/**",
      "deprecated/**"
    ],
    "metadataPatterns": {
      "CustomApexType": {
        "directory": "**/custom-apex",
        "filePattern": "*.capex",
        "extension": ".capex"
      }
    }
  }
}
```

---

## 🧪 Testing with Different Structures

```typescript
describe('ProjectScanner - Multi Structure Support', () => {
  test('should detect standard SFDX structure', async () => {
    const result = await scanProject('./fixtures/standard-sfdx');
    expect(result.structure.type).toBe('sfdx-standard');
  });

  test('should detect multi-package structure', async () => {
    const result = await scanProject('./fixtures/multi-package');
    expect(result.structure.type).toBe('sfdx-multi-package');
    expect(result.structure.packages.length).toBeGreaterThan(1);
  });

  test('should detect metadata API format', async () => {
    const result = await scanProject('./fixtures/metadata-api');
    expect(result.structure.type).toBe('metadata-api');
    expect(result.structure.format).toBe('metadata');
  });

  test('should work with custom structure', async () => {
    const result = await scanProject('./fixtures/custom-structure');
    expect(result.metadataFiles.length).toBeGreaterThan(0);
  });
});
```

---

## ✨ Benefits of Agnostic Design

1. **Total Flexibility**: Works with any project structure
2. **No Assumptions**: Doesn't hardcode paths like "force-app/main/default"
3. **Future-Proof**: Supports new structures without code changes
4. **Multi-Package**: Natively supports modular projects
5. **Migration-Friendly**: Works with legacy and modern projects
6. **Enterprise-Ready**: Supports custom enterprise structures

---

## 🚀 Implementation

```
services/
├── project-scanner/
│   ├── index.ts                    # Main scanner
│   ├── structure-detector.ts       # Detect structure type
│   ├── pattern-matcher.ts          # Identify metadata by patterns
│   ├── sfdx-project-reader.ts     # Read sfdx-project.json
│   └── forceignore-parser.ts      # Parse .forceignore
```

---

## 📋 Real Example

```bash
# User has custom structure
my-app/
├── sfdx-project.json
├── backend/
│   ├── apex/
│   │   ├── controllers/
│   │   └── services/
│   └── triggers/
└── frontend/
    ├── lwc/
    └── aura/

# Plugin automatically detects:
$ sf smart-deployment analyze

🔍 Detecting project structure...
✅ Found sfdx-project.json
✅ Detected 2 package directories:
   - backend/
   - frontend/

🔍 Scanning metadata...
✅ Found 45 Apex classes in backend/apex/
✅ Found 12 triggers in backend/triggers/
✅ Found 23 LWC in frontend/lwc/
✅ Found 8 Aura in frontend/aura/

📊 Total: 88 components
🤖 Analyzing dependencies...
✅ Generated 8 deployment waves

Ready to deploy!
```

---

## 🎯 Conclusion

The plugin is **100% structure-agnostic**. It only needs:
1. Valid Salesforce metadata
2. (Optional) `sfdx-project.json` for paths
3. (Optional) `.forceignore` for exclusions

Everything else is detected automatically by analyzing **content, not structure**.
