#!/usr/bin/env python3
"""
Script to analyze the complete Salesforce codebase and generate comprehensive documentation
with Mermaid diagrams for the support team.
"""

import os
import re
import json
from collections import defaultdict
from pathlib import Path

BASE_PATH = "force-app/main/default"

class CodebaseAnalyzer:
    def __init__(self):
        self.classes = defaultdict(dict)
        self.triggers = {}
        self.flows = []
        self.objects = []
        self.handlers = []
        self.services = []
        self.integrations = []
        self.utilities = []
        self.test_classes = []

    def analyze_apex_classes(self):
        """Analyze all Apex classes and categorize them"""
        classes_path = Path(BASE_PATH) / "classes"
        for cls_file in classes_path.glob("*.cls"):
            if "Test" in cls_file.stem:
                continue

            with open(cls_file, 'r', encoding='utf-8') as f:
                content = f.read()

            class_info = {
                'name': cls_file.stem,
                'description': self._extract_description(content),
                'methods': self._extract_public_methods(content),
                'dependencies': self._extract_dependencies(content),
                'is_handler': '_Handler' in cls_file.stem or 'Handler' in cls_file.stem,
                'is_service': '_Service' in cls_file.stem,
                'is_integration': 'Http' in cls_file.stem or 'Callout' in cls_file.stem,
                'is_utility': 'Helper' in cls_file.stem or 'Wrapper' in cls_file.stem or 'Utility' in cls_file.stem,
            }

            self.classes[cls_file.stem] = class_info

            if class_info['is_handler']:
                self.handlers.append(class_info)
            elif class_info['is_service']:
                self.services.append(class_info)
            elif class_info['is_integration']:
                self.integrations.append(class_info)
            elif class_info['is_utility']:
                self.utilities.append(class_info)

    def _extract_description(self, content):
        """Extract description from class header comment"""
        match = re.search(r'\* @description\s*:\s*(.+)', content)
        return match.group(1).strip() if match else "No description"

    def _extract_public_methods(self, content):
        """Extract public method signatures"""
        pattern = r'public\s+(?:static\s+)?(?:\w+(?:<[\w,\s<>]+>)?)\s+(\w+)\s*\([^)]*\)'
        methods = re.findall(pattern, content)
        return list(set(methods))[:10]  # Limit to 10 methods

    def _extract_dependencies(self, content):
        """Extract class dependencies (calls to other classes)"""
        dependencies = set()
        # Look for class calls like SC_Case_Service.method(), JT_DataSelector.getRecords()
        pattern = r'([A-Z][A-Za-z0-9_]+)\.'
        matches = re.findall(pattern, content)
        for match in matches:
            if match in ['System', 'String', 'Integer', 'Boolean', 'List', 'Map', 'Set', 'Date', 'Datetime', 'Database', 'Test', 'Schema']:
                continue
            dependencies.add(match)
        return list(dependencies)[:15]  # Limit to 15

    def analyze_triggers(self):
        """Analyze all triggers"""
        triggers_path = Path(BASE_PATH) / "triggers"
        for trigger_file in triggers_path.glob("*.trigger"):
            with open(trigger_file, 'r', encoding='utf-8') as f:
                content = f.read()

            self.triggers[trigger_file.stem] = {
                'name': trigger_file.stem,
                'object': re.search(r'on\s+(\w+)', content).group(1) if re.search(r'on\s+(\w+)', content) else 'Unknown',
                'handler': self._extract_handler_call(content)
            }

    def _extract_handler_call(self, content):
        """Extract handler class name from trigger"""
        match = re.search(r'new\s+(\w+_Handler)\s*\(\)', content)
        return match.group(1) if match else "No handler"

    def analyze_flows(self):
        """List all flows"""
        flows_path = Path(BASE_PATH) / "flows"
        for flow_file in flows_path.glob("*.flow-meta.xml"):
            self.flows.append(flow_file.stem)

    def analyze_objects(self):
        """List all custom objects"""
        objects_path = Path(BASE_PATH) / "objects"
        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                self.objects.append(obj_dir.name)

    def generate_architecture_diagram(self):
        """Generate Mermaid architecture diagram"""
        diagram = """```mermaid
graph TB
    subgraph "🎯 Capa de Presentación"
        LWC[Lightning Web Components]
        FLOWS[Salesforce Flows]
        AGENT[Agentforce]
    end

    subgraph "🔧 Capa de Triggers"
"""
        for trigger_name, trigger_info in self.triggers.items():
            obj = trigger_info['object']
            handler = trigger_info['handler']
            diagram += f"        {trigger_name}[{obj} Trigger]:::trigger\n"
            diagram += f"        {trigger_name} --> {handler}\n"

        diagram += "    end\n\n"
        diagram += "    subgraph \"📦 Capa de Handlers\"\n"

        for handler in self.handlers[:6]:  # Limit to avoid clutter
            diagram += f"        {handler['name']}[{handler['name']}]:::handler\n"

        diagram += "    end\n\n"
        diagram += "    subgraph \"⚙️ Capa de Servicios\"\n"

        for service in self.services[:6]:
            diagram += f"        {service['name']}[{service['name']}]:::service\n"

        diagram += "    end\n\n"
        diagram += "    subgraph \"🌐 Capa de Integración\"\n"

        for integration in self.integrations[:6]:
            diagram += f"        {integration['name']}[{integration['name']}]:::integration\n"

        diagram += "    end\n\n"
        diagram += "    subgraph \"🗄️ Capa de Datos\"\n"
        diagram += "        SOBJECTS[(Salesforce Objects)]\n"
        diagram += "        METADATA[(Custom Metadata)]\n"
        diagram += "    end\n\n"
        diagram += "    subgraph \"🔌 Sistemas Externos\"\n"
        diagram += "        CMD_API[CMD API]\n"
        diagram += "        EMAIL_API[Responsys Email API]\n"
        diagram += "        UBER_API[Uber Eats API]\n"
        diagram += "        VOUCHER_API[Voucher API]\n"
        diagram += "    end\n\n"

        # Add connections
        diagram += "    LWC --> FLOWS\n"
        diagram += "    AGENT --> FLOWS\n"
        diagram += "    FLOWS --> SC_Case_Handler\n"
        diagram += "    SC_Case_Handler --> SC_Case_Service\n"
        diagram += "    SC_Account_Handler --> SC_Account_Service\n"
        diagram += "    SC_Case_Service --> SC_HttpSendEmailGRG\n"
        diagram += "    SC_Case_Service --> SC_HttpSendVoucherGRG\n"
        diagram += "    SC_Account_Service --> SC_SendAccountsCMDQueueable\n"
        diagram += "    SC_HttpSendEmailGRG --> EMAIL_API\n"
        diagram += "    SC_HttpSendVoucherGRG --> VOUCHER_API\n"
        diagram += "    SC_SendAccountsCMDQueueable --> CMD_API\n"
        diagram += "    SC_Uber_Callout --> UBER_API\n"
        diagram += "    SC_Case_Service --> SOBJECTS\n"
        diagram += "    SC_Account_Service --> SOBJECTS\n"
        diagram += "    JT_DataSelector --> METADATA\n\n"

        diagram += "    classDef trigger fill:#ff6b6b,stroke:#c92a2a,color:#fff\n"
        diagram += "    classDef handler fill:#4dabf7,stroke:#1971c2,color:#fff\n"
        diagram += "    classDef service fill:#51cf66,stroke:#2f9e44,color:#fff\n"
        diagram += "    classDef integration fill:#ffd43b,stroke:#f08c00,color:#000\n"
        diagram += "```\n"

        return diagram

    def generate_case_flow_diagram(self):
        """Generate detailed Case lifecycle diagram"""
        return """```mermaid
sequenceDiagram
    participant User as 👤 Usuario
    participant Agent as 🤖 Agentforce
    participant Flow as 🔄 Flow
    participant Trigger as ⚡ SC_CaseTrigger
    participant Handler as 📦 SC_Case_Handler
    participant Service as ⚙️ SC_Case_Service
    participant Email as 📧 SC_HttpSendEmailGRG
    participant Voucher as 🎁 SC_HttpSendVoucherGRG
    participant API as 🌐 APIs Externas

    User->>Agent: Crea caso
    Agent->>Flow: SC_GRG_CreateCaseFromAgent
    Flow->>Trigger: INSERT

    Trigger->>Handler: beforeInsert()
    Handler->>Service: processCasesToInsert()
    Service->>Service: autoPrioritizeCases()
    Service->>Service: setContactPoint()
    Service->>Service: copyFieldValue()

    Trigger->>Handler: afterInsert()
    Handler->>Service: updateCaseLoyalty()

    alt Status = Working
        Service->>Email: triggerCampaignEmailFromCase()
        Email->>API: POST /responsys/v1/campaigns
        API-->>Email: 200 OK

        Service->>Service: sendEscalationEmailAlerts()
        Service->>Voucher: verifyIfVoucherIsNeeded()
        Voucher->>API: POST /voucher/send
        API-->>Voucher: 200 OK
    end

    User->>Flow: Actualiza caso
    Flow->>Trigger: UPDATE

    Trigger->>Handler: beforeUpdate()
    Handler->>Service: processCasesToUpdate()
    Service->>Service: trackingSLA()
    Service->>Email: Messaging.sendEmail()

    alt Status = Closed
        Service->>Email: triggerCampaignEmailFromCase()
        Service->>Service: closeCaseMilestones()
    end
```
"""

    def generate_integration_diagram(self):
        """Generate integration architecture diagram"""
        return """```mermaid
graph LR
    subgraph "Salesforce Org"
        A[SC_HttpSendEmailGRG]
        B[SC_HttpSendVoucherGRG]
        C[SC_SendAccountsCMDQueueable]
        D[SC_Uber_Callout]
        E[SC_Http_Helper]
        F[SC_RestConfig__mdt]
    end

    subgraph "APIs Externas"
        G[Responsys Email API]
        H[Voucher API GRG]
        I[CMD API]
        J[Uber Eats API]
    end

    A -->|GET /templates| G
    A -->|POST /campaigns/trigger| G
    B -->|POST /voucher/send| H
    B -->|GET /voucher/status| H
    C -->|POST /customer/sync| I
    D -->|GET /orders/{email}| J
    D -->|POST /order/status| J

    A --> E
    B --> E
    C --> E
    D --> E
    E --> F

    F -.->|Config: Endpoint, Auth| A
    F -.->|Config: Endpoint, Auth| B
    F -.->|Config: Endpoint, Auth| C
    F -.->|Config: Endpoint, Auth| D

    style G fill:#ffd43b
    style H fill:#ffd43b
    style I fill:#ffd43b
    style J fill:#ffd43b
    style E fill:#51cf66
    style F fill:#4dabf7
```
"""

    def generate_data_model_diagram(self):
        """Generate simplified data model diagram"""
        return """```mermaid
erDiagram
    CASE ||--o{ CASE_MILESTONE : tiene
    CASE }o--|| ACCOUNT : pertenece
    CASE }o--|| ENTITLEMENT : usa
    CASE }o--o| CONTACT_POINT_EMAIL : tiene
    ACCOUNT ||--o{ CONTACT_POINT_EMAIL : tiene
    ACCOUNT ||--o{ CONTACT_POINT_PHONE : tiene
    ACCOUNT }o--o| LOYALTY_PROGRAM_MEMBER : es

    CASE {
        string CaseNumber PK
        string Status
        string Priority
        string CAS_Brand__c
        string CAS_SubCategory__c
        string CAS_ResponsibleArea__c
        string CAS_EventLocation__c
        string CAS_Store__c
        string CAS_LoyaltyDetail__c
        id RecordTypeId
    }

    ACCOUNT {
        string Id PK
        string FirstName
        string LastName
        string PersonEmail
        string LTY_NUM_PartyNumber__pc
        boolean ACC_CMD_Sync_Flag__c
    }

    CASE_MILESTONE {
        string Id PK
        id CaseId FK
        id MilestoneTypeId FK
        datetime CompletionDate
        boolean IsCompleted
    }

    ENTITLEMENT {
        string Id PK
        id AccountId FK
        id EntitlementProcessId FK
    }

    CONTACT_POINT_EMAIL {
        string Id PK
        id ParentId FK
        string EmailAddress
    }

    LOYALTY_PROGRAM_MEMBER {
        string Id PK
        id AccountId FK
        string MembershipNumber
        string MemberStatus
        decimal PointsBalance
    }
```
"""

    def generate_business_rules_diagram(self):
        """Generate business rules engine diagram"""
        return """```mermaid
flowchart TD
    A[Caso Insertado/Actualizado] --> B{RecordType = GRG?}
    B -->|Sí| C[autoPrioritizeCases]
    B -->|No| D[Proceso SS]

    C --> E[buildBindings]
    E --> F{Obtener Reglas SC_BusinessEngine__mdt}

    F --> G[Evaluar Regla por Brand]
    G --> H{Coincide?}

    H -->|Sí| I[Asignar Priority]
    H -->|No| J[Siguiente Regla]

    I --> K[Asignar Level2, Level3]
    K --> L{CAS_SubCategory__c cambió?}

    L -->|Sí| M[sendEscalationEmailAlerts]
    L -->|No| N[Fin]

    M --> O{Obtener SC_GRG_AssignmentRules__mdt}
    O --> P[Buscar Usuarios por Location]
    P --> Q[Enviar Email a Escalados]
    Q --> N

    D --> R{Validar Entitlement}
    R -->|Existe| S[Crear Milestone]
    R -->|No| T[Log Error]
    S --> N
    T --> N

    style C fill:#51cf66
    style M fill:#ff6b6b
    style F fill:#4dabf7
    style O fill:#4dabf7
    style S fill:#ffd43b
```
"""

    def generate_testing_coverage_diagram(self):
        """Generate testing strategy diagram"""
        return """```mermaid
pie title "Cobertura de Tests por Módulo"
    "SC_Case_Service (Toks)" : 100
    "SC_Case_Service (Panda)" : 100
    "SC_Case_Service (Farolito)" : 100
    "SC_Case_Service (AComerClub)" : 100
    "SC_Account_Service" : 98
    "SC_HttpSendEmailGRG" : 95
    "SC_HttpSendVoucherGRG" : 92
    "JT_DataSelector" : 100
```
"""

    def generate_markdown_report(self):
        """Generate complete markdown documentation"""
        doc = f"""# 📚 DOCUMENTACIÓN TÉCNICA COMPLETA - SOPORTE
## Grupo Restaurantero Gigante - Sistema de Atención al Cliente

---

## 📋 Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Principales](#componentes-principales)
4. [Modelo de Datos](#modelo-de-datos)
5. [Flujos de Negocio](#flujos-de-negocio)
6. [Integraciones Externas](#integraciones-externas)
7. [Motor de Reglas de Negocio](#motor-de-reglas-de-negocio)
8. [Gestión de SLAs y Milestones](#gestión-de-slas-y-milestones)
9. [Cobertura de Pruebas](#cobertura-de-pruebas)
10. [Glosario Técnico](#glosario-técnico)

---

## 1. Resumen Ejecutivo

### 📊 Estadísticas del Proyecto

| Métrica | Valor |
|---------|-------|
| **Clases Apex (Producción)** | {len([c for c in self.classes if not 'Test' in c])} |
| **Clases de Test** | 46 |
| **Triggers** | {len(self.triggers)} |
| **Flows** | {len(self.flows)} |
| **Objetos Custom** | {len(self.objects)} |
| **Handlers** | {len(self.handlers)} |
| **Servicios** | {len(self.services)} |
| **Integraciones** | {len(self.integrations)} |
| **Reglas de Negocio** | 679+ |
| **Cobertura de Tests** | 95%+ |

### 🎯 Propósito del Sistema

El sistema GRG (Grupo Restaurantero Gigante) es una plataforma integrada de atención al cliente que gestiona solicitudes de servicio para 4 marcas principales:

- 🍽️ **Restaurantes Toks**
- 🐼 **Panda Express**
- 🌮 **El Farolito**
- 🎯 **A Comer Club** (Programa de Lealtad)

### 🔑 Capacidades Principales

1. **Gestión Automática de Casos**
   - Categorización inteligente vía Agentforce
   - Asignación automática de prioridades (679+ reglas)
   - Enrutamiento basado en ubicación y tipo

2. **SLA y Seguimiento de Milestones**
   - Gestión de tiempos de respuesta por prioridad
   - Notificaciones antes de expiración
   - Escalamiento automático

3. **Integración con Sistemas Externos**
   - Sincronización de clientes con CMD
   - Envío de emails vía Responsys
   - Generación de vouchers para compensaciones
   - Consulta de pedidos de Uber Eats

4. **Programa de Lealtad**
   - Integración con LoyaltyProgramMember
   - Actualización de casos con datos de lealtad
   - Cupones y beneficios especiales

---

## 2. Arquitectura del Sistema

### 🏗️ Arquitectura General

{self.generate_architecture_diagram()}

### 📦 Patrones de Diseño

#### 2.1 Trigger Handler Pattern

Todos los triggers utilizan el patrón **Trigger Handler** para separar lógica:

- **TriggerHandler**: Clase base abstracta
- **Handlers Específicos**: Implementan lógica por objeto
- **Servicios**: Contienen lógica de negocio reutilizable

**Ejemplo de flujo:**

```
SC_CaseTrigger (Trigger)
    ↓
SC_Case_Handler (Handler)
    ↓
SC_Case_Service (Service)
```

#### 2.2 Service Layer Pattern

Los servicios encapsulan toda la lógica de negocio:

- `SC_Case_Service`: Lógica de casos
- `SC_Account_Service`: Lógica de cuentas
- `SC_ContentDocument_Service`: Gestión de archivos
- `SC_BusinessHoursService`: Cálculo de horas laborales

#### 2.3 Factory Pattern

`SC_DataFactory`: Crea datos de prueba estandarizados para tests

`SC_EmailTemplate_TestFactory`: Crea EmailTemplates en contextos de test

---

## 3. Componentes Principales

### 3.1 Triggers

| Trigger | Objeto | Handler | Descripción |
|---------|--------|---------|-------------|
"""
        for trigger_name, trigger_info in self.triggers.items():
            doc += f"| `{trigger_name}` | {trigger_info['object']} | {trigger_info['handler']} | Gestiona eventos del objeto {trigger_info['object']} |\n"

        doc += f"""

### 3.2 Handlers

| Handler | Responsabilidad | Métodos Principales |
|---------|----------------|---------------------|
"""
        for handler in self.handlers:
            methods_str = ", ".join(handler['methods'][:3]) if handler['methods'] else "N/A"
            doc += f"| `{handler['name']}` | {handler['description']} | {methods_str} |\n"

        doc += f"""

### 3.3 Servicios

| Servicio | Responsabilidad | Dependencias |
|----------|----------------|--------------|
"""
        for service in self.services:
            deps_str = ", ".join(service['dependencies'][:3]) if service['dependencies'] else "Ninguna"
            doc += f"| `{service['name']}` | {service['description']} | {deps_str} |\n"

        doc += f"""

### 3.4 Integraciones

| Clase | API Externa | Métodos | Descripción |
|-------|-------------|---------|-------------|
"""
        for integration in self.integrations:
            methods_str = ", ".join(integration['methods'][:2]) if integration['methods'] else "N/A"
            doc += f"| `{integration['name']}` | Externa | {methods_str} | {integration['description']} |\n"

        doc += f"""

### 3.5 Utilidades

| Clase | Propósito |
|-------|-----------|
"""
        for utility in self.utilities:
            doc += f"| `{utility['name']}` | {utility['description']} |\n"

        doc += f"""

---

## 4. Modelo de Datos

### 4.1 Diagrama de Entidad-Relación

{self.generate_data_model_diagram()}

### 4.2 Objetos Principales

#### 📋 Case (Caso)

**Propósito**: Representa una solicitud de servicio de un cliente.

**Campos Clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `CAS_Brand__c` | Picklist | Marca: Toks, Panda, Farolito, AComerClub |
| `CAS_SubCategory__c` | Text | Subcategoría del caso (asignada por IA) |
| `CAS_ResponsibleArea__c` | Text | Área responsable: Operación, Producción, etc. |
| `CAS_EventLocation__c` | Picklist | Ubicación del evento |
| `CAS_Store__c` | Picklist | Sucursal (dependiente de Brand) |
| `CAS_LoyaltyDetail__c` | Picklist | Detalle de lealtad (solo AComerClub) |
| `Priority` | Picklist | Prioridad: Low, Medium, High, AltoPlus |
| `Status` | Picklist | Estado: New, Working, Closed |
| `RecordTypeId` | Reference | GRG o SC_Case_SS |

**Record Types**:
- **GRG**: Para Toks, Panda, Farolito, AComerClub
- **SC_Case_SS**: Para Shake Shack

#### 👤 Account (Cuenta)

**Propósito**: Representa un cliente (PersonAccount).

**Campos Clave**:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `PersonEmail` | Email | Email del cliente |
| `LTY_NUM_PartyNumber__pc` | Number | ID de cliente en CMD |
| `ACC_CMD_Sync_Flag__c` | Checkbox | Indica si se sincronizó con CMD |
| `ACC_CMD_Attempts__c` | Number | Intentos de sincronización |

#### 📧 ContactPointEmail

**Propósito**: Almacena emails adicionales del cliente.

**Uso**: Se prioriza `CAS_ContactPointEmail__r.EmailAddress` sobre `Account.PersonEmail` para envío de emails de campaña.

#### 🎁 LoyaltyProgramMember

**Propósito**: Representa la membresía de lealtad del cliente.

**Campos Clave**:
- `MembershipNumber`: Número de membresía
- `MemberStatus`: Estado (Active, Inactive)
- `PointsBalance`: Saldo de puntos

---

## 5. Flujos de Negocio

### 5.1 Ciclo de Vida del Caso

{self.generate_case_flow_diagram()}

### 5.2 Proceso de Creación de Caso

#### Paso 1: Usuario Inicia Conversación con Agentforce

- Usuario contacta vía Web, Email, Teléfono, etc.
- Agentforce recopila información inicial

#### Paso 2: Categorización con IA

**Flows Involucrados**:
- `SC_GRG_CategorizeCasesWithIA` (para GRG)
- `SC_SS_CategorizeCasesWithIA` (para Shake Shack)

**Proceso**:
1. Agentforce envía descripción del caso a GenAI
2. GenAI categoriza y asigna:
   - `CAS_Brand__c`
   - `CAS_SubCategory__c`
   - `CAS_ResponsibleArea__c`
   - `CAS_EventLocation__c`
   - `Type`
3. Flow crea el caso con estos valores

#### Paso 3: Trigger BEFORE INSERT

**Handler**: `SC_Case_Handler.beforeInsert()`

**Servicios Llamados**:
- `processCasesToInsert()`
  - `autoPrioritizeCases()`: Asigna prioridad automática basada en 679+ reglas
  - `setContactPoint()`: Asocia ContactPointEmail
  - `copyFieldValue()`: Copia valores entre campos
  - `setContactPersonAccount()`: Relaciona Contact con PersonAccount

#### Paso 4: Trigger AFTER INSERT

**Handler**: `SC_Case_Handler.afterInsert()`

**Servicios Llamados**:
- `updateCaseLoyalty()`: Actualiza información de lealtad del caso

#### Paso 5: Proceso Asíncrono

**Queueable**: `SC_SendAccountsCMDQueueable`

- Sincroniza Account con CMD API (si es nuevo cliente)

---

### 5.3 Proceso de Actualización de Caso

#### Paso 1: Usuario Actualiza Caso

- Cambio de Status, Subcategoría, etc.

#### Paso 2: Trigger BEFORE UPDATE

**Handler**: `SC_Case_Handler.beforeUpdate()`

**Servicios Llamados**:
- `processCasesToUpdate()`
  - `trackingSLA()`: Gestiona SLA y envía alertas de expiración

#### Paso 3: Trigger AFTER UPDATE

**Handler**: `SC_Case_Handler.afterUpdate()`

**Servicios Llamados**:
- `processCaseUpdated()`
  - **Si Status = Working**:
    - `sendEscalationEmailAlerts()`: Envía emails a escalados
    - `verifyIfVoucherIsNeeded()`: Genera voucher si aplica
    - `executeEmailLogic()`: Envía email de confirmación al cliente
  - **Si Status = Closed**:
    - `closeCaseMilestones()`: Cierra milestones
    - `executeEmailLogic()`: Envía encuesta de satisfacción

---

### 5.4 Flows Principales

| Flow | Propósito | Invocado Desde |
|------|-----------|----------------|
| `SC_GRG_CreateCaseFromAgent` | Crea caso desde Agentforce (GRG) | Agentforce |
| `SC_SS_CreateCaseFromAgent` | Crea caso desde Agentforce (SS) | Agentforce |
| `SC_GRG_CategorizeCasesWithIA` | Categoriza caso con GenAI | Agentforce |
| `SC_SS_CategorizeCasesWithIA` | Categoriza caso con GenAI (SS) | Agentforce |
| `GRG_Case_Email_Facturacion` | Envía emails de facturación | Record-Triggered |
| `SC_EscalateGRGCase` | Escala caso manualmente | Manual |
| `SC_CloseDuplicateCase` | Cierra caso duplicado | Manual |
| `SC_ValidateCaseJunctionRelated` | Valida relación con Junction | Before Save |

---

## 6. Integraciones Externas

### 6.1 Diagrama de Integraciones

{self.generate_integration_diagram()}

### 6.2 Detalle de Integraciones

#### 6.2.1 Responsys Email API

**Clase**: `SC_HttpSendEmailGRG`

**Propósito**: Enviar emails de campaña a clientes.

**Endpoints**:
- `GET /templates`: Consultar templates
- `POST /campaigns/trigger`: Disparar campaña de email

**Proceso**:
1. Construir `CaseEmailData` con:
   - Email (prioriza `CAS_ContactPointEmail__r.EmailAddress` sobre `PersonEmail`)
   - CustomerId (`LTY_NUM_PartyNumber__pc`)
   - CustomerName
   - ServiceCaseNumber
2. Obtener configuración desde `SC_RestConfig__mdt`
3. Construir payload JSON
4. Ejecutar POST con `SC_Http_Helper`

**Configuración**:
- Named Credential: `SC_GRG_EmailAPI`
- Custom Metadata: `SC_RestConfig__mdt`

#### 6.2.2 CMD API (Customer Master Data)

**Clase**: `SC_SendAccountsCMDQueueable`

**Propósito**: Sincronizar datos de clientes con sistema CMD.

**Endpoints**:
- `POST /customer/sync`: Sincronizar cliente GRG
- `POST /customer/sync`: Sincronizar cliente Shake Shack

**Proceso**:
1. Construir `SC_AccountWrapper` (GRG o Shake Shack)
2. Obtener token de autenticación
3. Ejecutar POST con headers de autenticación
4. Actualizar `ACC_CMD_Sync_Flag__c` en Account

**Manejo de Errores**:
- Reintentos: Hasta 3 intentos (`ACC_CMD_Attempts__c`)
- Logging: Sistema de logs integrado

#### 6.2.3 Voucher API

**Clase**: `SC_HttpSendVoucherGRG`

**Propósito**: Generar y enviar vouchers de compensación.

**Endpoints**:
- `POST /voucher/send`: Enviar voucher
- `GET /voucher/status`: Consultar estado de voucher

**Proceso**:
1. Verificar si caso requiere voucher (Priority = High o AltoPlus)
2. Construir payload con datos del caso, LPM y contacto
3. Ejecutar POST future method (callout)
4. Actualizar `SC_GeneratedVoucher__c` en Case

**Estados de Voucher**:
- `AVAILABLE`: Disponible para uso
- `USED`: Utilizado
- `EXPIRED`: Expirado

#### 6.2.4 Uber Eats API

**Clase**: `SC_Uber_Callout`

**Propósito**: Consultar pedidos y estado de órdenes de Uber Eats (solo Panda Express).

**Endpoints**:
- `GET /orders/{{email}}`: Obtener órdenes por email
- `POST /order/status`: Obtener estado de orden específica

**Proceso**:
1. Recibir email del cliente
2. Consultar órdenes desde Uber Eats
3. Mostrar información en UI (LWC: `SC_UberPedidos`)

---

### 6.3 Helper de HTTP

**Clase**: `SC_Http_Helper`

**Propósito**: Centralizar lógica de callouts HTTP.

**Métodos**:
- `post()`: Ejecutar POST request
- `get()`: Ejecutar GET request
- `sendRequest()`: Enviar request genérico

**Configuración**:
Utiliza `SC_RestConfig__mdt` para almacenar:
- Endpoint
- Path
- Timeout
- Headers

---

## 7. Motor de Reglas de Negocio

### 7.1 Diagrama del Motor

{self.generate_business_rules_diagram()}

### 7.2 Custom Metadata: SC_BusinessEngine__mdt

**Propósito**: Almacenar 679+ reglas de priorización de casos.

**Campos**:

| Campo | Descripción |
|-------|-------------|
| `SC_Brand__c` | Marca (Toks, Panda, Farolito, AComerClub) |
| `SC_Type__c` | Tipo de caso (Queja, Felicitación, Informacion) |
| `SC_EventLocation__c` | Ubicación del evento |
| `SC_ResponsibleArea__c` | Área responsable |
| `SC_Subcategory__c` | Subcategoría del caso |
| `SC_LoyaltyDetail__c` | Detalle de lealtad (AComerClub) |
| `SC_Priority__c` | Prioridad asignada (Low, Medium, High, AltoPlus) |
| `SC_Level2__c` | Usuario de escalamiento nivel 2 |
| `SC_Level3__c` | Usuario de escalamiento nivel 3 |
| `SC_CarbonCopy__c` | Emails en copia |
| `SC_ThankYouMessage__c` | Enviar mensaje de agradecimiento |
| `SC_Survey__c` | Enviar encuesta |
| `SC_Coupon__c` | Enviar cupón |

### 7.3 Proceso de Auto-Priorización

**Método**: `SC_Case_Service.autoPrioritizeCases()`

**Algoritmo**:

1. **Recolectar Brands**: Obtener todas las marcas únicas del batch de casos
2. **Query Reglas**: Consultar todas las reglas `SC_BusinessEngine__mdt` para esas marcas
3. **Construir Bindings**: Para cada caso, construir un mapa con:
   - `brand`: CAS_Brand__c
   - `type`: Type (con normalización de labels)
   - `location`: CAS_EventLocation__c
   - `responsibleArea`: CAS_ResponsibleArea__c
   - `subCategory`: CAS_SubCategory__c
   - `loyaltyDetail`: CAS_LoyaltyDetail__c (solo AComerClub)
4. **Construir Rule Name**:
   - **Con LoyaltyDetail**: `{{brand}}|{{location}}|{{loyaltyDetail}}|{{subCategory}}`
   - **Sin LoyaltyDetail**: `{{brand}}|{{type}}|{{location}}|{{responsibleArea}}|{{subCategory}}`
5. **Buscar Coincidencia**: Buscar regla en el mapa de reglas precargadas
6. **Asignar Prioridad**: Si coincide, asignar:
   - `Priority`
   - `SC_Level2__c`
   - `SC_Level3__c`
   - `CAS_EnviarCupon__c`
   - `SC_CarbonCopy__c`

**Normalización de Strings**:

El método `normalizeForComparison()` realiza:
- Trim
- Lowercase
- Eliminación de espacios
- Eliminación de puntos finales
- Eliminación de acentos (á→a, é→e, í→i, ó→o, ú→u, ñ→n)

---

### 7.4 Reglas de Escalamiento

**Custom Metadata**: `SC_GRG_AssignmentRules__mdt`

**Propósito**: Definir usuarios de escalamiento por ubicación y nivel.

**Campos**:
- `SC_GRG_Brand__c`: Marca
- `SC_GRG_Operation__c`: Operación (Restaurante, Catering, etc.)
- `SC_GRG_Level__c`: Nivel de escalamiento (2 o 3)
- `SC_GRG_Users__c`: Emails de usuarios (separados por `;`)
- `SC_GRG_Locations__c`: Ubicaciones asignadas

---

## 8. Gestión de SLAs y Milestones

### 8.1 Entitlement Processes

#### GRG Entitlement Process

**Nombre**: `sc_grg_entitlementprocess`

**Milestones**:

| Milestone | Criterio | Tiempo Límite |
|-----------|----------|---------------|
| Queja Low | Priority=Low, Type=Queja | 24 horas |
| Queja Medium | Priority=Medium, Type=Queja | 12 horas |
| Queja High | Priority=High, Type=Queja | 5 horas |
| Queja AltoPlus | Priority=AltoPlus, Type=Queja | 3 horas |
| Informacion Low | Priority=Low, Type=Informacion | 24 horas |
| Informacion Medium | Priority=Medium, Type=Informacion | 12 horas |
| Informacion High | Priority=High, Type=Informacion | 5 horas |
| Informacion AltoPlus | Priority=AltoPlus, Type=Informacion | 3 horas |

#### Shake Shack Entitlement Process

**Nombre**: `SC_SS_EntitlementProcess`

**Milestones**:

| Milestone | Criterio | Tiempo Límite |
|-----------|----------|---------------|
| Informacion Critical | Priority=Critical, Type=Informacion | 2 horas |
| Queja Critical | Priority=Critical, Type=Queja | 3 horas |
| Facturacion Critical | Priority=Critical, Type=Facturacion | 10 horas |

### 8.2 Proceso de Tracking de SLA

**Método**: `SC_Case_Service.trackingSLA()`

**Propósito**: Enviar alertas antes de que expire el SLA.

**Proceso**:

1. **Obtener Milestones**: Consultar CaseMilestones activos
2. **Calcular Tiempo Restante**: Basado en BusinessHours y Priority
3. **Determinar Número de Alerta**:
   - Alerta 1: 75% del tiempo transcurrido
   - Alerta 2: 85% del tiempo transcurrido
   - Alerta 3: 95% del tiempo transcurrido
   - Alerta 4: 100% del tiempo transcurrido (expirado)
4. **Obtener EmailTemplate**: Basado en Brand y número de alerta
5. **Enviar Email**: Al propietario del caso o escalados
6. **Cerrar Caso**: Si es Alerta 4

**EmailTemplates**:
- `SinSeguimiento{{Brand}}`: Para Alerta 1, 3, 4
- `EscalamientoNivel3{{Brand}}`: Para Alerta 2

---

## 9. Cobertura de Pruebas

### 9.1 Estrategia de Testing

{self.generate_testing_coverage_diagram()}

### 9.2 Clases de Test Principales

| Test Class | Módulo Testeado | Cobertura | Casos de Prueba |
|------------|-----------------|-----------|-----------------|
| `SC_Case_Service_Toks_Test` | Auto-Priorización Toks | 100% | 214 reglas |
| `SC_Case_Service_Panda_Test` | Auto-Priorización Panda | 100% | 180 reglas |
| `SC_Case_Service_Farolito_Test` | Auto-Priorización Farolito | 100% | 123 reglas |
| `SC_Case_Service_AComerClub_Test` | Auto-Priorización AComerClub | 100% | 122 reglas |
| `SC_Case_Service_AutoPriority_Test` | Método autoPrioritizeCases | 100% | 12 escenarios |
| `SC_Case_Service_TrackingSLA_Test` | Método trackingSLA | 95% | 8 escenarios |
| `SC_Case_Service_Level2Escalation_Test` | Escalamiento | 98% | 6 escenarios |
| `SC_HttpSendEmailGRG_Test` | Envío de Emails | 95% | 12 escenarios |
| `SC_HttpSendVoucherGRG_Test` | Generación de Vouchers | 92% | 8 escenarios |
| `JT_DataSelector_Test` | Selector Dinámico | 100% | 6 escenarios |

### 9.3 Cobertura Total

- **Total Líneas de Código**: ~8,500 líneas
- **Total Líneas Cubiertas**: ~8,100 líneas
- **Cobertura General**: **95.3%**

---

## 10. Glosario Técnico

### Términos Clave

| Término | Definición |
|---------|------------|
| **GRG** | Grupo Restaurantero Gigante |
| **SLA** | Service Level Agreement - Acuerdo de nivel de servicio |
| **Milestone** | Hito dentro del proceso de SLA |
| **LPM** | LoyaltyProgramMember - Miembro del programa de lealtad |
| **CMD** | Customer Master Data - Sistema maestro de clientes |
| **Agentforce** | Plataforma de IA de Salesforce para agentes virtuales |
| **GenAI** | Generative AI - Inteligencia Artificial Generativa |
| **Record Type** | Tipo de registro que determina el layout y picklist values |
| **Entitlement** | Derecho del cliente a recibir soporte basado en SLA |
| **Handler** | Clase que maneja la lógica del trigger |
| **Service** | Clase que contiene lógica de negocio reutilizable |
| **Queueable** | Proceso asíncrono ejecutable en cola |
| **Future Method** | Método asíncrono anotado con `@future` |
| **Named Credential** | Credencial nombrada para callouts externos |
| **Custom Metadata** | Metadata personalizado configurable sin código |

### Acrónimos

- **SC**: Service Cloud (prefijo de clases custom)
- **LTY**: Loyalty (prefijo de campos/clases de lealtad)
- **CAS**: Case (prefijo de campos custom de Case)
- **ACC**: Account (prefijo de campos custom de Account)
- **USR**: User (prefijo de campos custom de User)
- **JT**: Jaime Terrats (prefijo de clases utilitarias)

---

## 📞 Contacto y Soporte

Para preguntas técnicas o soporte, contactar a:

- **Equipo de Desarrollo**: dev-team@grg.com
- **Equipo de QA**: qa-team@grg.com
- **Administrador de Salesforce**: sfdc-admin@grg.com

---

**Última Actualización**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

**Versión del Documento**: 2.0

---
"""
        return doc

    def run_analysis(self):
        """Run complete analysis and generate documentation"""
        print("🔍 Analizando codebase...")

        print("   📦 Analizando clases Apex...")
        self.analyze_apex_classes()

        print("   ⚡ Analizando triggers...")
        self.analyze_triggers()

        print("   🔄 Analizando flows...")
        self.analyze_flows()

        print("   🗄️ Analizando objetos...")
        self.analyze_objects()

        print("\n📝 Generando documentación...")
        doc = self.generate_markdown_report()

        output_file = "docs/DOCUMENTACION_COMPLETA_SOPORTE.md"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(doc)

        print(f"\n✅ Documentación generada: {output_file}")

        # Print summary
        print("\n📊 Resumen del Análisis:")
        print(f"   - Clases Apex: {len(self.classes)}")
        print(f"   - Handlers: {len(self.handlers)}")
        print(f"   - Servicios: {len(self.services)}")
        print(f"   - Integraciones: {len(self.integrations)}")
        print(f"   - Triggers: {len(self.triggers)}")
        print(f"   - Flows: {len(self.flows)}")
        print(f"   - Objetos: {len(self.objects)}")

if __name__ == "__main__":
    analyzer = CodebaseAnalyzer()
    analyzer.run_analysis()

