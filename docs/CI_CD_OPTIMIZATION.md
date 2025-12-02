# CI/CD Optimization Strategy

## Current State

Durante las fases iniciales del proyecto (Phase 1-2), los workflows de GitHub Actions han sido optimizados para **minimizar el consumo de minutos de CI** mientras se desarrollan solo tipos, constantes e interfaces base.

## Workflows Simplificados

### 1. `test.yml` - Tests en Push

**Activo**: Solo unit tests  
**Comentado**: NUTs (Salesforce integration tests en Ubuntu + Windows)

**Razón**: En esta fase solo hay types y constants, no hay lógica Salesforce real que requiera integration tests.

**Rehabilitar cuando**:

- Se implemente el primer parser (Issue #13+)
- Se implemente lógica de dependency analysis (Issue #28+)
- Se implemente deployment real (Issue #85+)

### 2. `acceptance-criteria-validation.yml` - Validación de AC en PRs

**Activo**: Solo unit tests  
**Comentado**: Integration tests, E2E tests, NUTs

**Razón**: Los scripts `test:integration`, `test:e2e` aún no existen y no hay funcionalidad que requiera estos niveles de testing.

**Rehabilitar cuando**:

- Integration tests: Phase 3 (Dependencies) - Issue #28+
- E2E tests: Phase 5 (CLI Commands) - Issue #46+
- NUTs: Phase 6 (Deployment) - Issue #85+

## Tests Eliminados (Placeholders)

Los siguientes archivos fueron eliminados porque eran placeholders vacíos que causaban errores de linting:

### Unit Tests Eliminados

- `test/unit/utils/functional.test.ts` → **Recrear en Issue #1** (Functional Utils)
- `test/unit/utils/functional.error.test.ts` → **Recrear en Issue #1** (Error Handling)
- `test/unit/parsers/apex-parser.test.ts` → **Recrear en Issue #13** (Apex Parser)

### E2E Tests Eliminados

- `test/e2e/features/deployment.feature` → **Recrear en Issue #61** (E2E Testing)
- `test/e2e/features/error-handling.feature` → **Recrear en Issue #62** (Error Scenarios)

## Estrategia de Recreación (TDD)

Cada test se recreará **ANTES** de implementar su funcionalidad correspondiente, siguiendo **Test-Driven Development**:

1. **Escribir el test** (debe fallar)
2. **Implementar la funcionalidad mínima** para que pase
3. **Refactorizar** si es necesario
4. **Agregar anotaciones `@ac`** para vincular con acceptance criteria

### Ejemplo de Workflow TDD

```bash
# 1. Crear branch para Issue #13 (Apex Parser)
git checkout -b feat/13-apex-parser

# 2. Crear test PRIMERO (TDD)
touch test/unit/parsers/apex-parser.test.ts
# Escribir tests con @ac annotations

# 3. Ejecutar test (debe FALLAR)
yarn test

# 4. Implementar funcionalidad
touch src/parsers/apex-parser.ts
# Escribir código mínimo

# 5. Ejecutar test (debe PASAR)
yarn test

# 6. Commit y PR
git add -A
git commit -m "feat: implement Apex parser (Issue #13)"
git push
```

## Timeline de Rehabilitación

### Phase 1 (Current) - Foundation

- ✅ Solo unit tests básicos
- ❌ No NUTs, no integration, no E2E

### Phase 2 (Issues #13-27) - Parsers

- ✅ Unit tests para parsers
- ⚠️ Considerar habilitar integration tests si se necesita org real
- ❌ No E2E todavía

### Phase 3 (Issues #28-37) - Dependencies

- ✅ Unit tests + Integration tests
- ⚠️ Considerar habilitar NUTs light
- ❌ No E2E todavía

### Phase 4-5 (Issues #38-53) - Waves & CLI

- ✅ Unit tests + Integration tests + E2E tests
- ⚠️ Habilitar NUTs parcialmente
- ✅ E2E con Cucumber/Gherkin

### Phase 6 (Issues #85-90) - Deployment

- ✅ ALL tests enabled (unit, integration, E2E, NUTs)
- ✅ Full CI/CD matrix (Ubuntu + Windows)
- ✅ Pre-release testing completo

## Estimación de Minutos Ahorrados

### Configuración Actual (Simplificada)

- Push a branch: ~5 mins (solo unit tests)
- PR a main: ~5 mins (solo unit tests + AC validation)
- **Total por PR completo**: ~10 mins

### Configuración Completa (Full)

- Push a branch: ~25 mins (unit + NUTs en 2 OS)
- PR a main: ~40 mins (unit + integration + E2E + NUTs)
- **Total por PR completo**: ~65 mins

### Ahorro durante desarrollo inicial

- **Estimado 11 PRs en Phase 1**: 11 × 55 mins = **605 minutos ahorrados** (~10 horas)
- **Estimado 15 PRs en Phase 2**: 15 × 55 mins = **825 minutos ahorrados** (~14 horas)

## Comandos para Rehabilitar

### Paso 1: Descomentar en `test.yml`

```yaml
nuts:
  needs: unit-tests
  uses: salesforcecli/github-workflows/.github/workflows/nut.yml@main
  # ... resto del config
```

### Paso 2: Descomentar en `acceptance-criteria-validation.yml`

```yaml
- name: Run integration tests
  id: integration-tests
  run: |
    yarn test:integration --json --outputFile=test-results-integration.json || true
  continue-on-error: true
# ... resto de los tests
```

### Paso 3: Agregar scripts en `package.json` (cuando existan)

```json
{
  "scripts": {
    "test:integration": "mocha 'test/integration/**/*.test.ts'",
    "test:e2e": "cucumber-js test/e2e/features",
    "test:nuts": "nyc mocha '**/*.nut.ts' --slow 4500 --timeout 600000"
  }
}
```

## Notas

- ⚠️ No eliminar los comentarios de los workflows hasta que se rehabiliten
- ⚠️ Actualizar este documento cuando se habilite cada nivel de testing
- ⚠️ Monitorear límites de GitHub Actions minutes si se excede el plan free
- ✅ Considerar usar `workflow_dispatch` para tests pesados (trigger manual)

## Referencias

- GitHub Actions Usage Limits: https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- Salesforce CLI Workflows: https://github.com/salesforcecli/github-workflows
- TDD Best Practices: `docs/methodology/TESTING_STRATEGY.md`
