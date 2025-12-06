# 📋 TODO to User Story Mapping

Mapeo completo de TODOs a User Stories específicas, organizadas por prioridad.

---

## 🔴 MUST HAVE (Alta Prioridad)

### Epic 1: Core Infrastructure

| TODO ID | User Story | Issue | Story Points | Descripción                                                                              |
| ------- | ---------- | ----- | ------------ | ---------------------------------------------------------------------------------------- |
| **3**   | US-004     | #4    | 1            | **Salesforce Limits Constants** - Definir MAX_COMPONENTS_PER_WAVE, MAX_CMT_RECORDS, etc. |
| **3**   | US-005     | #5    | 2            | **Deployment Order Constants** - Orden de despliegue por tipo de metadata                |
| **3**   | US-006     | #6    | 2            | **Metadata Type Definitions** - Enums para 50+ tipos                                     |
| **4**   | US-001     | #1    | 3            | **Functional Utilities** - Implementar pipe, compose, curry, memoize                     |
| **4**   | US-002     | #2    | 5            | **Graph Algorithms** - Topological sort, detectCycles, calculateDepth                    |
| **4**   | US-003     | #3    | 3            | **File System Utilities** - readProjectFile, scanDirectory, parseXml                     |
| **16**  | US-008     | #8    | 2            | **Error Types** - ParseError, DependencyError, DeploymentError                           |
| **4**   | US-010     | #10   | 3            | **XML Utils** - Parse/generate XML con namespaces                                        |
| **4**   | US-011     | #11   | 2            | **String Utilities** - removeComments, extractClassName, sanitize                        |

**Subtotal Epic 1**: 23 story points

---

### Epic 2: Metadata Parsers

| TODO ID | User Story | Issue | Story Points | Descripción                                                                       |
| ------- | ---------- | ----- | ------------ | --------------------------------------------------------------------------------- |
| **5**   | US-013     | #13   | 5            | **Apex Class Parser** - Extraer extends, implements, instantiations, etc. (10 AC) |
| **5**   | US-014     | #14   | 3            | **Apex Trigger Parser** - Extraer objeto, handlers, eventos                       |
| **5**   | US-015     | #15   | 5            | **Flow Parser** - Apex actions, subflows, GenAI prompts, record refs              |
| **5**   | US-016     | #16   | 4            | **LWC Parser** - Apex imports, LWC imports, wire adapters, @api                   |
| **5**   | US-018     | #18   | 5            | **Custom Object Parser** - Fields, validation rules, relationships                |
| **5**   | US-019     | #19   | 3            | **Permission Set Parser** - Object/field/class permissions                        |
| **5**   | US-026     | #26   | 3            | **Custom Metadata Parser** - Tipos y records, splitting                           |
| **5**   | US-027     | #27   | 3            | **Parser Factory** - Selección automática de parser                               |

**Subtotal Epic 2**: 31 story points (de 55 total)

---

### Epic 3: Dependency Analysis

| TODO ID | User Story | Issue | Story Points | Descripción                                                      |
| ------- | ---------- | ----- | ------------ | ---------------------------------------------------------------- |
| **6**   | US-028     | #28   | 5            | **Dependency Graph Builder** - Construir grafo desde componentes |
| **6**   | US-029     | #29   | 5            | **Heuristic Analyzer** - Test→Prod, Handler→Service patterns     |
| **6**   | US-030     | #30   | 3            | **Circular Dependency Detector** - Detectar y reportar ciclos    |
| **6**   | US-033     | #33   | 3            | **Dependency Resolver** - Resolver deps directas y transitivas   |
| **6**   | US-034     | #34   | 2            | **Dependency Validation** - Validar grafo de dependencias        |

**Subtotal Epic 3**: 18 story points (de 34 total)

---

### Epic 4: Wave Generation

| TODO ID | User Story | Issue | Story Points | Descripción                                                   |
| ------- | ---------- | ----- | ------------ | ------------------------------------------------------------- |
| **6**   | US-038     | #38   | 3            | **Topological Sort Wave Generator** - Generar waves por orden |
| **6**   | US-039     | #39   | 3            | **Wave Splitter** - Split waves >300 componentes              |
| **6**   | US-040     | #40   | 3            | **Test Optimizer** - Solo tests en waves con Apex/Flow        |
| **6**   | US-043     | #43   | 2            | **Wave Validation** - Validar orden y límites                 |

**Subtotal Epic 4**: 11 story points (de 21 total)

---

### Epic 5: CLI Commands

| TODO ID | User Story | Issue | Story Points | Descripción                                                      |
| ------- | ---------- | ----- | ------------ | ---------------------------------------------------------------- |
| **9**   | US-046     | #46   | 5            | **smart-deployment:start** - Comando principal de deployment     |
| **9**   | US-047     | #47   | 3            | **smart-deployment:analyze** - Solo análisis, sin deploy         |
| **9**   | US-048     | #48   | 3            | **smart-deployment:validate** - Check-only deployment            |
| **9**   | US-052     | #52   | 2            | **Command Help Documentation** - Help completo para cada comando |
| **9**   | US-053     | #53   | 2            | **Command Progress Reporting** - Progress bars y ETAs            |

**Subtotal Epic 5**: 15 story points (de 21 total)

---

### Epic 9: Project Scanner

| TODO ID | User Story | Issue | Story Points | Descripción                                             |
| ------- | ---------- | ----- | ------------ | ------------------------------------------------------- |
| **11**  | US-079     | #79   | 3            | **SFDX Project Detection** - Detectar sfdx-project.json |
| **11**  | US-083     | #83   | 2            | **.forceignore Parsing** - Respetar .forceignore        |
| **11**  | US-084     | #84   | 2            | **Project Structure Validation** - Validar estructura   |

**Subtotal Epic 9**: 7 story points (de 13 total)

---

### Epic 10: Deployment Execution

| TODO ID | User Story | Issue | Story Points | Descripción                                                      |
| ------- | ---------- | ----- | ------------ | ---------------------------------------------------------------- |
| **7**   | US-085     | #85   | 3            | **SF CLI Integration** - Ejecutar sf project deploy start        |
| **7**   | US-086     | #86   | 3            | **Deployment Progress Tracking** - Track ID, %, ETA              |
| **7**   | US-087     | #87   | 3            | **Test Execution Management** - RunLocalTests, RunSpecifiedTests |
| **7**   | US-090     | #90   | 3            | **Deployment Reporting** - JSON/HTML reports completos           |

**Subtotal Epic 10**: 12 story points (de 21 total)

---

### Epic 7: Testing Infrastructure

| TODO ID    | User Story | Issue | Story Points | Descripción                                       |
| ---------- | ---------- | ----- | ------------ | ------------------------------------------------- |
| **10, 12** | US-061     | #61   | 2            | **Unit Test Framework Setup** - Jest + TypeScript |
| **12**     | US-062     | #62   | 5            | **Utils Unit Tests** - 61 tests para utilities    |
| **12**     | US-063     | #63   | 8            | **Parser Unit Tests** - 100 tests para parsers    |
| **12**     | US-064     | #64   | 5            | **Service Unit Tests** - 57 tests para services   |
| **13**     | US-065     | #65   | 5            | **Integration Tests** - 30 tests inter-layer      |
| **14**     | US-066     | #66   | 3            | **BDD Test Framework** - Cucumber + Gherkin       |
| **14**     | US-067     | #67   | 8            | **E2E BDD Scenarios** - 36 scenarios              |

**Subtotal Epic 7**: 36 story points (de 44 total)

---

### Epic 8: Error Handling

| TODO ID | User Story | Issue | Story Points | Descripción                                            |
| ------- | ---------- | ----- | ------------ | ------------------------------------------------------ |
| **16**  | US-071     | #71   | 2            | **Parse Error Handling** - Graceful parse errors       |
| **16**  | US-072     | #72   | 3            | **Network Error Handling** - Retry con backoff         |
| **16**  | US-074     | #74   | 3            | **Deployment Error Handling** - Recovery y resume      |
| **16**  | US-075     | #75   | 2            | **Validation Error Reporting** - Mensajes claros       |
| **16**  | US-078     | #78   | 3            | **Error Recovery Patterns** - 5 patrones implementados |
| **15**  | US-077     | #77   | 8            | **Negative Scenario Tests** - 267 tests EDD            |

**Subtotal Epic 8**: 21 story points

---

### Epic 6: Generators

| TODO ID | User Story | Issue | Story Points | Descripción                                  |
| ------- | ---------- | ----- | ------------ | -------------------------------------------- |
| **8**   | US-085     | #85   | 3            | **Manifest Generator** - Generar package.xml |
| **8**   | US-086     | #86   | 3            | **Report Generator** - JSON/HTML reports     |

**Subtotal Epic 6**: 6 story points (parte de otros epics)

---

## 🟡 SHOULD HAVE (Media Prioridad)

### Epic 6: Agentforce Integration

| TODO ID | User Story | Issue | Story Points | Descripción                                              |
| ------- | ---------- | ----- | ------------ | -------------------------------------------------------- |
| -       | US-054     | #54   | 3            | **Agentforce Service Setup** - Conectar a Agentforce API |
| -       | US-055     | #55   | 5            | **AI Dependency Inference** - Inferir deps no obvias     |
| -       | US-056     | #56   | 3            | **AI Wave Validation** - Validar waves con AI            |
| -       | US-057     | #57   | 3            | **AI Priority Weighting** - Sugerir prioridades          |
| -       | US-060     | #60   | 3            | **AI Circuit Breaker** - Circuit breaker para AI         |

**Subtotal Epic 6**: 17 story points (de 21 total)

---

### Epic 2: Metadata Parsers (Restantes)

| TODO ID | User Story | Issue | Story Points | Descripción                                              |
| ------- | ---------- | ----- | ------------ | -------------------------------------------------------- |
| **5**   | US-017     | #17   | 3            | **Aura Component Parser** - Controller, helpers, eventos |
| **5**   | US-020     | #20   | 3            | **Profile Parser** - Similar a PermissionSet             |
| **5**   | US-021     | #21   | 2            | **Layout Parser** - Object, buttons, VF pages            |
| **5**   | US-022     | #22   | 3            | **FlexiPage Parser** - LWC/Aura components               |
| **5**   | US-023     | #23   | 3            | **Visualforce Parser** - Controllers, extensions         |
| **5**   | US-024     | #24   | 3            | **Bot Parser** - Dialogs, GenAI, Flows                   |
| **5**   | US-025     | #25   | 2            | **GenAI Prompt Parser** - Objects, fields, model config  |

**Subtotal Parsers Should Have**: 19 story points

---

## 🟢 COULD HAVE (Baja Prioridad)

### Epic 3: Dependency Analysis (Extras)

| TODO ID | User Story | Issue | Story Points | Descripción                                                     |
| ------- | ---------- | ----- | ------------ | --------------------------------------------------------------- |
| -       | US-031     | #31   | 2            | **Dependency Depth Calculator** - Calcular depth por componente |
| -       | US-032     | #32   | 3            | **Dependency Impact Analyzer** - Analizar impacto de cambios    |
| -       | US-035     | #35   | 3            | **Dependency Visualization** - Mermaid/DOT diagrams             |
| -       | US-036     | #36   | 3            | **Dependency Caching** - Cache para análisis                    |
| -       | US-037     | #37   | 3            | **Dependency Merge** - Merge static + AI deps                   |

---

## 📊 Orden de Implementación Recomendado

### 🎯 Phase 1: Foundation (Sprint 1-2, ~40 pts)

**Orden de implementación:**

1. **US-004, US-005, US-006** (TODO #3) - **Constants** [5 pts]

   ```bash
   git checkout -b feat/4-salesforce-limits-constants
   # Implementar constants/salesforce-limits.ts
   # Implementar constants/deployment-order.ts
   # Implementar constants/metadata-types.ts
   ```

2. **US-001** (TODO #4) - **Functional Utilities** [3 pts]

   ```bash
   git checkout -b feat/1-functional-utilities
   # Implementar utils/functional.ts (pipe, compose)
   # Tests con @ac US-001-AC-1, US-001-AC-2, etc.
   ```

3. **US-002** (TODO #4) - **Graph Algorithms** [5 pts]

   ```bash
   git checkout -b feat/2-graph-algorithms
   # Implementar utils/graph-algorithms.ts
   # Topological sort, detectCycles
   ```

4. **US-003** (TODO #4) - **File System Utils** [3 pts]

   ```bash
   git checkout -b feat/3-file-system-utils
   # Implementar utils/fs-utils.ts
   ```

5. **US-010** (TODO #4) - **XML Utils** [3 pts]

   ```bash
   git checkout -b feat/10-xml-utils
   # Implementar utils/xml-utils.ts
   ```

6. **US-008** (TODO #16) - **Error Types** [2 pts]
   ```bash
   git checkout -b feat/8-error-types
   # Implementar types/errors.ts
   ```

---

### 🎯 Phase 2: Parsers Core (Sprint 3-4, ~45 pts)

7. **US-027** (TODO #5) - **Parser Factory** [3 pts]
8. **US-013** (TODO #5) - **Apex Parser** [5 pts] ⭐ CRÍTICO
9. **US-015** (TODO #5) - **Flow Parser** [5 pts]
10. **US-016** (TODO #5) - **LWC Parser** [4 pts]
11. **US-018** (TODO #5) - **Object Parser** [5 pts]
12. **US-019** (TODO #5) - **PermissionSet Parser** [3 pts]

---

### 🎯 Phase 3: Dependency Engine (Sprint 5, ~28 pts)

13. **US-028** (TODO #6) - **Graph Builder** [5 pts]
14. **US-029** (TODO #6) - **Heuristics** [5 pts]
15. **US-030** (TODO #6) - **Cycle Detection** [3 pts]
16. **US-033** (TODO #6) - **Dependency Resolver** [3 pts]
17. **US-034** (TODO #6) - **Validation** [2 pts]

---

### 🎯 Phase 4: Wave Generation (Sprint 6, ~25 pts)

18. **US-038** (TODO #6) - **Wave Generator** [3 pts]
19. **US-039** (TODO #6) - **Wave Splitter** [3 pts]
20. **US-040** (TODO #6) - **Test Optimizer** [3 pts]
21. **US-043** (TODO #6) - **Wave Validation** [2 pts]
22. **US-085** (TODO #8) - **Manifest Generator** [3 pts]

---

### 🎯 Phase 5: Project Scanner (Sprint 6-7, ~20 pts)

23. **US-079** (TODO #11) - **SFDX Detection** [3 pts]
24. **US-083** (TODO #11) - **Forceignore** [2 pts]

---

### 🎯 Phase 6: CLI Commands (Sprint 7-8, ~30 pts)

25. **US-047** (TODO #9) - **analyze command** [3 pts] ⭐ EMPEZAR AQUÍ
26. **US-046** (TODO #9) - **start command** [5 pts]
27. **US-048** (TODO #9) - **validate command** [3 pts]

---

### 🎯 Phase 7: Deployment Execution (Sprint 8-9, ~25 pts)

28. **US-085** (TODO #7) - **SF CLI Integration** [3 pts]
29. **US-086** (TODO #7) - **Progress Tracking** [3 pts]
30. **US-090** (TODO #7) - **Reporting** [3 pts]

---

## 🚀 Plan de Acción Inmediato

### Paso 1: Crear Issues en GitHub

```bash
# Primero, crear todos los 90 issues
node scripts/create-github-issues.js

# Esto creará issues con:
# - #1 = US-001: Functional Utilities
# - #2 = US-002: Graph Algorithms
# - #4 = US-004: Salesforce Limits
# etc.
```

### Paso 2: Empezar por Foundation (Epic 1)

**Sprint 1 (Semana 1-2): Utils Foundation**

```bash
# Issue #4 - Constants
git checkout -b feat/4-salesforce-limits-constants
# Implementar + tests con @ac

# Issue #1 - Functional Utils
git checkout -b feat/1-functional-utilities
# Implementar + tests con @ac

# Issue #2 - Graph Algorithms
git checkout -b feat/2-graph-algorithms
# Implementar + tests con @ac
```

Cada PR:

- ✅ Tests con `@ac` annotations
- ✅ AC validation automática
- ✅ Coverage >90%
- ✅ Merge solo si AC completados

---

## 📈 Métricas de Progreso

```
Total Story Points: 275
Phase 1 (Foundation): 40 pts (15%)
Phase 2 (Parsers): 45 pts (16%)
Phase 3 (Dependencies): 28 pts (10%)
Phase 4 (Waves): 25 pts (9%)
Phase 5 (Scanner): 20 pts (7%)
Phase 6 (CLI): 30 pts (11%)
Phase 7 (Deployment): 25 pts (9%)
Testing: 36 pts (13%)
Error Handling: 21 pts (8%)
Remaining: 5 pts (2%)
```

**Estimación**: 7-8 sprints (14-16 semanas)

---

## ✅ Resumen Ejecutivo

**TODOs Mapeados**:

- TODO #3 → Issues #4, #5, #6 (Constants)
- TODO #4 → Issues #1, #2, #3, #10, #11 (Utils)
- TODO #5 → Issues #13-27 (Parsers)
- TODO #6 → Issues #28-43 (Services)
- TODO #7 → Issues #85-90 (Core)
- TODO #8 → Issues relacionados (Generators)
- TODO #9 → Issues #46-53 (Commands)
- TODO #10-15 → Issues #61-77 (Testing)
- TODO #16 → Issues #71-78 (Error Handling)

**Prioridad 1 (MUST HAVE)**: ~180 story points
**Prioridad 2 (SHOULD HAVE)**: ~60 story points
**Prioridad 3 (COULD HAVE)**: ~35 story points

---

**¿Quieres que cree los issues en GitHub ahora y empecemos con Phase 1 (Foundation)?**
