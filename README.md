# SF Smart Deployment Plugin - Development

Este directorio contiene los archivos base para el desarrollo del plugin `@salesforce/plugin-smart-deployment`.

## 📁 Estructura Actual

```
smart-deployment/
├── docs/
│   └── SF_SMART_DEPLOYMENT_PLUGIN_PROPOSAL.md  # Propuesta completa del plugin
├── sf_dependency_analyzer.py                    # Core logic (Python - base para TypeScript)
├── cleanup_old_flow_versions.py                 # Flow version management
├── deploy_custom_metadata_smart_batches.py      # CMT batch deployment
└── README.md                                     # Este archivo
```

## 🎯 Próximos Pasos

### 1. Inicializar Plugin
```bash
cd ~/dev/smart-deployment
sf plugins generate plugin

# Cuando te pida descripción, usa:
# "Intelligent Salesforce metadata deployment plugin that automatically analyzes
# dependencies, generates optimal deployment batches, and handles complex metadata
# types with built-in safeguards."
```

### 2. Migrar Lógica Python → TypeScript
- `sf_dependency_analyzer.py` → `src/engine/dependency-analyzer.ts`
- `cleanup_old_flow_versions.py` → `src/utils/flow-cleanup.ts`
- `deploy_custom_metadata_smart_batches.py` → `src/engine/cmt-batcher.ts`

### 3. Implementar Comandos
```
src/commands/smart-deployment/
├── start.ts      # Main deployment command
├── analyze.ts    # Analysis only
├── validate.ts   # Dry-run
├── status.ts     # Progress check
└── resume.ts     # Resume from failure
```

### 4. Testing
```bash
npm test
npm run test:integration
```

### 5. Publicación
```bash
npm publish --access public
```

## 🔑 Conceptos Clave

### Límites Hardcodeados (NO configurables por usuario)
- **Max components per wave**: 300 (evita UNKNOWN_EXCEPTION)
- **Max CMT records per wave**: 200 (límite probado de SF)
- **Max files per deployment**: ~400-500 (límite de API)

Estos NO deben ser flags públicos - son límites técnicos de Salesforce.

### Metadata Type Mapping
El analyzer debe usar los nombres exactos que espera el SF CLI en package.xml:
- `Translations` (no `Translation`)
- `CustomNotificationType` (no `NotificationType`)
- `Settings` (no `OrgSettings`)
- Documents: `FolderName/DocumentName`
- DigitalExperienceBundle: `site/SiteName`

## 📚 Referencias

- [Salesforce CLI Plugin Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/)
- [Salesforce Metadata API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [Agentforce DX Documentation](https://developer.salesforce.com/docs/einstein/genai/guide/agent-dx.html)

## 🎓 Aprendizajes Clave

1. **Component vs File count**: Algunos componentes generan múltiples archivos (CustomObject con fields)
2. **CMT limits**: CustomMetadataRecords tienen límite más bajo que general metadata
3. **Path formatting**: Documents y DigitalExperience requieren path completo en member name
4. **Test optimization**: Solo ejecutar tests en waves con Apex/Flow ahorra 40-60% del tiempo
5. **Fail-fast vs retry**: Production = fail-fast, Sandbox = retry sin tests

---

**Status**: 🟡 En desarrollo inicial
**Owner**: @jterrats
**Created**: Dec 1, 2025
