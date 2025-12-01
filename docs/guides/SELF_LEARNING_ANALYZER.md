# 🧠 Self-Learning Dependency Analyzer

## 🎯 Concepto

Un sistema de análisis de dependencias que **aprende automáticamente** pero **no modifica código sin supervisión humana**.

```
┌─────────────────────────────────────────────────────────────┐
│  Developer Workflow                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  git commit                                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  PRE-COMMIT HOOK (.husky/pre-commit)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. 🧠 Dependency Analyzer Self-Learning               │  │
│  │    - Ejecuta sf_dependency_analyzer.py                │  │
│  │    - Detecta metadata types no implementados          │  │
│  │    - Detecta componentes aislados                     │  │
│  │    - Valida DEPLOY_ORDER                              │  │
│  │    - Genera analyzer_health_report.json               │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 2. 🔍 Code Analyzer v5                                │  │
│  │    - PMD para Apex                                    │  │
│  │    - ESLint para LWC                                  │  │
│  │    - Bloquea si severity = HIGH                       │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Si detecta tipos nuevos:                                   │
│  💡 "Detected N new metadata types"                         │
│     "Run: python3 scripts/python/generate_suggested_code.py"│
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼ (Optional)
┌─────────────────────────────────────────────────────────────┐
│  Developer ejecuta manualmente:                             │
│  $ python3 scripts/python/generate_suggested_code.py        │
│                                                              │
│  Opciones:                                                   │
│  --validate    Crea scratch org y valida                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Output:                                                     │
│  ✅ suggested_analyzer_methods.py (código generado)         │
│  ✅ analyzer_health_report.json (análisis)                  │
│                                                              │
│  Si --validate:                                              │
│  1. Crea scratch org temporal                               │
│  2. Valida deployment                                       │
│  3. Elimina scratch org                                     │
│  4. Reporta si funciona o no                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  Developer:                                                  │
│  1. Revisa suggested_analyzer_methods.py                    │
│  2. Si es correcto, copia a sf_dependency_analyzer.py       │
│  3. Agrega llamada en analyze()                             │
│  4. Actualiza DEPLOY_ORDER                                  │
│  5. Prueba: python3 sf_dependency_analyzer.py               │
│  6. Commit: git commit -m "feat: add new metadata type"     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Archivos

### 1. `.husky/pre-commit`
Hook de Git que se ejecuta antes de cada commit.

**Funciones:**
- ✅ Ejecuta dependency analyzer silenciosamente
- ✅ Detecta y reporta tipos nuevos
- ✅ Ejecuta Code Analyzer v5
- ❌ NO bloquea el commit por tipos nuevos (solo informa)

### 2. `scripts/python/sf_dependency_analyzer.py`
Script principal de análisis.

**Nuevas capacidades:**
- `post_analysis_report()`: Genera reporte de salud
- `scan_for_unknown_types()`: Detecta directorios no implementados
- `_calculate_max_depth()`: Valida DEPLOY_ORDER

### 3. `scripts/python/generate_suggested_code.py` (NUEVO)
Generador de código inteligente.

**Funciones:**
- Lee `analyzer_health_report.json`
- Genera métodos sugeridos basados en patterns
- Opcionalmente valida en scratch org
- Produce `suggested_analyzer_methods.py`

### 4. `analyzer_health_report.json`
Reporte automático de salud.

```json
{
  "timestamp": "2025-11-21T23:48:55",
  "unknown_types": [
    {
      "directory": "customNotifications",
      "inferred_type": "CustomNotification",
      "count": 5,
      "sample": "MyNotification.customNotification-meta.xml"
    }
  ],
  "isolated_components_count": 222,
  "deploy_order_mismatches": [],
  "stats": {
    "total_components": 2263,
    "total_dependencies": 2164,
    "types_analyzed": 65
  }
}
```

### 5. `suggested_analyzer_methods.py` (Generado)
Código sugerido para implementar.

```python
def _analyze_custom_notifications(self):
    """Analiza CustomNotification (AUTO-GENERADO - REVISAR)"""
    path = self.metadata_path / "customNotifications"
    if not path.exists():
        return

    for item_file in path.glob("*.customNotification-meta.xml"):
        item_name = item_file.stem.replace('.customNotification-meta', '')
        self._add_node('CustomNotification', item_name, str(item_file))
```

---

## 🚀 Uso

### Uso Normal (Automático)

```bash
# El analyzer se ejecuta automáticamente en cada commit
git add .
git commit -m "feat: add new feature"

# Output:
🧠 Dependency Analyzer Self-Learning Check...
================================================
✅ All metadata types implemented
================================================

🔍 Code Analyzer v5 Quality Check...
# ... continúa con code analysis ...
```

### Uso con Tipos Nuevos

```bash
# Commit detecta tipo nuevo
git commit -m "feat: add custom notifications"

# Output:
🧠 Dependency Analyzer Self-Learning Check...
================================================
💡 Detected 1 new metadata types
   To generate suggested code:
   python3 scripts/python/generate_suggested_code.py
================================================

# Developer decide generar código sugerido
python3 scripts/python/generate_suggested_code.py

# Output:
🚀 Generador de Código Sugerido
============================================================
🔧 Generando código sugerido para 1 tipos...
✅ Código generado en: suggested_analyzer_methods.py

📊 Estadísticas:
   Componentes analizados: 2263
   Tipos implementados: 65
   Nuevos tipos detectados: 1

============================================================
📝 PRÓXIMOS PASOS:
============================================================

1. Revisar código generado:
   cat suggested_analyzer_methods.py

2. Si es correcto, agregar a sf_dependency_analyzer.py:
   - Copiar métodos a la clase SalesforceDependencyAnalyzer
   - Agregar llamadas en analyze()
   - Actualizar DEPLOY_ORDER si necesario

3. Probar:
   python3 scripts/python/sf_dependency_analyzer.py

4. Commit si funciona:
   git add scripts/python/sf_dependency_analyzer.py
   git commit -m 'feat: add support for CustomNotification'
============================================================
```

### Uso con Validación en Scratch Org

```bash
# Validar código generado antes de aplicar
python3 scripts/python/generate_suggested_code.py --validate

# Output adicional:
============================================================
🧪 VALIDACIÓN EN SCRATCH ORG
============================================================

🌱 Creando scratch org temporal para validación...
✅ Scratch org creado: analyzer-validation

🧪 Validando deployment en scratch org...
✅ Validación exitosa en scratch org

🧹 Limpiando scratch org temporal...
✅ Scratch org eliminado

✅ Las sugerencias son válidas
   Puedes revisar e implementar el código generado
============================================================
```

---

## 🔒 Seguridad y Control

### ✅ Lo Que SÍ Hace (Seguro)

1. **Detecta gaps** sin intervención
2. **Genera reportes** JSON auditables
3. **Sugiere código** en archivo separado
4. **Valida en scratch org** desechable (opcional)
5. **Informa al developer** sin bloquear

### ❌ Lo Que NO Hace (Por Diseño)

1. ❌ NO modifica `sf_dependency_analyzer.py` automáticamente
2. ❌ NO hace commits automáticos
3. ❌ NO aplica código sin revisión humana
4. ❌ NO bloquea commits por tipos nuevos
5. ❌ NO toca el org de desarrollo/producción

---

## 🎯 Ventajas

1. **Proactivo**: Detecta problemas antes del CI/CD
2. **Seguro**: Requiere revisión humana
3. **Validado**: Scratch org prueba el código
4. **Auditable**: Todo en Git
5. **No invasivo**: No bloquea workflow
6. **Educativo**: Genera código que puedes aprender

---

## 📋 Casos de Uso

### Caso 1: Salesforce Lanza Nuevo Metadata Type

```
1. Salesforce lanza "GenAiPlanner"
2. Tu proyecto agrega archivos *.genAiPlanner-meta.xml
3. git commit detecta el nuevo tipo
4. Sugiere generar código
5. Ejecutas: generate_suggested_code.py --validate
6. Valida en scratch org
7. Si funciona, copias código a analyzer
8. Commit y push
```

### Caso 2: Proyecto Agrega Nueva Integración

```
1. Instalas un managed package
2. Agrega metadata type "ExternalDataSource"
3. Pre-commit detecta el gap
4. Generas código sugerido
5. Revisas y adaptas si necesario
6. Implementas en analyzer
```

### Caso 3: Optimización de DEPLOY_ORDER

```
1. Analyzer detecta: GenAiPlugin tiene depth mayor que DEPLOY_ORDER
2. Genera reporte en analyzer_health_report.json
3. Revisas y ajustas manualmente DEPLOY_ORDER
4. Re-ejecutas analyzer
5. Validas que ciclos desaparecen
```

---

## 🛠️ Mantenimiento

### Agregar Nuevo Tipo Manualmente

Si el código generado no es suficiente:

```python
# 1. Agregar método personalizado
def _analyze_my_custom_type(self):
    """Analiza MyCustomType con lógica compleja"""
    path = self.metadata_path / "myCustomTypes"
    # ... lógica personalizada ...

# 2. Agregar a analyze()
def analyze(self):
    # ... otros tipos ...
    self._analyze_my_custom_type()

# 3. Actualizar DEPLOY_ORDER
DEPLOY_ORDER = {
    # ... otros tipos ...
    'MyCustomType': 15,  # Después de dependencias
}

# 4. Actualizar type_mapping
type_mapping = {
    # ... otros tipos ...
    'MyCustomType': 'MyCustomType',
}
```

### Desactivar Self-Learning

Si quieres desactivarlo temporalmente:

```bash
# Opción 1: Comentar en pre-commit
# ... código del analyzer ...

# Opción 2: Variable de entorno
export SKIP_ANALYZER_CHECK=1
git commit -m "..."
```

---

## 📊 Métricas

El sistema rastrea:

- **unknown_types**: Tipos no implementados
- **isolated_components**: Componentes sin dependencias
- **deploy_order_mismatches**: Orden subóptimo
- **total_components**: Total analizado
- **total_dependencies**: Total detectado
- **types_analyzed**: Tipos implementados

---

## 🎓 Filosofía

> **"Automatiza la detección, humaniza la decisión"**

El sistema es **auto-evolutivo** (detecta y aprende) pero NO **auto-modificante** (no cambia código sin permiso).

Es como un **asistente inteligente** que:
- 👀 Observa constantemente
- 💡 Sugiere mejoras
- 🧪 Valida propuestas
- ⏸️  Espera tu decisión
- ✅ Aplica solo con tu aprobación

---

## 🚀 Futuras Mejoras

Posibles extensiones:

1. **Aprender de Deployment Failures**: Parsear logs de CI/CD
2. **ML para Inferir Dependencias**: Usar patterns históricos
3. **Auto-Fix de Issues Simples**: Problemas triviales auto-corregibles
4. **Dashboard de Salud**: Visualización de métricas
5. **Integración con GitHub Issues**: Auto-crear issues para tipos nuevos
6. **Notificaciones Slack**: Alertar al equipo de gaps detectados

---

## 📞 Soporte

Si encuentras issues:

1. Revisa `analyzer_health_report.json`
2. Ejecuta manualmente: `python3 sf_dependency_analyzer.py`
3. Verifica `suggested_analyzer_methods.py` si se generó
4. Comparte el error en el equipo

---

## ✅ Checklist de Implementación

- [x] Dependency analyzer con post_analysis_report()
- [x] Pre-commit hook integrado
- [x] Generador de código sugerido
- [x] Validación en scratch org (opcional)
- [x] Documentación completa
- [ ] Tests unitarios para generador
- [ ] Dashboard de métricas
- [ ] Integración con CI/CD para alertas

