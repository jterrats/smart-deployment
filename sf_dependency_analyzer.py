#!/usr/bin/env python3
"""
Salesforce Metadata Dependency Analyzer
Analiza dependencias entre componentes de Salesforce para ordenar despliegues en CI/CD
"""

import os
import xml.etree.ElementTree as ET
from collections import defaultdict, deque
from pathlib import Path
from typing import Dict, List, Set, Tuple
from datetime import datetime
import json
import argparse
import fnmatch


class MetadataType:
    """Tipos de metadata de Salesforce y sus prioridades de despliegue"""

    # Orden de despliegue (menor número = despliega primero)
    DEPLOY_ORDER = {
        # Tier 0: Global Configuration & Translations
        'GlobalValueSet': 1,
        'StandardValueSet': 1,
        'CustomLabels': 1,
        'Translations': 1,  # CLI usa "Translations" (plural)
        'StandardValueSetTranslation': 1,

        # Tier 1: Foundation (Objects & Configuration)
        'CustomObject': 2,
        'CustomSetting': 2,
        'DataCategoryGroup': 2,
        'CustomMetadata': 2,
        'CustomMetadataRecord': 2,  # Individual CMD records - Must deploy before tests run
        'CustomField': 3,
        'ObjectTranslation': 3,
        'RecordType': 4,
        'BusinessProcess': 4,
        'ValidationRule': 4,
        'WorkflowRule': 4,

        # Tier 2: Security Foundation & Org Settings
        'OrgSettings': 4,
        'CorsWhitelistOrigin': 4,
        'CspTrustedSite': 4,
        'Role': 4,
        'DelegateGroup': 5,
        'Group': 5,              # Groups pueden depender de Roles
        'CustomPermission': 4,
        'ExternalCredential': 4,
        'NamedCredential': 5,
        'DataSourceObject': 5,

        # Tier 3: Code & Resources
        'StaticResource': 5,
        'Document': 5,
        'ContentAsset': 5,
        'EmailTemplate': 6,
        'ApexClass': 6,
        'VisualforceComponent': 6,
        'VisualforcePage': 6,
        'LightningComponentBundle': 6,
        'AuraDefinitionBundle': 6,
        'ApexTrigger': 7,

        # Tier 4: Service Cloud Foundation
        'ServicePresenceStatus': 7,
        'PresenceUserConfig': 7,
        'Queue': 7,
        'ServiceChannel': 8,
        'QueueRoutingConfig': 8,
        'ChannelLayout': 8,

        # Tier 5: Business Logic & Automation
        'MilestoneType': 8,
        'EntitlementProcess': 8,

        # GenAI MUST deploy BEFORE Flows (Flows reference GenAI)
        'GenAiFunction': 8,
        'GenAiPromptTemplate': 8,
        'GenAiPlannerBundle': 8,

        # Flows deploy AFTER GenAI (may reference GenAI templates)
        'Flow': 9,
        'PathAssistant': 9,

        # Tier 6: UI & Experience
        'Layout': 10,
        'Bot': 10,
        'BotVersion': 10,
        'GenAiPlugin': 10,
        'FlexiPage': 11,
        'QuickAction': 11,
        'CompactLayout': 11,
        'ListView': 11,
        'WebLink': 11,
        'LightningApp': 11,       # Applications
        'SearchCustomization': 11,
        'CustomNotificationType': 11,  # CLI usa "CustomNotificationType"

        # Tier 7: Experience Cloud Base
        'BrandingSet': 12,
        'DigitalExperienceConfig': 12,
        'Site': 13,              # CustomSite - depende de VF, SR
        'DigitalExperience': 13, # Puede ser paralelo a Site
        'NetworkBranding': 13,
        'Network': 14,          # Depende de Site + DigitalExperience
        'EmbeddedServiceConfig': 15,
        'MessagingChannel': 15, # Depende de Queue + Bot + (usado en Site/Network)

        # Tier 8: Omni-Channel & Advanced
        'OmniSupervisorConfig': 16,

        # Tier 9: Security & Access (después de todo lo demás)
        'SharingRules': 17,     # Dependen de Roles, Groups
        'PermissionSet': 17,
        'MutingPermissionSet': 18,
        'PermissionSetGroup': 18,
        'Profile': 19,

        # Tier 10: Testing & Data
        'ApexTestSuite': 20,
        'DataPackageKitDefinition': 20,
        'DataPackageKitObject': 20,
    }


class DependencyNode:
    """Nodo en el grafo de dependencias"""

    def __init__(self, name: str, metadata_type: str, file_path: str):
        self.name = name
        self.metadata_type = metadata_type
        self.file_path = file_path
        self.dependencies: Set[str] = set()
        self.dependents: Set[str] = set()
        self.priority_boost: int = 0  # Para ajustar prioridad con heurísticas

    def __repr__(self):
        return f"{self.metadata_type}:{self.name}"


class SalesforceHeuristics:
    """Heurísticas inteligentes para inferir dependencias basadas en convenciones de Salesforce"""

    @staticmethod
    def infer_test_class_dependencies(class_name: str, all_classes: Set[str]) -> List[str]:
        """
        Infiere dependencias de clases test basándose en naming conventions.

        Ejemplos:
        - SC_Account_Service_Test → SC_Account_Service
        - AccountHandlerTest → AccountHandler
        - SC_MyClass_Mock → SC_MyClass (para mocks)
        """
        dependencies = []

        # Patrón 1: *_Test → *
        if class_name.endswith('_Test'):
            prod_class = class_name.replace('_Test', '')
            if prod_class in all_classes:
                dependencies.append(prod_class)

        # Patrón 2: *Test → *
        elif class_name.endswith('Test') and not class_name.endswith('_Test'):
            prod_class = class_name[:-4]  # Remover "Test"
            if prod_class in all_classes:
                dependencies.append(prod_class)

        # Patrón 3: *_Mock → * (mocks también son para testing)
        if '_Mock' in class_name:
            real_class = class_name.replace('_Mock', '')
            if real_class in all_classes:
                dependencies.append(real_class)

        return dependencies

    @staticmethod
    def infer_handler_service_dependencies(class_name: str, all_classes: Set[str]) -> List[str]:
        """
        Infiere que Handlers típicamente dependen de Services.

        Ejemplos:
        - SC_Account_Handler → SC_Account_Service
        - CaseHandler → CaseService
        """
        dependencies = []

        if class_name.endswith('_Handler'):
            service_class = class_name.replace('_Handler', '_Service')
            if service_class in all_classes:
                dependencies.append(service_class)
        elif class_name.endswith('Handler') and not class_name.endswith('_Handler'):
            # CaseHandler → CaseService
            base_name = class_name[:-7]  # Remover "Handler"
            service_class = f"{base_name}Service"
            if service_class in all_classes:
                dependencies.append(service_class)

        return dependencies

    @staticmethod
    def infer_trigger_handler_pattern(class_name: str, all_classes: Set[str]) -> List[str]:
        """
        Infiere dependencias para el patrón Trigger Handler Framework.

        Ejemplos:
        - SC_Account_Handler extends TriggerHandler
        - AccountTriggerHandler extends TriggerHandler
        """
        dependencies = []

        # Si termina en Handler y existe TriggerHandler, probablemente lo usa
        if ('Handler' in class_name and
            'TriggerHandler' in all_classes and
            class_name != 'TriggerHandler'):
            # Ya se detectará con 'extends', pero aseguramos prioridad
            pass

        return dependencies

    @staticmethod
    def infer_utility_dependencies(class_name: str, all_classes: Set[str]) -> List[str]:
        """
        Infiere que otras clases dependen de utilities comunes.

        Ejemplos:
        - SC_DataFactory (test utility)
        - SC_Http_Helper (callout utility)
        - TestDataFactory
        """
        dependencies = []

        # Las utility classes son típicamente dependencias, no dependientes
        # Este método identifica utilities para darles mayor prioridad
        utility_patterns = [
            'DataFactory',
            'TestFactory',
            'Helper',
            'Util',
            'Utility',
            'Constants',
            'Config'
        ]

        # No retorna dependencias, pero marca la clase como utility
        # (se usa en otro lugar para ajustar prioridad)

        return dependencies

    @staticmethod
    def is_utility_class(class_name: str) -> bool:
        """Determina si una clase es una utility class que debería tener alta prioridad"""
        utility_patterns = [
            'DataFactory',
            'TestFactory',
            'TestDataFactory',
            'Helper',
            'Util',
            'Utility',
            'Constants',
            'Config',
            'Wrapper'
        ]
        return any(pattern in class_name for pattern in utility_patterns)

    @staticmethod
    def is_test_class(class_name: str) -> bool:
        """Determina si una clase es una test class"""
        return class_name.endswith('Test') or class_name.endswith('_Test') or 'Mock' in class_name

    @staticmethod
    def infer_sobject_from_class_name(class_name: str) -> List[str]:
        """
        Infiere referencias a SObjects basándose en el nombre de la clase.

        Ejemplos:
        - SC_Account_Service → Account (SObject estándar)
        - SC_CustomObject_Handler → CustomObject__c
        - CaseService → Case
        """
        sobjects = []

        # Patrones comunes: SC_<SObject>_<Type>
        # Ej: SC_Account_Service → Account
        parts = class_name.split('_')

        common_sobjects = [
            'Account', 'Contact', 'Lead', 'Opportunity', 'Case',
            'Task', 'Event', 'Campaign', 'Product', 'Order',
            'User', 'ContentVersion', 'ContentDocument'
        ]

        for sobject in common_sobjects:
            if sobject in class_name:
                sobjects.append(sobject)

        return sobjects


class SalesforceDependencyAnalyzer:
    """Analizador de dependencias de metadata de Salesforce"""

    def __init__(self, project_path: str):
        self.project_path = Path(project_path)
        self.metadata_path = self.project_path / "force-app" / "main" / "default"
        self.nodes: Dict[str, DependencyNode] = {}
        self.dependency_graph = defaultdict(set)
        self.reverse_graph = defaultdict(set)
        self.forceignore_patterns = self._load_forceignore()

    def analyze(self):
        """Analiza todas las dependencias del proyecto"""
        print("🔍 Analizando metadata de Salesforce...")

        # Analizar diferentes tipos de metadata
        # Fase 0: Global Configuration & Translations
        self._analyze_global_value_sets()
        self._analyze_standard_value_sets()
        self._analyze_custom_labels()
        self._analyze_translations()
        self._analyze_standard_value_set_translations()

        # Fase 1: Foundation
        self._analyze_custom_objects()
        self._analyze_data_category_groups()
        self._analyze_custom_metadata()
        self._analyze_custom_metadata_records()
        self._analyze_custom_fields()
        self._analyze_object_translations()
        self._analyze_record_types()
        self._analyze_validation_rules()
        self._analyze_workflows()

        # Fase 2: Security & Configuration
        self._analyze_org_settings()
        self._analyze_cors_whitelist_origins()
        self._analyze_csp_trusted_sites()
        self._analyze_roles()
        self._analyze_delegate_groups()
        self._analyze_groups()
        self._analyze_custom_permissions()
        self._analyze_external_credentials()
        self._analyze_named_credentials()
        self._analyze_data_source_objects()

        # Fase 3: Code & Resources
        self._analyze_static_resources()
        self._analyze_documents()
        self._analyze_content_assets()
        self._analyze_email_templates()
        self._analyze_apex_classes()
        self._analyze_visualforce_components()
        self._analyze_visualforce_pages()
        self._analyze_aura_components()
        self._analyze_lwc()
        self._analyze_apex_triggers()

        # Fase 4: Service Cloud Foundation
        self._analyze_service_presence_statuses()
        self._analyze_presence_user_configs()
        self._analyze_queues()
        self._analyze_service_channels()
        self._analyze_queue_routing_configs()
        self._analyze_channel_layouts()

        # Fase 5: Business Logic & Automation
        self._analyze_milestone_types()
        self._analyze_entitlement_processes()
        self._analyze_global_value_sets()
        self._analyze_flows()
        self._analyze_gen_ai_functions()
        self._analyze_gen_ai_prompt_templates()
        self._analyze_gen_ai_planner_bundles()
        self._analyze_path_assistants()

        # Fase 6: UI & Experience
        self._analyze_layouts()
        self._analyze_compact_layouts()
        self._analyze_list_views()
        self._analyze_weblinks()
        self._analyze_business_processes()
        self._analyze_bots()
        self._analyze_bot_versions()
        self._analyze_gen_ai_plugins()
        self._analyze_flexipages()
        self._analyze_quick_actions()
        self._analyze_applications()
        self._analyze_search_customizations()
        self._analyze_notification_types()

        # Fase 7: Experience Cloud Base
        self._analyze_branding_sets()
        self._analyze_digital_experience_configs()
        self._analyze_sites()
        self._analyze_digital_experiences()
        self._analyze_network_branding()
        self._analyze_networks()
        self._analyze_embedded_service_configs()
        self._analyze_messaging_channels()

        # Fase 8: Omni-Channel & Advanced
        self._analyze_omni_supervisor_configs()

        # Fase 9: Security & Access
        self._analyze_sharing_rules()
        self._analyze_permission_sets()
        self._analyze_muting_permission_sets()
        self._analyze_permission_set_groups()
        self._analyze_profiles()

        # Fase 10: Testing & Data
        self._analyze_test_suites()
        self._analyze_data_package_kit_definitions()
        self._analyze_data_package_kit_objects()

        # Aplicar heurísticas inteligentes
        print("\n🧠 Aplicando heurísticas inteligentes...")
        self._apply_heuristics()

        print(f"✅ Análisis completo: {len(self.nodes)} componentes encontrados")

        # Post-analysis: Detectar gaps y generar sugerencias
        self.post_analysis_report()

    def _load_forceignore(self) -> List[str]:
        """Carga patrones del .forceignore"""
        forceignore_path = self.project_path / ".forceignore"
        patterns = []

        if forceignore_path.exists():
            with open(forceignore_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    # Ignorar comentarios y líneas vacías
                    if line and not line.startswith('#'):
                        patterns.append(line)

        return patterns

    def _is_ignored(self, file_path: Path) -> bool:
        """Verifica si un archivo debe ser ignorado según .forceignore"""
        # Obtener path relativo al proyecto
        try:
            rel_path = file_path.relative_to(self.project_path)
        except ValueError:
            return False

        rel_path_str = str(rel_path)

        for pattern in self.forceignore_patterns:
            # Convertir pattern estilo glob a fnmatch
            # **/ significa cualquier directorio
            if pattern.startswith('**/'):
                pattern = pattern[3:]

            # Verificar coincidencia en path o nombre de archivo
            if fnmatch.fnmatch(rel_path_str, f"*{pattern}*") or \
               fnmatch.fnmatch(file_path.name, pattern) or \
               fnmatch.fnmatch(rel_path_str, pattern) or \
               pattern in rel_path_str:
                return True

        return False

    def _get_node_id(self, metadata_type: str, name: str) -> str:
        """Genera un ID único para un nodo"""
        return f"{metadata_type}:{name}"

    def _add_node(self, metadata_type: str, name: str, file_path: str) -> DependencyNode:
        """Agrega un nodo al grafo"""
        path_obj = Path(file_path)

        # Verificar si está en .forceignore
        if self._is_ignored(path_obj):
            return None

        node_id = self._get_node_id(metadata_type, name)
        if node_id not in self.nodes:
            self.nodes[node_id] = DependencyNode(name, metadata_type, file_path)
        return self.nodes[node_id]

    def _add_dependency(self, from_type: str, from_name: str, to_type: str, to_name: str):
        """Agrega una dependencia entre dos nodos"""
        from_id = self._get_node_id(from_type, from_name)
        to_id = self._get_node_id(to_type, to_name)

        # Solo agregar dependencias si ambos nodos existen
        if from_id in self.nodes and to_id in self.nodes:
            self.dependency_graph[from_id].add(to_id)
            self.reverse_graph[to_id].add(from_id)

            self.nodes[from_id].dependencies.add(to_id)
            self.nodes[to_id].dependents.add(from_id)

    def _analyze_apex_classes(self):
        """Analiza clases Apex y detecta dependencias entre ellas y con otros componentes"""
        import re

        classes_path = self.metadata_path / "classes"
        if not classes_path.exists():
            return

        # Lista de clases Apex estándar de Salesforce que NO son dependencias del usuario
        standard_classes = {
            'Test', 'System', 'Database', 'Schema', 'Limits', 'UserInfo', 'Math', 'String',
            'Integer', 'Decimal', 'Double', 'Long', 'Boolean', 'Date', 'Datetime', 'Time',
            'List', 'Set', 'Map', 'Exception', 'HttpRequest', 'HttpResponse', 'Http',
            'RestContext', 'RestRequest', 'RestResponse', 'PageReference', 'ApexPages',
            'Messaging', 'Trigger', 'JSON', 'Blob', 'Pattern', 'Matcher', 'URL',
            'Crypto', 'EncodingUtil', 'Site', 'DomainParser', 'DomainCreator', 'Domain',
            'JT_DataSelector', 'Queueable', 'Schedulable', 'Batchable', 'Finalizer'
        }

        # Primera pasada: registrar todas las clases
        print("  🔎 Primera pasada: registrando todas las clases Apex...")
        all_classes = set()
        for cls_file in classes_path.glob("*.cls"):
            all_classes.add(cls_file.stem)
        print(f"  ✅ {len(all_classes)} clases encontradas")

        # Segunda pasada: analizar dependencias
        print("  🔎 Segunda pasada: analizando dependencias entre clases...")
        for cls_file in classes_path.glob("*.cls"):
            class_name = cls_file.stem
            self._add_node('ApexClass', class_name, str(cls_file))

            try:
                with open(cls_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                    # Remover comentarios para evitar falsos positivos
                    # Comentarios de línea
                    content = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
                    # Comentarios de bloque
                    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
                    # Strings (para evitar detectar clases en strings)
                    content = re.sub(r"'[^']*'", '', content)
                    content = re.sub(r'"[^"]*"', '', content)

                    dependencies_found = set()

                    # 1. DETECTAR HERENCIA (extends)
                    extends_pattern = r'\bextends\s+([A-Z]\w+)'
                    for match in re.finditer(extends_pattern, content):
                        parent_class = match.group(1)
                        if parent_class in all_classes and parent_class not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', parent_class)
                            dependencies_found.add(f"extends {parent_class}")

                    # 2. DETECTAR IMPLEMENTACIÓN DE INTERFACES (implements)
                    implements_pattern = r'\bimplements\s+([A-Z]\w+(?:\s*,\s*[A-Z]\w+)*)'
                    for match in re.finditer(implements_pattern, content):
                        interfaces = match.group(1).split(',')
                        for interface in interfaces:
                            interface = interface.strip()
                            if interface in all_classes and interface not in standard_classes:
                                self._add_dependency('ApexClass', class_name, 'ApexClass', interface)
                                dependencies_found.add(f"implements {interface}")

                    # 3. DETECTAR INSTANCIACIÓN DE CLASES (new ClassName())
                    new_pattern = r'\bnew\s+([A-Z]\w+)\s*\('
                    for match in re.finditer(new_pattern, content):
                        referenced_class = match.group(1)
                        if referenced_class in all_classes and referenced_class not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', referenced_class)
                            dependencies_found.add(f"new {referenced_class}")

                    # 4. DETECTAR LLAMADAS ESTÁTICAS (ClassName.method())
                    static_call_pattern = r'\b([A-Z]\w+)\s*\.\s*\w+\s*\('
                    for match in re.finditer(static_call_pattern, content):
                        referenced_class = match.group(1)
                        if referenced_class in all_classes and referenced_class not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', referenced_class)
                            dependencies_found.add(f"call {referenced_class}")

                    # 5. DETECTAR VARIABLES DE TIPO CLASE (ClassName variable)
                    # Patrón mejorado: buscar declaraciones de variables
                    variable_pattern = r'\b([A-Z]\w+)\s+\w+\s*[=;]'
                    for match in re.finditer(variable_pattern, content):
                        referenced_class = match.group(1)
                        if referenced_class in all_classes and referenced_class not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', referenced_class)
                            dependencies_found.add(f"var {referenced_class}")

                    # 6. DETECTAR REFERENCIAS A CUSTOM OBJECTS (__c)
                    custom_object_pattern = r'\b([A-Z]\w+__c)\b'
                    for match in re.finditer(custom_object_pattern, content):
                        obj_name = match.group(1)
                        # Ignorar objetos de managed packages
                        if not obj_name.startswith(('force__', 'sfdc__', 'sfdcInternalInt__')):
                            self._add_dependency('ApexClass', class_name, 'CustomObject', obj_name)

                    # 7. DETECTAR REFERENCIAS A CUSTOM METADATA (__mdt)
                    custom_metadata_pattern = r'\b([A-Z]\w+__mdt)\b'
                    for match in re.finditer(custom_metadata_pattern, content):
                        mdt_name = match.group(1).replace('__mdt', '')
                        self._add_dependency('ApexClass', class_name, 'CustomMetadata', mdt_name)

                    # 8. DETECTAR REFERENCIAS A CUSTOM SETTINGS (__c en Schema.SObjectType)
                    custom_setting_pattern = r'Schema\.SObjectType\.([A-Z]\w+__c)'
                    for match in re.finditer(custom_setting_pattern, content):
                        setting_name = match.group(1)
                        self._add_dependency('ApexClass', class_name, 'CustomSetting', setting_name)

                    # 9. DETECTAR INSTANCIACIÓN DINÁMICA (Type.forName)
                    dynamic_pattern = r'Type\.forName\s*\(\s*[\'"]([A-Z]\w+)[\'"]\s*\)'
                    for match in re.finditer(dynamic_pattern, content):
                        referenced_class = match.group(1)
                        if referenced_class in all_classes and referenced_class not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', referenced_class)
                            dependencies_found.add(f"dynamic {referenced_class}")

                    # 10. DETECTAR MÉTODOS RETORNANDO TIPO CLASE (return type)
                    # Ejemplo: public static SC_MyClass getHelper() { ... }
                    method_return_pattern = r'\b(?:public|private|protected|global)\s+(?:static\s+)?([A-Z]\w+)\s+\w+\s*\('
                    for match in re.finditer(method_return_pattern, content):
                        return_type = match.group(1)
                        if return_type in all_classes and return_type not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', return_type)
                            # No agregar a dependencies_found para evitar ruido

                    # 11. DETECTAR CASTING (typecast)
                    # Ejemplo: (SC_MyClass) obj
                    cast_pattern = r'\(\s*([A-Z]\w+)\s*\)'
                    for match in re.finditer(cast_pattern, content):
                        cast_type = match.group(1)
                        if cast_type in all_classes and cast_type not in standard_classes:
                            self._add_dependency('ApexClass', class_name, 'ApexClass', cast_type)
                            # No agregar a dependencies_found para evitar ruido

                    # Mostrar dependencias encontradas (solo clases Apex)
                    if dependencies_found:
                        print(f"    📎 {class_name} → {', '.join(sorted(dependencies_found)[:3])}{'...' if len(dependencies_found) > 3 else ''}")

            except Exception as e:
                print(f"⚠️  Error analizando {cls_file}: {e}")

    def _analyze_flows(self):
        """Analiza Flows y sus dependencias"""
        flows_path = self.metadata_path / "flows"
        if not flows_path.exists():
            return

        for flow_file in flows_path.glob("*.flow-meta.xml"):
            flow_name = flow_file.stem.replace('.flow-meta', '')
            self._add_node('Flow', flow_name, str(flow_file))

            try:
                tree = ET.parse(flow_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Buscar referencias a Apex classes y GenAI Prompt Templates
                for action_call in root.findall('.//sf:actionCalls', ns):
                    action_name_elem = action_call.find('sf:actionName', ns)
                    action_type_elem = action_call.find('sf:actionType', ns)

                    if action_name_elem is not None and action_name_elem.text:
                        action_name = action_name_elem.text
                        action_type = action_type_elem.text if action_type_elem is not None else None

                        # GenAI Prompt Template reference
                        if action_type == 'generatePromptResponse':
                            self._add_dependency('Flow', flow_name, 'GenAiPromptTemplate', action_name)
                        # Apex Class reference
                        elif not action_type or action_type in ['apex', 'apexClass']:
                            self._add_dependency('Flow', flow_name, 'ApexClass', action_name)

                # Buscar referencias a otros flows
                for subflow in root.findall('.//sf:flowName', ns):
                    subflow_name = subflow.text
                    if subflow_name:
                        self._add_dependency('Flow', flow_name, 'Flow', subflow_name)

            except Exception as e:
                print(f"⚠️  Error analizando flow {flow_file}: {e}")

    def _analyze_lwc(self):
        """Analiza Lightning Web Components y sus dependencias"""
        lwc_path = self.metadata_path / "lwc"
        if not lwc_path.exists():
            return

        for lwc_dir in lwc_path.iterdir():
            if lwc_dir.is_dir() and not lwc_dir.name.startswith('.'):
                lwc_name = lwc_dir.name

                # Buscar el archivo .js principal
                js_file = lwc_dir / f"{lwc_name}.js"
                if js_file.exists():
                    self._add_node('LightningComponentBundle', lwc_name, str(lwc_dir))

                    # Analizar el JS para detectar dependencias
                    try:
                        with open(js_file, 'r', encoding='utf-8') as f:
                            content = f.read()

                            import re

                            # Detectar imports de Apex
                            # Ejemplo: import myMethod from '@salesforce/apex/MyClass.myMethod';
                            apex_import_pattern = r"import\s+\w+\s+from\s+['\"]@salesforce/apex/([A-Z]\w+)\.\w+['\"]"
                            for match in re.finditer(apex_import_pattern, content):
                                apex_class = match.group(1)
                                self._add_dependency('LightningComponentBundle', lwc_name, 'ApexClass', apex_class)
                                print(f"    ⚡ LWC {lwc_name} → ApexClass {apex_class}")

                            # Detectar imports de otros LWCs
                            # Ejemplo: import MyComponent from 'c/myComponent';
                            lwc_import_pattern = r"import\s+\w+\s+from\s+['\"]c/(\w+)['\"]"
                            for match in re.finditer(lwc_import_pattern, content):
                                other_lwc = match.group(1)
                                self._add_dependency('LightningComponentBundle', lwc_name, 'LightningComponentBundle', other_lwc)

                            # Detectar referencias a Custom Objects en wire adapters
                            # Ejemplo: @wire(getRecord, { recordId: '$recordId', fields: ['Account.Name'] })
                            sobject_pattern = r"['\"]([\w]+__c)\.\w+['\"]"
                            for match in re.finditer(sobject_pattern, content):
                                sobject = match.group(1)
                                self._add_dependency('LightningComponentBundle', lwc_name, 'CustomObject', sobject)

                    except Exception as e:
                        print(f"⚠️  Error analizando LWC {lwc_dir}: {e}")

    def _analyze_permission_sets(self):
        """Analiza Permission Sets y sus dependencias"""
        ps_path = self.metadata_path / "permissionsets"
        if not ps_path.exists():
            return

        for ps_file in ps_path.glob("*.permissionset-meta.xml"):
            ps_name = ps_file.stem.replace('.permissionset-meta', '')

            # Skip managed package components
            if ps_name.startswith('force__') or ps_name.startswith('sfdc__') or ps_name.startswith('sfdcInternalInt__'):
                continue

            self._add_node('PermissionSet', ps_name, str(ps_file))

            try:
                tree = ET.parse(ps_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Buscar accesos a Apex classes
                for apex in root.findall('.//sf:apexClass', ns):
                    apex_name = apex.text
                    if apex_name:
                        self._add_dependency('PermissionSet', ps_name, 'ApexClass', apex_name)

                # Buscar accesos a Flows
                for flow in root.findall('.//sf:flow', ns):
                    flow_name = flow.text
                    if flow_name:
                        self._add_dependency('PermissionSet', ps_name, 'Flow', flow_name)

                # Buscar accesos a Custom Objects
                for obj in root.findall('.//sf:object', ns):
                    obj_name = obj.text
                    if obj_name and obj_name.endswith('__c'):
                        self._add_dependency('PermissionSet', ps_name, 'CustomObject', obj_name)

                # Buscar accesos a Custom Permissions
                for perm in root.findall('.//sf:customPermissions/sf:name', ns):
                    perm_name = perm.text
                    if perm_name:
                        self._add_dependency('PermissionSet', ps_name, 'CustomPermission', perm_name)

            except Exception as e:
                print(f"⚠️  Error analizando permission set {ps_file}: {e}")

    def _analyze_permission_set_groups(self):
        """Analiza Permission Set Groups y sus dependencias"""
        psg_path = self.metadata_path / "permissionsetgroups"
        if not psg_path.exists():
            return

        for psg_file in psg_path.glob("*.permissionsetgroup-meta.xml"):
            psg_name = psg_file.stem.replace('.permissionsetgroup-meta', '')

            # Skip managed package components (force__, etc.)
            if psg_name.startswith('force__') or psg_name.startswith('sfdc__'):
                continue

            self._add_node('PermissionSetGroup', psg_name, str(psg_file))

            try:
                tree = ET.parse(psg_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Buscar permission sets incluidos
                for ps in root.findall('.//sf:permissionSets', ns):
                    ps_name = ps.text
                    if ps_name:
                        self._add_dependency('PermissionSetGroup', psg_name, 'PermissionSet', ps_name)

            except Exception as e:
                print(f"⚠️  Error analizando permission set group {psg_file}: {e}")

    def _analyze_custom_objects(self):
        """Analiza Custom Objects (excluyendo Custom Metadata Types)"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        # Buscar archivos de objeto
        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                # Excluir Custom Metadata Types (__mdt) - se analizan por separado
                if obj_dir.name.endswith('__mdt'):
                    continue

                obj_file = obj_dir / f"{obj_dir.name}.object-meta.xml"
                if obj_file.exists():
                    self._add_node('CustomObject', obj_dir.name, str(obj_file))

    def _analyze_custom_metadata(self):
        """Analiza Custom Metadata Types y sus dependencias"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir() and obj_dir.name.endswith('__mdt'):
                metadata_name = obj_dir.name
                obj_file = obj_dir / f"{metadata_name}.object-meta.xml"
                if obj_file.exists():
                    self._add_node('CustomMetadata', metadata_name, str(obj_file))

    def _analyze_custom_fields(self):
        """Analiza Custom Fields y sus dependencias"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                fields_dir = obj_dir / "fields"
                if fields_dir.exists():
                    for field_file in fields_dir.glob("*.field-meta.xml"):
                        field_name = field_file.stem.replace('.field-meta', '')
                        full_field_name = f"{obj_name}.{field_name}"
                        self._add_node('CustomField', full_field_name, str(field_file))

                        # Dependencia al objeto padre
                        self._add_dependency('CustomField', full_field_name, 'CustomObject', obj_name)

    def _analyze_record_types(self):
        """Analiza Record Types y sus dependencias"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                rt_dir = obj_dir / "recordTypes"
                if rt_dir.exists():
                    for rt_file in rt_dir.glob("*.recordType-meta.xml"):
                        rt_name = rt_file.stem.replace('.recordType-meta', '')
                        full_rt_name = f"{obj_name}.{rt_name}"
                        self._add_node('RecordType', full_rt_name, str(rt_file))

                        # Dependencia al objeto padre
                        self._add_dependency('RecordType', full_rt_name, 'CustomObject', obj_name)

    def _analyze_validation_rules(self):
        """Analiza Validation Rules y sus dependencias"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                vr_dir = obj_dir / "validationRules"
                if vr_dir.exists():
                    for vr_file in vr_dir.glob("*.validationRule-meta.xml"):
                        vr_name = vr_file.stem.replace('.validationRule-meta', '')
                        full_vr_name = f"{obj_name}.{vr_name}"
                        self._add_node('ValidationRule', full_vr_name, str(vr_file))

                        # Dependencia al objeto padre
                        self._add_dependency('ValidationRule', full_vr_name, 'CustomObject', obj_name)

    def _analyze_apex_triggers(self):
        """Analiza Apex Triggers y sus dependencias"""
        triggers_path = self.metadata_path / "triggers"
        if not triggers_path.exists():
            return

        import re

        for trigger_file in triggers_path.glob("*.trigger"):
            trigger_name = trigger_file.stem
            self._add_node('ApexTrigger', trigger_name, str(trigger_file))

            try:
                with open(trigger_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                    # Detectar el objeto del trigger
                    # Patrón: trigger MyTrigger on Account (before insert) {
                    trigger_pattern = r'trigger\s+\w+\s+on\s+(\w+)\s*\('
                    match = re.search(trigger_pattern, content)
                    if match:
                        sobject = match.group(1)
                        if sobject.endswith('__c'):
                            self._add_dependency('ApexTrigger', trigger_name, 'CustomObject', sobject)

                    # Detectar handler class
                    # Patrón común: new TriggerHandler()
                    handler_pattern = r'new\s+([A-Z]\w*Handler)\s*\('
                    for match in re.finditer(handler_pattern, content):
                        handler_class = match.group(1)
                        self._add_dependency('ApexTrigger', trigger_name, 'ApexClass', handler_class)
                        print(f"    🔫 Trigger {trigger_name} → Handler {handler_class}")

            except Exception as e:
                print(f"⚠️  Error analizando trigger {trigger_file}: {e}")

    def _analyze_visualforce_pages(self):
        """Analiza Visualforce Pages y sus dependencias"""
        pages_path = self.metadata_path / "pages"
        if not pages_path.exists():
            return

        import re

        for page_file in pages_path.glob("*.page"):
            page_name = page_file.stem
            self._add_node('VisualforcePage', page_name, str(page_file))

            try:
                with open(page_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                    # Detectar controller o extensions
                    # <apex:page controller="MyController">
                    controller_pattern = r'controller="([A-Z]\w+)"'
                    for match in re.finditer(controller_pattern, content):
                        controller = match.group(1)
                        self._add_dependency('VisualforcePage', page_name, 'ApexClass', controller)
                        print(f"    📄 VF Page {page_name} → Apex {controller}")

                    # <apex:page extensions="MyExtension,OtherExtension">
                    extensions_pattern = r'extensions="([^"]+)"'
                    match = re.search(extensions_pattern, content)
                    if match:
                        extensions = match.group(1).split(',')
                        for ext in extensions:
                            ext = ext.strip()
                            self._add_dependency('VisualforcePage', page_name, 'ApexClass', ext)
                            print(f"    📄 VF Page {page_name} → Apex {ext}")

                    # Detectar componentes VF usados
                    # <c:MyComponent />
                    component_pattern = r'<c:(\w+)'
                    for match in re.finditer(component_pattern, content):
                        component = match.group(1)
                        self._add_dependency('VisualforcePage', page_name, 'VisualforceComponent', component)

            except Exception as e:
                print(f"⚠️  Error analizando VF page {page_file}: {e}")

    def _analyze_visualforce_components(self):
        """Analiza Visualforce Components y sus dependencias"""
        components_path = self.metadata_path / "components"
        if not components_path.exists():
            return

        import re

        for component_file in components_path.glob("*.component"):
            component_name = component_file.stem
            self._add_node('VisualforceComponent', component_name, str(component_file))

            try:
                with open(component_file, 'r', encoding='utf-8') as f:
                    content = f.read()

                    # Detectar controller
                    controller_pattern = r'controller="([A-Z]\w+)"'
                    for match in re.finditer(controller_pattern, content):
                        controller = match.group(1)
                        self._add_dependency('VisualforceComponent', component_name, 'ApexClass', controller)

            except Exception as e:
                print(f"⚠️  Error analizando VF component {component_file}: {e}")

    def _analyze_email_templates(self):
        """Analiza Email Templates y sus dependencias"""
        email_path = self.metadata_path / "email"
        if not email_path.exists():
            return

        for folder_dir in email_path.iterdir():
            if folder_dir.is_dir():
                for email_file in folder_dir.glob("*.email-meta.xml"):
                    email_name = f"{folder_dir.name}/{email_file.stem.replace('.email-meta', '')}"
                    self._add_node('EmailTemplate', email_name, str(email_file))

    def _analyze_custom_permissions(self):
        """Analiza Custom Permissions"""
        perms_path = self.metadata_path / "customPermissions"
        if not perms_path.exists():
            return

        for perm_file in perms_path.glob("*.customPermission-meta.xml"):
            perm_name = perm_file.stem.replace('.customPermission-meta', '')
            self._add_node('CustomPermission', perm_name, str(perm_file))

    def _analyze_named_credentials(self):
        """Analiza Named Credentials y sus dependencias"""
        nc_path = self.metadata_path / "namedCredentials"
        if not nc_path.exists():
            return

        for nc_file in nc_path.glob("*.namedCredential-meta.xml"):
            nc_name = nc_file.stem.replace('.namedCredential-meta', '')
            self._add_node('NamedCredential', nc_name, str(nc_file))

            try:
                tree = ET.parse(nc_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar external credential
                for ext_cred in root.findall('.//sf:externalCredential', ns):
                    ext_cred_name = ext_cred.text
                    if ext_cred_name:
                        self._add_dependency('NamedCredential', nc_name, 'ExternalCredential', ext_cred_name)

            except Exception as e:
                print(f"⚠️  Error analizando named credential {nc_file}: {e}")

    def _analyze_external_credentials(self):
        """Analiza External Credentials"""
        ec_path = self.metadata_path / "externalCredentials"
        if not ec_path.exists():
            return

        for ec_file in ec_path.glob("*.externalCredential-meta.xml"):
            ec_name = ec_file.stem.replace('.externalCredential-meta', '')
            self._add_node('ExternalCredential', ec_name, str(ec_file))

    def _analyze_queues(self):
        """Analiza Queues"""
        queues_path = self.metadata_path / "queues"
        if not queues_path.exists():
            return

        for queue_file in queues_path.glob("*.queue-meta.xml"):
            queue_name = queue_file.stem.replace('.queue-meta', '')
            self._add_node('Queue', queue_name, str(queue_file))

    def _analyze_static_resources(self):
        """Analiza Static Resources"""
        sr_path = self.metadata_path / "staticresources"
        if not sr_path.exists():
            return

        for sr_file in sr_path.glob("*.resource-meta.xml"):
            sr_name = sr_file.stem.replace('.resource-meta', '')
            self._add_node('StaticResource', sr_name, str(sr_file))

    def _analyze_roles(self):
        """Analiza Roles y su jerarquía"""
        roles_path = self.metadata_path / "roles"
        if not roles_path.exists():
            return

        for role_file in roles_path.glob("*.role-meta.xml"):
            role_name = role_file.stem.replace('.role-meta', '')
            self._add_node('Role', role_name, str(role_file))

            try:
                tree = ET.parse(role_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar parent role (jerarquía)
                for parent in root.findall('.//sf:parentRole', ns):
                    parent_role = parent.text
                    if parent_role:
                        self._add_dependency('Role', role_name, 'Role', parent_role)
                        print(f"    👥 Role {role_name} → Parent Role {parent_role}")

            except Exception as e:
                print(f"⚠️  Error analizando role {role_file}: {e}")

    def _analyze_groups(self):
        """Analiza Groups y sus dependencias"""
        groups_path = self.metadata_path / "groups"
        if not groups_path.exists():
            return

        for group_file in groups_path.glob("*.group-meta.xml"):
            group_name = group_file.stem.replace('.group-meta', '')
            self._add_node('Group', group_name, str(group_file))

            try:
                tree = ET.parse(group_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar roles relacionados
                for role in root.findall('.//sf:role', ns):
                    role_name = role.text
                    if role_name:
                        self._add_dependency('Group', group_name, 'Role', role_name)

            except Exception as e:
                print(f"⚠️  Error analizando group {group_file}: {e}")

    def _analyze_sharing_rules(self):
        """Analiza Sharing Rules y sus dependencias"""
        sr_path = self.metadata_path / "sharingRules"
        if not sr_path.exists():
            return

        for sr_file in sr_path.glob("*.sharingRules-meta.xml"):
            obj_name = sr_file.stem.replace('.sharingRules-meta', '')
            # En package.xml, SharingRules se referencian solo por el nombre del objeto
            self._add_node('SharingRules', obj_name, str(sr_file))

            # Dependencia al objeto
            self._add_dependency('SharingRules', obj_name, 'CustomObject', obj_name)

            try:
                tree = ET.parse(sr_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar grupos y roles usados
                for group in root.findall('.//sf:sharedTo/sf:group', ns):
                    group_name = group.text
                    if group_name:
                        self._add_dependency('SharingRules', sr_name, 'Group', group_name)

                for role in root.findall('.//sf:sharedTo/sf:role', ns):
                    role_name = role.text
                    if role_name:
                        self._add_dependency('SharingRules', sr_name, 'Role', role_name)

            except Exception as e:
                print(f"⚠️  Error analizando sharing rules {sr_file}: {e}")

    def _analyze_quick_actions(self):
        """Analiza Quick Actions y sus dependencias"""
        qa_path = self.metadata_path / "quickActions"
        if not qa_path.exists():
            return

        for qa_file in qa_path.glob("*.quickAction-meta.xml"):
            qa_name = qa_file.stem.replace('.quickAction-meta', '')
            self._add_node('QuickAction', qa_name, str(qa_file))

            try:
                tree = ET.parse(qa_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar target object
                for target_obj in root.findall('.//sf:targetObject', ns):
                    obj_name = target_obj.text
                    if obj_name and obj_name.endswith('__c'):
                        self._add_dependency('QuickAction', qa_name, 'CustomObject', obj_name)

                # Detectar Apex controller
                for controller in root.findall('.//sf:standardController', ns):
                    controller_name = controller.text
                    # StandardController no es custom, skip

                # Detectar lightningComponent
                for lwc in root.findall('.//sf:lightningComponent', ns):
                    lwc_name = lwc.text
                    if lwc_name:
                        # Puede ser namespace:component o c:component
                        if ':' in lwc_name:
                            ns_prefix, comp_name = lwc_name.split(':', 1)
                            if ns_prefix == 'c':
                                self._add_dependency('QuickAction', qa_name, 'LightningComponentBundle', comp_name)

                # Detectar flow
                for flow in root.findall('.//sf:flowDefinition', ns):
                    flow_name = flow.text
                    if flow_name:
                        self._add_dependency('QuickAction', qa_name, 'Flow', flow_name)

            except Exception as e:
                print(f"⚠️  Error analizando quick action {qa_file}: {e}")

    def _analyze_applications(self):
        """Analiza Lightning Applications"""
        apps_path = self.metadata_path / "applications"
        if not apps_path.exists():
            return

        for app_file in apps_path.glob("*.app-meta.xml"):
            app_name = app_file.stem.replace('.app-meta', '')
            self._add_node('LightningApp', app_name, str(app_file))

            try:
                tree = ET.parse(app_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar tabs
                for tab in root.findall('.//sf:tabs', ns):
                    tab_name = tab.text
                    # Tabs son metadata implícito, no los rastreamos

            except Exception as e:
                print(f"⚠️  Error analizando application {app_file}: {e}")

    def _analyze_aura_components(self):
        """Analiza Aura Components y sus dependencias"""
        aura_path = self.metadata_path / "aura"
        if not aura_path.exists():
            return

        for aura_dir in aura_path.iterdir():
            if aura_dir.is_dir():
                aura_name = aura_dir.name
                aura_file = aura_dir / f"{aura_name}.cmp-meta.xml"

                if not aura_file.exists():
                    aura_file = aura_dir / f"{aura_name}.app-meta.xml"

                if aura_file.exists():
                    self._add_node('AuraDefinitionBundle', aura_name, str(aura_dir))

                    # Analizar controller.js para detectar Apex
                    controller_file = aura_dir / f"{aura_name}Controller.js"
                    if controller_file.exists():
                        try:
                            import re
                            with open(controller_file, 'r', encoding='utf-8') as f:
                                content = f.read()

                                # Detectar llamadas Apex: c.myApexMethod, action.setCallback
                                apex_pattern = r'action\s*=\s*component\.get\s*\(\s*["\']c\.(\w+)["\']'
                                for match in re.finditer(apex_pattern, content):
                                    method_name = match.group(1)
                                    # No podemos determinar la clase sin más contexto
                                    pass

                        except Exception as e:
                            pass

    def _analyze_workflows(self):
        """Analiza Workflow Rules y sus dependencias"""
        wf_path = self.metadata_path / "workflows"
        if not wf_path.exists():
            return

        for wf_file in wf_path.glob("*.workflow-meta.xml"):
            obj_name = wf_file.stem.replace('.workflow-meta', '')
            # En package.xml, Workflow se referencia solo por el nombre del objeto
            self._add_node('WorkflowRule', obj_name, str(wf_file))

            # Dependencia al objeto
            self._add_dependency('WorkflowRule', obj_name, 'CustomObject', obj_name)

    def _analyze_global_value_sets(self):
        """Analiza Global Value Sets"""
        gvs_path = self.metadata_path / "globalValueSets"
        if not gvs_path.exists():
            return

        for gvs_file in gvs_path.glob("*.globalValueSet-meta.xml"):
            gvs_name = gvs_file.stem.replace('.globalValueSet-meta', '')
            self._add_node('GlobalValueSet', gvs_name, str(gvs_file))

    def _analyze_custom_metadata_records(self):
        """Analiza Custom Metadata Records (archivos .md-meta.xml)"""
        cmd_path = self.metadata_path / "customMetadata"
        if not cmd_path.exists():
            return

        for cmd_file in cmd_path.glob("*.md-meta.xml"):
            record_name = cmd_file.stem.replace('.md-meta', '')
            self._add_node('CustomMetadataRecord', record_name, str(cmd_file))

            # Determinar el tipo de CMD del nombre (formato: TypeName.RecordName)
            if '.' in record_name:
                cmd_type, _ = record_name.split('.', 1)
                # Dependencia al tipo de Custom Metadata
                self._add_dependency('CustomMetadataRecord', record_name, 'CustomMetadata', f"{cmd_type}__mdt")

    def _analyze_branding_sets(self):
        """Analiza Branding Sets para Experience Cloud"""
        bs_path = self.metadata_path / "brandingSets"
        if not bs_path.exists():
            return

        for bs_file in bs_path.glob("*.brandingSet-meta.xml"):
            bs_name = bs_file.stem.replace('.brandingSet-meta', '')
            self._add_node('BrandingSet', bs_name, str(bs_file))

    def _analyze_network_branding(self):
        """Analiza Network Branding"""
        nb_path = self.metadata_path / "networkBranding"
        if not nb_path.exists():
            return

        for nb_file in nb_path.glob("*.networkBranding-meta.xml"):
            nb_name = nb_file.stem.replace('.networkBranding-meta', '')
            self._add_node('NetworkBranding', nb_name, str(nb_file))

    def _analyze_digital_experience_configs(self):
        """Analiza Digital Experience Configs"""
        dec_path = self.metadata_path / "digitalExperienceConfigs"
        if not dec_path.exists():
            return

        for dec_file in dec_path.glob("*.digitalExperienceConfig-meta.xml"):
            dec_name = dec_file.stem.replace('.digitalExperienceConfig-meta', '')
            self._add_node('DigitalExperienceConfig', dec_name, str(dec_file))

    def _analyze_embedded_service_configs(self):
        """Analiza Embedded Service Configs"""
        esc_path = self.metadata_path / "EmbeddedServiceConfig"
        if not esc_path.exists():
            return

        for esc_file in esc_path.glob("*.EmbeddedServiceConfig-meta.xml"):
            esc_name = esc_file.stem.replace('.EmbeddedServiceConfig-meta', '')
            self._add_node('EmbeddedServiceConfig', esc_name, str(esc_file))

            try:
                tree = ET.parse(esc_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar site relacionado
                for site in root.findall('.//sf:site', ns):
                    site_name = site.text
                    if site_name:
                        self._add_dependency('EmbeddedServiceConfig', esc_name, 'Site', site_name)

            except Exception as e:
                pass

    def _analyze_channel_layouts(self):
        """Analiza Channel Layouts para Omni-Channel"""
        cl_path = self.metadata_path / "channelLayouts"
        if not cl_path.exists():
            return

        for cl_file in cl_path.glob("*.channelLayout-meta.xml"):
            cl_name = cl_file.stem.replace('.channelLayout-meta', '')
            self._add_node('ChannelLayout', cl_name, str(cl_file))

    def _analyze_queue_routing_configs(self):
        """Analiza Queue Routing Configs"""
        qrc_path = self.metadata_path / "queueRoutingConfigs"
        if not qrc_path.exists():
            return

        for qrc_file in qrc_path.glob("*.queueRoutingConfig-meta.xml"):
            qrc_name = qrc_file.stem.replace('.queueRoutingConfig-meta', '')
            self._add_node('QueueRoutingConfig', qrc_name, str(qrc_file))

            try:
                tree = ET.parse(qrc_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar queues relacionadas
                for queue in root.findall('.//sf:queueId', ns):
                    queue_name = queue.text
                    if queue_name:
                        self._add_dependency('QueueRoutingConfig', qrc_name, 'Queue', queue_name)

            except Exception as e:
                pass

    def _analyze_service_channels(self):
        """Analiza Service Channels"""
        sc_path = self.metadata_path / "serviceChannels"
        if not sc_path.exists():
            return

        for sc_file in sc_path.glob("*.serviceChannel-meta.xml"):
            sc_name = sc_file.stem.replace('.serviceChannel-meta', '')
            self._add_node('ServiceChannel', sc_name, str(sc_file))

    def _analyze_service_presence_statuses(self):
        """Analiza Service Presence Statuses"""
        sps_path = self.metadata_path / "servicePresenceStatuses"
        if not sps_path.exists():
            return

        for sps_file in sps_path.glob("*.servicePresenceStatus-meta.xml"):
            sps_name = sps_file.stem.replace('.servicePresenceStatus-meta', '')
            self._add_node('ServicePresenceStatus', sps_name, str(sps_file))

    def _analyze_omni_supervisor_configs(self):
        """Analiza Omni Supervisor Configs"""
        osc_path = self.metadata_path / "omniSupervisorConfigs"
        if not osc_path.exists():
            return

        for osc_file in osc_path.glob("*.omniSupervisorConfig-meta.xml"):
            osc_name = osc_file.stem.replace('.omniSupervisorConfig-meta', '')
            self._add_node('OmniSupervisorConfig', osc_name, str(osc_file))

    def _analyze_entitlement_processes(self):
        """Analiza Entitlement Processes"""
        ep_path = self.metadata_path / "entitlementProcesses"
        if not ep_path.exists():
            return

        for ep_file in ep_path.glob("*.entitlementProcess-meta.xml"):
            ep_name = ep_file.stem.replace('.entitlementProcess-meta', '')
            self._add_node('EntitlementProcess', ep_name, str(ep_file))

    def _analyze_global_value_sets(self):
        """Analiza Global Value Sets"""
        gvs_path = self.metadata_path / "globalValueSets"
        if not gvs_path.exists():
            return

        for gvs_file in gvs_path.glob("*.globalValueSet-meta.xml"):
            gvs_name = gvs_file.stem.replace('.globalValueSet-meta', '')
            self._add_node('GlobalValueSet', gvs_name, str(gvs_file))

            try:
                tree = ET.parse(ep_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar milestones
                for milestone in root.findall('.//sf:milestoneType', ns):
                    milestone_name = milestone.text
                    if milestone_name:
                        self._add_dependency('EntitlementProcess', ep_name, 'MilestoneType', milestone_name)

            except Exception as e:
                pass

    def _analyze_milestone_types(self):
        """Analiza Milestone Types"""
        mt_path = self.metadata_path / "milestoneTypes"
        if not mt_path.exists():
            return

        for mt_file in mt_path.glob("*.milestoneType-meta.xml"):
            mt_name = mt_file.stem.replace('.milestoneType-meta', '')
            self._add_node('MilestoneType', mt_name, str(mt_file))

    def _analyze_path_assistants(self):
        """Analiza Path Assistants"""
        pa_path = self.metadata_path / "pathAssistants"
        if not pa_path.exists():
            return

        for pa_file in pa_path.glob("*.pathAssistant-meta.xml"):
            pa_name = pa_file.stem.replace('.pathAssistant-meta', '')
            self._add_node('PathAssistant', pa_name, str(pa_file))

    def _analyze_presence_user_configs(self):
        """Analiza Presence User Configs"""
        puc_path = self.metadata_path / "presenceUserConfigs"
        if not puc_path.exists():
            return

        for puc_file in puc_path.glob("*.presenceUserConfig-meta.xml"):
            puc_name = puc_file.stem.replace('.presenceUserConfig-meta', '')
            self._add_node('PresenceUserConfig', puc_name, str(puc_file))

    def _analyze_data_category_groups(self):
        """Analiza Data Category Groups para Knowledge"""
        dcg_path = self.metadata_path / "datacategorygroups"
        if not dcg_path.exists():
            return

        for dcg_file in dcg_path.glob("*.datacategorygroup-meta.xml"):
            dcg_name = dcg_file.stem.replace('.datacategorygroup-meta', '')
            self._add_node('DataCategoryGroup', dcg_name, str(dcg_file))

    def _analyze_muting_permission_sets(self):
        """Analiza Muting Permission Sets"""
        mps_path = self.metadata_path / "mutingpermissionsets"
        if not mps_path.exists():
            return

        for mps_file in mps_path.glob("*.mutingpermissionset-meta.xml"):
            mps_name = mps_file.stem.replace('.mutingpermissionset-meta', '')
            self._add_node('MutingPermissionSet', mps_name, str(mps_file))

    def _analyze_gen_ai_functions(self):
        """Analiza Gen AI Functions"""
        gaf_path = self.metadata_path / "genAiFunctions"
        if not gaf_path.exists():
            return

        # GenAiFunctions son directorios
        for gaf_dir in gaf_path.iterdir():
            if gaf_dir.is_dir():
                gaf_name = gaf_dir.name
                gaf_file = gaf_dir / f"{gaf_name}.genAiFunction-meta.xml"
                if gaf_file.exists():
                    self._add_node('GenAiFunction', gaf_name, str(gaf_dir))

    def _analyze_gen_ai_planner_bundles(self):
        """Analiza Gen AI Planner Bundles"""
        gapb_path = self.metadata_path / "genAiPlannerBundles"
        if not gapb_path.exists():
            return

        for gapb_file in gapb_path.glob("*.genAiPlannerBundle-meta.xml"):
            gapb_name = gapb_file.stem.replace('.genAiPlannerBundle-meta', '')
            self._add_node('GenAiPlannerBundle', gapb_name, str(gapb_file))

    def _analyze_gen_ai_prompt_templates(self):
        """Analiza Gen AI Prompt Templates"""
        gapt_path = self.metadata_path / "genAiPromptTemplates"
        if not gapt_path.exists():
            return

        for gapt_file in gapt_path.glob("*.genAiPromptTemplate-meta.xml"):
            gapt_name = gapt_file.stem.replace('.genAiPromptTemplate-meta', '')
            self._add_node('GenAiPromptTemplate', gapt_name, str(gapt_file))

    def _analyze_custom_labels(self):
        """Analiza Custom Labels"""
        labels_path = self.metadata_path / "labels"
        if not labels_path.exists():
            return

        for labels_file in labels_path.glob("*.labels-meta.xml"):
            labels_name = labels_file.stem.replace('.labels-meta', '')
            self._add_node('CustomLabels', labels_name, str(labels_file))

    def _analyze_translations(self):
        """Analiza Translations"""
        trans_path = self.metadata_path / "translations"
        if not trans_path.exists():
            return

        for trans_file in trans_path.glob("*.translation-meta.xml"):
            trans_name = trans_file.stem.replace('.translation-meta', '')
            self._add_node('Translations', trans_name, str(trans_file))

    def _analyze_object_translations(self):
        """Analiza Object Translations"""
        ot_path = self.metadata_path / "objectTranslations"
        if not ot_path.exists():
            return

        # ObjectTranslations son directorios (e.g., Account-es, Account-es_MX)
        for ot_dir in ot_path.iterdir():
            if ot_dir.is_dir():
                ot_name = ot_dir.name
                self._add_node('ObjectTranslation', ot_name, str(ot_dir))

                # Detectar dependencia al objeto
                if '-' in ot_name:
                    obj_name = ot_name.split('-')[0]
                    if obj_name.endswith('__c') or obj_name.endswith('__mdt'):
                        self._add_dependency('ObjectTranslation', ot_name, 'CustomObject', obj_name)

    def _analyze_standard_value_set_translations(self):
        """Analiza Standard Value Set Translations"""
        svst_path = self.metadata_path / "standardValueSetTranslations"
        if not svst_path.exists():
            return

        for svst_file in svst_path.glob("*.standardValueSetTranslation-meta.xml"):
            svst_name = svst_file.stem.replace('.standardValueSetTranslation-meta', '')
            self._add_node('StandardValueSetTranslation', svst_name, str(svst_file))

    def _analyze_standard_value_sets(self):
        """Analiza Standard Value Sets"""
        svs_path = self.metadata_path / "standardValueSets"
        if not svs_path.exists():
            return

        for svs_file in svs_path.glob("*.standardValueSet-meta.xml"):
            svs_name = svs_file.stem.replace('.standardValueSet-meta', '')
            self._add_node('StandardValueSet', svs_name, str(svs_file))

    def _analyze_org_settings(self):
        """Analiza Organization Settings"""
        settings_path = self.metadata_path / "settings"
        if not settings_path.exists():
            return

        for settings_file in settings_path.glob("*.settings-meta.xml"):
            settings_name = settings_file.stem.replace('.settings-meta', '')
            self._add_node('OrgSettings', settings_name, str(settings_file))

    def _analyze_cors_whitelist_origins(self):
        """Analiza CORS Whitelist Origins"""
        cors_path = self.metadata_path / "corsWhitelistOrigins"
        if not cors_path.exists():
            return

        for cors_file in cors_path.glob("*.corsWhitelistOrigin-meta.xml"):
            cors_name = cors_file.stem.replace('.corsWhitelistOrigin-meta', '')
            self._add_node('CorsWhitelistOrigin', cors_name, str(cors_file))

    def _analyze_csp_trusted_sites(self):
        """Analiza CSP Trusted Sites"""
        csp_path = self.metadata_path / "cspTrustedSites"
        if not csp_path.exists():
            return

        for csp_file in csp_path.glob("*.cspTrustedSite-meta.xml"):
            csp_name = csp_file.stem.replace('.cspTrustedSite-meta', '')
            self._add_node('CspTrustedSite', csp_name, str(csp_file))

    def _analyze_content_assets(self):
        """Analiza Content Assets"""
        ca_path = self.metadata_path / "contentassets"
        if not ca_path.exists():
            return

        for ca_file in ca_path.glob("*.asset-meta.xml"):
            ca_name = ca_file.stem.replace('.asset-meta', '')
            self._add_node('ContentAsset', ca_name, str(ca_file))

    def _analyze_documents(self):
        """Analiza Document Folders"""
        doc_path = self.metadata_path / "documents"
        if not doc_path.exists():
            return

        # Documents son carpetas que contienen archivos .document-meta.xml
        # El nombre debe incluir la carpeta: FolderName/DocumentName
        for doc_dir in doc_path.iterdir():
            if doc_dir.is_dir():
                folder_name = doc_dir.name
                for doc_file in doc_dir.glob("*.document-meta.xml"):
                    doc_name = doc_file.stem.replace('.document-meta', '')
                    # Nombre completo: folder/document
                    full_name = f"{folder_name}/{doc_name}"
                    self._add_node('Document', full_name, str(doc_file))

    def _analyze_test_suites(self):
        """Analiza Test Suites"""
        ts_path = self.metadata_path / "testSuites"
        if not ts_path.exists():
            return

        for ts_file in ts_path.glob("*.testSuite-meta.xml"):
            ts_name = ts_file.stem.replace('.testSuite-meta', '')
            self._add_node('ApexTestSuite', ts_name, str(ts_file))

    def _analyze_search_customizations(self):
        """Analiza Search Customizations"""
        sc_path = self.metadata_path / "searchCustomizations"
        if not sc_path.exists():
            return

        for sc_file in sc_path.glob("*.searchCustomization-meta.xml"):
            sc_name = sc_file.stem.replace('.searchCustomization-meta', '')
            self._add_node('SearchCustomization', sc_name, str(sc_file))

    def _analyze_notification_types(self):
        """Analiza Notification Types"""
        nt_path = self.metadata_path / "notificationtypes"
        if not nt_path.exists():
            return

        # Extension correcta es .notiftype-meta.xml
        for nt_file in nt_path.glob("*.notiftype-meta.xml"):
            nt_name = nt_file.stem.replace('.notiftype-meta', '')
            self._add_node('CustomNotificationType', nt_name, str(nt_file))

    def _analyze_delegate_groups(self):
        """Analiza Delegate Groups"""
        dg_path = self.metadata_path / "delegateGroups"
        if not dg_path.exists():
            return

        for dg_file in dg_path.glob("*.delegateGroup-meta.xml"):
            dg_name = dg_file.stem.replace('.delegateGroup-meta', '')
            self._add_node('DelegateGroup', dg_name, str(dg_file))

    def _analyze_data_source_objects(self):
        """Analiza Data Source Objects (External Objects)"""
        dso_path = self.metadata_path / "dataSourceObjects"
        if not dso_path.exists():
            return

        for dso_file in dso_path.glob("*.dataSourceObject-meta.xml"):
            dso_name = dso_file.stem.replace('.dataSourceObject-meta', '')
            self._add_node('DataSourceObject', dso_name, str(dso_file))

    def _analyze_data_package_kit_definitions(self):
        """Analiza Data Package Kit Definitions"""
        dpkd_path = self.metadata_path / "dataPackageKitDefinitions"
        if not dpkd_path.exists():
            return

        for dpkd_file in dpkd_path.glob("*.dataPackageKitDefinition-meta.xml"):
            dpkd_name = dpkd_file.stem.replace('.dataPackageKitDefinition-meta', '')
            self._add_node('DataPackageKitDefinition', dpkd_name, str(dpkd_file))

    def _analyze_data_package_kit_objects(self):
        """Analiza Data Package Kit Objects"""
        dpko_path = self.metadata_path / "DataPackageKitObjects"
        if not dpko_path.exists():
            return

        # Extension con mayúscula: .DataPackageKitObject-meta.xml
        for dpko_file in dpko_path.glob("*.DataPackageKitObject-meta.xml"):
            dpko_name = dpko_file.stem.replace('.DataPackageKitObject-meta', '')
            self._add_node('DataPackageKitObject', dpko_name, str(dpko_file))

    def _analyze_layouts(self):
        """Analiza Layouts y sus dependencias en detalle"""
        layouts_path = self.metadata_path / "layouts"
        if not layouts_path.exists():
            return

        for layout_file in layouts_path.glob("*.layout-meta.xml"):
            layout_name = layout_file.stem.replace('.layout-meta', '')
            self._add_node('Layout', layout_name, str(layout_file))

            # Dependencia al objeto (por naming convention)
            obj_name = layout_name.split('-')[0]
            self._add_dependency('Layout', layout_name, 'CustomObject', obj_name)

            # Analizar XML para detectar dependencias adicionales
            try:
                tree = ET.parse(layout_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar campos personalizados referenciados
                for field in root.findall('.//sf:layoutItems/sf:field', ns):
                    field_name = field.text
                    if field_name and '__c' in field_name:
                        # Campo custom: Object__c.Field__c o solo Field__c
                        if '.' in field_name:
                            field_api_name = field_name.split('.')[1]
                        else:
                            field_api_name = field_name
                        # Los campos custom se despliegan con el objeto, no crear dependencia explícita
                        # pero podríamos registrarlo para tracking

                # Detectar Visualforce pages embebidas
                for vf_page in root.findall('.//sf:customLink/sf:page', ns):
                    page_name = vf_page.text
                    if page_name:
                        self._add_dependency('Layout', layout_name, 'VisualforcePage', page_name)

            except Exception as e:
                print(f"⚠️  Error analizando layout {layout_file}: {e}")

    def _analyze_profiles(self):
        """Analiza Profiles (similar a Permission Sets)"""
        profiles_path = self.metadata_path / "profiles"
        if not profiles_path.exists():
            return

        for profile_file in profiles_path.glob("*.profile-meta.xml"):
            profile_name = profile_file.stem.replace('.profile-meta', '')
            self._add_node('Profile', profile_name, str(profile_file))

    def _analyze_bots(self):
        """Analiza Bots y sus dependencias"""
        bots_path = self.metadata_path / "bots"
        if not bots_path.exists():
            return

        for bot_dir in bots_path.iterdir():
            if bot_dir.is_dir():
                bot_file = bot_dir / f"{bot_dir.name}.bot-meta.xml"
                if bot_file.exists():
                    bot_name = bot_dir.name
                    self._add_node('Bot', bot_name, str(bot_file))

    def _analyze_bot_versions(self):
        """Analiza Bot Versions"""
        bots_path = self.metadata_path / "bots"
        if not bots_path.exists():
            return

        for bot_dir in bots_path.iterdir():
            if bot_dir.is_dir():
                bot_name = bot_dir.name
                # Bot versions are inside the bot directory
                for version_file in bot_dir.glob("*.botVersion-meta.xml"):
                    version_name = version_file.stem.replace('.botVersion-meta', '')
                    full_name = f"{bot_name}.{version_name}"
                    self._add_node('BotVersion', full_name, str(version_file))
                    # Bot version depends on the bot
                    self._add_dependency('BotVersion', full_name, 'Bot', bot_name)

    def _analyze_business_processes(self):
        """Analiza Business Processes"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                bp_dir = obj_dir / "businessProcesses"
                if bp_dir.exists():
                    for bp_file in bp_dir.glob("*.businessProcess-meta.xml"):
                        bp_name = bp_file.stem.replace('.businessProcess-meta', '')
                        full_bp_name = f"{obj_name}.{bp_name}"
                        self._add_node('BusinessProcess', full_bp_name, str(bp_file))
                        # Business process depends on the object
                        self._add_dependency('BusinessProcess', full_bp_name, 'CustomObject', obj_name)

    def _analyze_compact_layouts(self):
        """Analiza Compact Layouts"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                cl_dir = obj_dir / "compactLayouts"
                if cl_dir.exists():
                    for cl_file in cl_dir.glob("*.compactLayout-meta.xml"):
                        cl_name = cl_file.stem.replace('.compactLayout-meta', '')
                        full_cl_name = f"{obj_name}.{cl_name}"
                        self._add_node('CompactLayout', full_cl_name, str(cl_file))
                        # Compact layout depends on the object
                        self._add_dependency('CompactLayout', full_cl_name, 'CustomObject', obj_name)

    def _analyze_list_views(self):
        """Analiza List Views"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                lv_dir = obj_dir / "listViews"
                if lv_dir.exists():
                    for lv_file in lv_dir.glob("*.listView-meta.xml"):
                        lv_name = lv_file.stem.replace('.listView-meta', '')
                        full_lv_name = f"{obj_name}.{lv_name}"
                        self._add_node('ListView', full_lv_name, str(lv_file))
                        # List view depends on the object
                        self._add_dependency('ListView', full_lv_name, 'CustomObject', obj_name)

    def _analyze_weblinks(self):
        """Analiza Web Links"""
        objects_path = self.metadata_path / "objects"
        if not objects_path.exists():
            return

        for obj_dir in objects_path.iterdir():
            if obj_dir.is_dir():
                obj_name = obj_dir.name
                wl_dir = obj_dir / "webLinks"
                if wl_dir.exists():
                    for wl_file in wl_dir.glob("*.webLink-meta.xml"):
                        wl_name = wl_file.stem.replace('.webLink-meta', '')
                        full_wl_name = f"{obj_name}.{wl_name}"
                        self._add_node('WebLink', full_wl_name, str(wl_file))
                        # Web link depends on the object
                        self._add_dependency('WebLink', full_wl_name, 'CustomObject', obj_name)

    def _analyze_gen_ai_plugins(self):
        """Analiza GenAI Plugins y Functions"""
        plugins_path = self.metadata_path / "genAiPlugins"
        if plugins_path.exists():
            for plugin_file in plugins_path.glob("*.genAiPlugin-meta.xml"):
                plugin_name = plugin_file.stem.replace('.genAiPlugin-meta', '')
                # Only add if the file actually exists
                if plugin_file.exists():
                    self._add_node('GenAiPlugin', plugin_name, str(plugin_file))

        functions_path = self.metadata_path / "genAiFunctions"
        if functions_path.exists():
            for func_dir in functions_path.iterdir():
                if func_dir.is_dir():
                    func_name = func_dir.name
                    # Only add if directory has actual metadata files
                    meta_file = func_dir / f"{func_name}.genAiFunction-meta.xml"
                    if meta_file.exists():
                        self._add_node('GenAiFunction', func_name, str(func_dir))

    def _analyze_sites(self):
        """Analiza Sites (CustomSite) y sus dependencias"""
        sites_path = self.metadata_path / "sites"
        if not sites_path.exists():
            return

        for site_file in sites_path.glob("*.site-meta.xml"):
            site_name = site_file.stem.replace('.site-meta', '')
            self._add_node('Site', site_name, str(site_file))

            try:
                tree = ET.parse(site_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar Visualforce pages usadas
                vf_page_tags = [
                    'authorizationRequiredPage', 'bandwidthExceededPage',
                    'fileNotFoundPage', 'genericErrorPage', 'inMaintenancePage',
                    'indexPage', 'selfRegPage'
                ]

                for tag in vf_page_tags:
                    for page in root.findall(f'.//sf:{tag}', ns):
                        page_name = page.text
                        if page_name:
                            self._add_dependency('Site', site_name, 'VisualforcePage', page_name)
                            print(f"    🌐 Site {site_name} → VF Page {page_name}")

                # Detectar StaticResource usado (serverIsDown)
                for sr in root.findall('.//sf:serverIsDown', ns):
                    sr_name = sr.text
                    if sr_name:
                        # StaticResource usado para página de error
                        pass  # No crear dependencia, solo registro

            except Exception as e:
                print(f"⚠️  Error analizando site {site_file}: {e}")

    def _analyze_networks(self):
        """Analiza Networks (Communities) y sus dependencias"""
        networks_path = self.metadata_path / "networks"
        if not networks_path.exists():
            return

        for network_file in networks_path.glob("*.network-meta.xml"):
            network_name = network_file.stem.replace('.network-meta', '')
            self._add_node('Network', network_name, str(network_file))

            try:
                tree = ET.parse(network_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar Site asociado
                for site in root.findall('.//sf:site', ns):
                    site_name = site.text
                    if site_name:
                        self._add_dependency('Network', network_name, 'Site', site_name)
                        print(f"    🌐 Network {network_name} → Site {site_name}")

                # Detectar DigitalExperience (picassoSite)
                for de in root.findall('.//sf:picassoSite', ns):
                    de_name = de.text
                    if de_name:
                        self._add_dependency('Network', network_name, 'DigitalExperience', de_name)
                        print(f"    🎨 Network {network_name} → DigitalExperience {de_name}")

                # Detectar EmailTemplates
                email_template_tags = [
                    'changePasswordTemplate', 'forgotPasswordTemplate',
                    'headlessForgotPasswordTemplate', 'headlessRegistrationTemplate',
                    'welcomeTemplate'
                ]

                for tag in email_template_tags:
                    for template in root.findall(f'.//sf:{tag}', ns):
                        template_name = template.text
                        if template_name:
                            self._add_dependency('Network', network_name, 'EmailTemplate', template_name)

                # Detectar Profiles
                for profile in root.findall('.//sf:networkMemberGroups/sf:profile', ns):
                    profile_name = profile.text
                    if profile_name:
                        # Profile "admin" es estándar, no custom
                        if profile_name != 'admin':
                            self._add_dependency('Network', network_name, 'Profile', profile_name)

            except Exception as e:
                print(f"⚠️  Error analizando network {network_file}: {e}")

    def _analyze_digital_experiences(self):
        """Analiza Digital Experiences y sus dependencias"""
        de_path = self.metadata_path / "digitalExperiences" / "site"
        if not de_path.exists():
            return

        for de_dir in de_path.iterdir():
            if de_dir.is_dir():
                dir_name = de_dir.name
                de_file = de_dir / f"{dir_name}.digitalExperience-meta.xml"

                if de_file.exists():
                    # El nombre debe incluir site/ prefix para DigitalExperienceBundle
                    de_name = f"site/{dir_name}"
                    self._add_node('DigitalExperience', de_name, str(de_file))

                    # Digital Experiences tienen subdirectorios para branding y site config
                    # pero no son dependencias explícitas de deployment
                    # (se despliegan como parte del bundle)

    def _analyze_messaging_channels(self):
        """Analiza Messaging Channels y sus dependencias"""
        mc_path = self.metadata_path / "messagingChannels"
        if not mc_path.exists():
            return

        for mc_file in mc_path.glob("*.messagingChannel-meta.xml"):
            mc_name = mc_file.stem.replace('.messagingChannel-meta', '')
            self._add_node('MessagingChannel', mc_name, str(mc_file))

            try:
                tree = ET.parse(mc_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # Detectar Queue
                for queue in root.findall('.//sf:sessionHandlerQueue', ns):
                    queue_name = queue.text
                    if queue_name:
                        self._add_dependency('MessagingChannel', mc_name, 'Queue', queue_name)
                        print(f"    💬 MessagingChannel {mc_name} → Queue {queue_name}")

                # Detectar Agentforce Service Agent (Bot)
                for asa in root.findall('.//sf:sessionHandlerAsa', ns):
                    asa_name = asa.text
                    if asa_name:
                        self._add_dependency('MessagingChannel', mc_name, 'Bot', asa_name)
                        print(f"    💬 MessagingChannel {mc_name} → Bot {asa_name}")

            except Exception as e:
                print(f"⚠️  Error analizando messaging channel {mc_file}: {e}")

    def _analyze_flexipages(self):
        """Analiza FlexiPages (Lightning Pages) y sus dependencias"""
        flexipages_path = self.metadata_path / "flexipages"
        if not flexipages_path.exists():
            return

        for flexipage_file in flexipages_path.glob("*.flexipage-meta.xml"):
            page_name = flexipage_file.stem.replace('.flexipage-meta', '')
            self._add_node('FlexiPage', page_name, str(flexipage_file))

            try:
                tree = ET.parse(flexipage_file)
                root = tree.getroot()
                ns = {'sf': 'http://soap.sforce.com/2006/04/metadata'}

                # 1. DETECTAR LWC (Lightning Web Components)
                for lwc_component in root.findall('.//sf:componentInstance/sf:componentName', ns):
                    component_name = lwc_component.text
                    if component_name and ':' in component_name:
                        # Formato: c:myLWC o namespace:component
                        namespace, comp_name = component_name.split(':', 1)
                        if namespace == 'c':
                            # Componente custom (LWC)
                            self._add_dependency('FlexiPage', page_name, 'LightningComponentBundle', comp_name)
                            print(f"    📱 FlexiPage {page_name} → LWC {comp_name}")

                # 2. DETECTAR FLOWS EMBEBIDOS
                # Los flows en flexipages aparecen como componentes flowruntime:interview
                for instance in root.findall('.//sf:componentInstance', ns):
                    comp_name = instance.find('sf:componentName', ns)
                    if comp_name is not None and comp_name.text == 'flowruntime:interview':
                        # Buscar el nombre del flow en los parámetros
                        for param in instance.findall('.//sf:componentInstanceProperties', ns):
                            param_name = param.find('sf:name', ns)
                            param_value = param.find('sf:value', ns)
                            if param_name is not None and param_value is not None:
                                if param_name.text == 'flowName':
                                    flow_name = param_value.text
                                    if flow_name:
                                        self._add_dependency('FlexiPage', page_name, 'Flow', flow_name)
                                        print(f"    🌊 FlexiPage {page_name} → Flow {flow_name}")

                # 3. DETECTAR REFERENCIAS A OBJETOS (sobjectApiName)
                for sobject in root.findall('.//sf:sobjectType', ns):
                    obj_name = sobject.text
                    if obj_name and obj_name.endswith('__c'):
                        self._add_dependency('FlexiPage', page_name, 'CustomObject', obj_name)

                # 4. DETECTAR CAMPOS EN COMPONENTES (field references)
                for field_ref in root.findall('.//sf:componentInstanceProperties', ns):
                    prop_name = field_ref.find('sf:name', ns)
                    prop_value = field_ref.find('sf:value', ns)
                    if prop_name is not None and prop_value is not None:
                        # Buscar propiedades que referencien campos
                        if 'field' in prop_name.text.lower() and '__c' in prop_value.text:
                            # Campo custom referenciado
                            field_api_name = prop_value.text
                            if '.' in field_api_name:
                                obj_name, field_name = field_api_name.split('.')
                                if obj_name.endswith('__c'):
                                    # Asegurar que el objeto existe primero
                                    self._add_dependency('FlexiPage', page_name, 'CustomObject', obj_name)

            except Exception as e:
                print(f"⚠️  Error analizando flexipage {flexipage_file}: {e}")

    def _apply_heuristics(self):
        """Aplica heurísticas inteligentes para inferir dependencias adicionales"""

        # Obtener todas las clases Apex
        all_apex_classes = set()
        for node_id, node in self.nodes.items():
            if node.metadata_type == 'ApexClass':
                all_apex_classes.add(node.name)

        heuristics_applied = 0

        # Aplicar heurísticas a cada clase Apex
        for node_id, node in list(self.nodes.items()):
            if node.metadata_type != 'ApexClass':
                continue

            class_name = node.name

            # 1. HEURÍSTICA: Test Classes → Production Classes
            test_deps = SalesforceHeuristics.infer_test_class_dependencies(class_name, all_apex_classes)
            for dep_class in test_deps:
                dep_id = self._get_node_id('ApexClass', dep_class)
                if dep_id in self.nodes and dep_id not in node.dependencies:
                    self._add_dependency('ApexClass', class_name, 'ApexClass', dep_class)
                    print(f"  🎯 Heurística: {class_name} → {dep_class} (test class)")
                    heuristics_applied += 1

            # 2. HEURÍSTICA: Handlers → Services
            service_deps = SalesforceHeuristics.infer_handler_service_dependencies(class_name, all_apex_classes)
            for dep_class in service_deps:
                dep_id = self._get_node_id('ApexClass', dep_class)
                if dep_id in self.nodes and dep_id not in node.dependencies:
                    self._add_dependency('ApexClass', class_name, 'ApexClass', dep_class)
                    print(f"  🎯 Heurística: {class_name} → {dep_class} (handler→service)")
                    heuristics_applied += 1

            # 3. HEURÍSTICA: Ajustar prioridad de utility classes
            if SalesforceHeuristics.is_utility_class(class_name):
                node.priority_boost = -10  # Desplegar antes
                print(f"  ⚡ Prioridad: {class_name} (utility class)")

            # 4. HEURÍSTICA: Test classes NO deben tener boost
            # Deben desplegarse EN LA MISMA OLA que sus dependencias
            # para que los tests se ejecuten contra el código correcto
            if SalesforceHeuristics.is_test_class(class_name):
                node.priority_boost = 0  # Misma prioridad que production class

        print(f"  ✅ {heuristics_applied} dependencias inferidas por heurísticas")

    def generate_deployment_order(self) -> List[List[str]]:
        """Genera el orden de despliegue usando topological sort"""
        print("\n📋 Generando orden de despliegue...")

        # Calcular in-degree para cada nodo
        in_degree = {node_id: 0 for node_id in self.nodes}

        for node_id in self.nodes:
            in_degree[node_id] = len(self.dependency_graph.get(node_id, set()))

        # Cola de nodos sin dependencias
        queue = deque([node_id for node_id, degree in in_degree.items() if degree == 0])

        deployment_waves = []
        current_wave = []

        # Ordenar por prioridad de tipo de metadata + heurísticas
        def get_priority(node_id):
            node = self.nodes[node_id]
            base_priority = MetadataType.DEPLOY_ORDER.get(node.metadata_type, 99)
            # Aplicar boost de heurísticas (puede ser negativo o positivo)
            return base_priority + node.priority_boost

        while queue:
            # Ordenar la ola actual por prioridad
            current_wave = sorted(list(queue), key=get_priority)
            deployment_waves.append(current_wave)

            next_queue = deque()

            for node_id in current_wave:
                # Reducir in-degree de dependientes
                for dependent_id in self.reverse_graph.get(node_id, set()):
                    in_degree[dependent_id] -= 1
                    if in_degree[dependent_id] == 0:
                        next_queue.append(dependent_id)

            queue = next_queue

        # Detectar dependencias circulares
        remaining = [node_id for node_id, degree in in_degree.items() if degree > 0]
        if remaining:
            print(f"⚠️  Advertencia: Posibles dependencias circulares detectadas en {len(remaining)} componentes")
            deployment_waves.append(remaining)

        # POST-PROCESAMIENTO: Mover Test Classes a la misma ola que su Production Class
        # Esto evita que los tests se ejecuten contra código viejo
        deployment_waves = self._merge_test_classes_with_production(deployment_waves)

        # POST-PROCESAMIENTO 2: Mover Triggers a la misma ola que sus Handlers
        # Esto garantiza que los Handlers tengan coverage (los Triggers los invocan)
        deployment_waves = self._merge_triggers_with_handlers(deployment_waves)

        # POST-PROCESAMIENTO 2.5: Sincronizar TODOS los Services con sus Tests
        # Esto garantiza coverage proactivo para todos los Services
        print("\n🔧 Sincronizando Services con Tests...")
        deployment_waves = self._sync_services_with_tests(deployment_waves)

        # POST-PROCESAMIENTO 3: Mover Test Classes que activan Triggers a la wave del Trigger
        # Esto garantiza que Handlers/Triggers tengan coverage cuando tests insertan SObjects
        deployment_waves = self._merge_test_classes_with_triggers(deployment_waves)

        # POST-PROCESAMIENTO 3.5: Mover Production Classes a la wave de sus Tests (si Tests fueron movidos por Triggers)
        # Esto garantiza que las clases de producción tengan coverage
        print("\n🔧 Sincronizando Production Classes con Tests que fueron movidos...")
        deployment_waves = self._sync_production_with_moved_tests(deployment_waves)

        # POST-PROCESAMIENTO 4: Dividir waves grandes (>300 componentes) para evitar UNKNOWN_EXCEPTION
        # Nota: Límite conservador porque algunos componentes generan múltiples archivos
        # (ej: CustomObject con 50 fields = 51 archivos físicos)
        print("\n🔧 Dividiendo waves grandes...")
        deployment_waves = self._split_large_waves(deployment_waves, max_components=300)

        return deployment_waves

    def _merge_test_classes_with_production(self, waves: List[List[str]]) -> List[List[str]]:
        """
        Mueve Test Classes Apex a la misma ola que su Production Class principal.
        Esto garantiza que cuando se ejecutan los tests, ya tengan el código actualizado.
        """
        moved_count = 0

        # Crear un mapa de dónde está cada componente
        component_wave_map = {}
        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                component_wave_map[node_id] = wave_idx

        # Buscar test classes y moverlas si es necesario
        for wave_idx in range(len(waves)):
            test_classes_to_move = []

            for node_id in waves[wave_idx][:]:  # Iterar sobre copia
                node = self.nodes[node_id]

                # Solo procesar ApexClass que sean tests
                if node.metadata_type != 'ApexClass':
                    continue

                if not SalesforceHeuristics.is_test_class(node.name):
                    continue

                # Buscar su production class principal
                for dep_id in node.dependencies:
                    dep_node = self.nodes.get(dep_id)
                    if not dep_node or dep_node.metadata_type != 'ApexClass':
                        continue

                    # Si la production class está en una ola ANTERIOR
                    prod_wave_idx = component_wave_map.get(dep_id)
                    if prod_wave_idx is not None and prod_wave_idx < wave_idx:
                        # Mover test class a la ola de la production class
                        test_classes_to_move.append((node_id, prod_wave_idx))
                        moved_count += 1
                        print(f"  📦 Moviendo {node.name} de Wave {wave_idx+1} → Wave {prod_wave_idx+1} (con {dep_node.name})")
                        break  # Solo necesitamos la primera dependencia

            # Aplicar movimientos
            for node_id, target_wave in test_classes_to_move:
                waves[wave_idx].remove(node_id)
                if target_wave < len(waves):
                    waves[target_wave].append(node_id)
                    component_wave_map[node_id] = target_wave

        # Limpiar olas vacías
        waves = [wave for wave in waves if wave]

        if moved_count > 0:
            print(f"  ✅ {moved_count} test classes movidas a la misma ola que su production class")

        return waves

    def _merge_triggers_with_handlers(self, waves: List[List[str]]) -> List[List[str]]:
        """
        Mueve Apex Triggers a la misma ola que sus Handler classes.
        También mueve Services llamados por Handlers a la ola del Handler.
        Esto garantiza que Handlers + Services + Triggers tengan coverage completo.
        """
        moved_triggers = 0
        moved_services = 0

        # Crear un mapa de dónde está cada componente
        component_wave_map = {}
        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                component_wave_map[node_id] = wave_idx

        # PASO 1: Buscar triggers y moverlos si es necesario
        for wave_idx in range(len(waves)):
            triggers_to_move = []

            for node_id in waves[wave_idx][:]:  # Iterar sobre copia
                node = self.nodes[node_id]

                # Solo procesar ApexTrigger
                if node.metadata_type != 'ApexTrigger':
                    continue

                # Buscar su handler class principal
                for dep_id in node.dependencies:
                    dep_node = self.nodes.get(dep_id)
                    if not dep_node or dep_node.metadata_type != 'ApexClass':
                        continue

                    # Si el Handler está en una ola ANTERIOR
                    handler_wave_idx = component_wave_map.get(dep_id)
                    if handler_wave_idx is not None and handler_wave_idx < wave_idx:
                        # Mover Trigger a la ola del Handler
                        triggers_to_move.append((node_id, handler_wave_idx))
                        moved_triggers += 1
                        print(f"  🔫 Moviendo Trigger {node.name} de Wave {wave_idx+1} → Wave {handler_wave_idx+1} (con Handler {dep_node.name})")
                        break  # Solo necesitamos la primera dependencia

            # Aplicar movimientos
            for node_id, target_wave in triggers_to_move:
                waves[wave_idx].remove(node_id)
                if target_wave < len(waves):
                    waves[target_wave].append(node_id)
                    component_wave_map[node_id] = target_wave

        # PASO 2: Mover Services llamados por Handlers a la ola del Handler
        for wave_idx in range(len(waves)):
            services_to_move = []

            for node_id in waves[wave_idx][:]:  # Iterar sobre copia
                node = self.nodes[node_id]

                # Solo procesar ApexClass que sean Services llamados por Handlers
                if node.metadata_type != 'ApexClass':
                    continue

                # Buscar Handlers que llamen a este Service
                for potential_handler_id in self.reverse_graph.get(node_id, set()):
                    handler_node = self.nodes.get(potential_handler_id)
                    if not handler_node or handler_node.metadata_type != 'ApexClass':
                        continue

                    # Si el nombre sugiere que es un Handler y llama a este Service
                    if 'Handler' in handler_node.name and 'Service' in node.name:
                        handler_wave_idx = component_wave_map.get(potential_handler_id)
                        # Si el Handler está en una ola POSTERIOR
                        if handler_wave_idx is not None and handler_wave_idx > wave_idx:
                            services_to_move.append((node_id, handler_wave_idx))
                            moved_services += 1
                            print(f"  ⚙️  Moviendo Service {node.name} de Wave {wave_idx+1} → Wave {handler_wave_idx+1} (llamado por {handler_node.name})")
                            break

            # Aplicar movimientos
            for node_id, target_wave in services_to_move:
                waves[wave_idx].remove(node_id)
                if target_wave < len(waves):
                    waves[target_wave].append(node_id)
                    component_wave_map[node_id] = target_wave

        # Limpiar olas vacías
        waves = [wave for wave in waves if wave]

        if moved_triggers > 0:
            print(f"  ✅ {moved_triggers} triggers movidos a la misma ola que sus handlers")
        if moved_services > 0:
            print(f"  ✅ {moved_services} services movidos a la misma ola que sus handlers")

        return waves

    def _sync_services_with_tests(self, waves: List[List[str]]) -> List[List[str]]:
        """
        Sincroniza TODOS los Services con sus Test Classes.
        Los mueve a la misma wave (la más tardía) para garantizar coverage.

        Estrategia:
        1. Identificar todos los Services (ApexClass con 'Service' en nombre)
        2. Buscar su Test correspondiente (Service_Test o ServiceTest)
        3. Si están en waves diferentes, moverlos a la wave más tardía

        Ejemplo:
          Wave 1: SC_Account_Service_Test
          Wave 3: SC_Account_Service
          → Mover Test a Wave 3
        """
        moved_services = 0
        moved_tests = 0

        # Crear un mapa de dónde está cada componente
        component_wave_map = {}
        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                component_wave_map[node_id] = wave_idx

        # Identificar todos los Services y sus Tests
        services = {}  # {service_name: (node_id, wave_idx)}
        tests = {}     # {test_name: (node_id, wave_idx)}

        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                node = self.nodes[node_id]

                if node.metadata_type != 'ApexClass':
                    continue

                # Es un Service?
                if 'Service' in node.name and not SalesforceHeuristics.is_test_class(node.name):
                    services[node.name] = (node_id, wave_idx)

                # Es un Test?
                if SalesforceHeuristics.is_test_class(node.name):
                    tests[node.name] = (node_id, wave_idx)

        # Para cada Service, buscar su Test y sincronizar
        for service_name, (service_id, service_wave) in services.items():
            # Buscar test correspondiente (múltiples patrones)
            test_patterns = [
                f"{service_name}_Test",
                f"{service_name}Test",
                service_name.replace('Service', 'Service_Test'),
                service_name.replace('Service', 'ServiceTest'),
            ]

            test_node_id = None
            test_wave = None
            test_name = None

            for pattern in test_patterns:
                if pattern in tests:
                    test_node_id, test_wave = tests[pattern]
                    test_name = pattern
                    break

            if test_node_id and test_wave is not None:
                # Si están en waves diferentes, mover a la más tardía
                if service_wave != test_wave:
                    target_wave = max(service_wave, test_wave)

                    # Mover el que está en la wave más temprana
                    if service_wave < target_wave:
                        # Mover Service a wave del Test
                        waves[service_wave].remove(service_id)
                        if target_wave < len(waves):
                            waves[target_wave].append(service_id)
                            component_wave_map[service_id] = target_wave
                            moved_services += 1
                            print(f"  🔧 Sincronizando Service {service_name}: Wave {service_wave+1} → Wave {target_wave+1} (con {test_name})")
                    else:
                        # Mover Test a wave del Service
                        waves[test_wave].remove(test_node_id)
                        if target_wave < len(waves):
                            waves[target_wave].append(test_node_id)
                            component_wave_map[test_node_id] = target_wave
                            moved_tests += 1
                            print(f"  🧪 Sincronizando Test {test_name}: Wave {test_wave+1} → Wave {target_wave+1} (con {service_name})")

        # Limpiar olas vacías
        waves = [wave for wave in waves if wave]

        if moved_services > 0 or moved_tests > 0:
            print(f"  ✅ Sincronización Service↔Test: {moved_services} services + {moved_tests} tests movidos")

        return waves

    def _merge_test_classes_with_triggers(self, waves: List[List[str]]) -> List[List[str]]:
        """
        Mueve Test Classes que activan Triggers a la misma ola que el Trigger.
        Esto garantiza que los Handlers/Triggers tengan coverage cuando tests insertan SObjects.

        Ejemplo: SC_ContentVersion_Service_Test inserta ContentVersion
                 → Activa SC_ContentVersionTrigger
                 → Trigger llama SC_ContentVersion_Handler
                 Sin el test en la misma wave, Handler tiene 0% coverage.
        """
        moved_count = 0

        # Crear un mapa de dónde está cada componente
        component_wave_map = {}
        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                component_wave_map[node_id] = wave_idx

        # Mapear Triggers a sus SObjects
        trigger_sobject_map = {}  # {trigger_node_id: 'ContentVersion'}
        for wave in waves:
            for node_id in wave:
                node = self.nodes[node_id]
                if node.metadata_type == 'ApexTrigger':
                    # Extraer el SObject del archivo del trigger
                    try:
                        with open(node.file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            # Patrón: trigger MyTrigger on ContentVersion (before insert)
                            import re
                            match = re.search(r'trigger\s+\w+\s+on\s+(\w+)\s*\(', content)
                            if match:
                                sobject = match.group(1)
                                trigger_sobject_map[node_id] = sobject
                    except:
                        pass

        # Buscar test classes y moverlos si insertan SObjects con Triggers
        for wave_idx in range(len(waves)):
            tests_to_move = []

            for node_id in waves[wave_idx][:]:  # Iterar sobre copia
                node = self.nodes[node_id]

                # Solo procesar ApexClass que sean tests
                if node.metadata_type != 'ApexClass':
                    continue

                if not SalesforceHeuristics.is_test_class(node.name):
                    continue

                # Detectar si el test inserta SObjects basándose en su nombre y contenido
                # Heurística: Si el test se llama SC_ContentVersion_Service_Test, probablemente inserta ContentVersion
                potential_sobjects = []

                # Extraer del nombre
                if 'ContentVersion' in node.name:
                    potential_sobjects.append('ContentVersion')
                if 'ContentDocument' in node.name:
                    potential_sobjects.append('ContentDocument')
                if 'Account' in node.name and 'Account' != node.name.replace('Test', '').replace('_', ''):
                    potential_sobjects.append('Account')
                if 'Case' in node.name and 'Case' != node.name.replace('Test', '').replace('_', ''):
                    potential_sobjects.append('Case')

                # Buscar si hay un Trigger para alguno de estos SObjects en una wave POSTERIOR
                for trigger_id, sobject in trigger_sobject_map.items():
                    if sobject in potential_sobjects:
                        trigger_wave_idx = component_wave_map.get(trigger_id)
                        if trigger_wave_idx is not None and trigger_wave_idx > wave_idx:
                            # Mover test class a la ola del Trigger
                            tests_to_move.append((node_id, trigger_wave_idx))
                            moved_count += 1
                            trigger_node = self.nodes[trigger_id]
                            print(f"  📋 Moviendo Test {node.name} de Wave {wave_idx+1} → Wave {trigger_wave_idx+1} (inserta {sobject} → activa {trigger_node.name})")
                            break

            # Aplicar movimientos
            for node_id, target_wave in tests_to_move:
                waves[wave_idx].remove(node_id)
                if target_wave < len(waves):
                    waves[target_wave].append(node_id)
                    component_wave_map[node_id] = target_wave

        # Limpiar olas vacías
        waves = [wave for wave in waves if wave]

        if moved_count > 0:
            print(f"  ✅ {moved_count} test classes movidos a waves con triggers para coverage")

        return waves

    def _sync_production_with_moved_tests(self, waves: List[List[str]]) -> List[List[str]]:
        """
        Mueve Production Classes a la misma wave que sus Tests (si Tests fueron movidos).
        Esto garantiza que las clases de producción tengan coverage.

        Contexto:
        - _merge_test_classes_with_triggers() mueve Tests a waves posteriores (con Triggers)
        - Esto deja las Production Classes en waves tempranas SIN coverage
        - Este método mueve las Production Classes a la wave de sus Tests

        Ejemplo:
          Antes:
            Wave 1: SC_DeleteOldCaseFilesBatch (0% coverage)
            Wave 4: SC_DeleteOldCaseFilesbatchTest (movido por Trigger)

          Después:
            Wave 4: SC_DeleteOldCaseFilesBatch + SC_DeleteOldCaseFilesbatchTest (coverage ✅)
        """
        moved_count = 0

        # Crear un mapa de dónde está cada componente
        component_wave_map = {}
        for wave_idx, wave in enumerate(waves):
            for node_id in wave:
                component_wave_map[node_id] = wave_idx

        # Identificar todos los Test Classes y sus Production Classes
        test_production_pairs = []  # [(test_name, test_node_id, production_node_id)]

        for wave in waves:
            for node_id in wave:
                node = self.nodes[node_id]

                if node.metadata_type != 'ApexClass':
                    continue

                if not SalesforceHeuristics.is_test_class(node.name):
                    continue

                # Buscar la Production Class correspondiente
                production_name = node.name.replace('_Test', '').replace('Test', '')

                for potential_prod_id, potential_prod_node in self.nodes.items():
                    # Comparación case-insensitive para manejar SC_DeleteOldCaseFilesbatchTest vs SC_DeleteOldCaseFilesBatch
                    if potential_prod_node.name.lower() == production_name.lower():
                        test_production_pairs.append((node.name, node_id, potential_prod_id))
                        break

        # Para cada par Test-Production, si Test está en wave posterior, mover Production
        for test_name, test_id, production_id in test_production_pairs:
            test_wave = component_wave_map.get(test_id)
            production_wave = component_wave_map.get(production_id)

            if test_wave is None or production_wave is None:
                continue

            # Si Test está en wave POSTERIOR a Production, mover Production
            if test_wave > production_wave:
                production_node = self.nodes[production_id]

                # Mover Production a wave del Test
                waves[production_wave].remove(production_id)
                if test_wave < len(waves):
                    waves[test_wave].append(production_id)
                    component_wave_map[production_id] = test_wave
                    moved_count += 1
                    print(f"  🔧 Moviendo Production {production_node.name} de Wave {production_wave+1} → Wave {test_wave+1} (con {test_name})")

        # Limpiar olas vacías
        waves = [wave for wave in waves if wave]

        if moved_count > 0:
            print(f"  ✅ Sincronización Production↔Test: {moved_count} clases movidas para garantizar coverage")

        return waves

    def _split_large_waves(self, waves: List[List[str]], max_components: int = 300) -> List[List[str]]:
        """
        Divide waves grandes en sub-waves para evitar UNKNOWN_EXCEPTION.
        
        Salesforce tiene límites prácticos de ~400-500 archivos físicos por deployment.
        Usamos 300 componentes como límite conservador porque algunos componentes
        generan múltiples archivos (ej: CustomObject con fields = muchos archivos).
        Esta función divide waves que excedan ese límite, respetando:
        - Agrupación por tipo de metadata
        - Dependencias dentro de la wave
        - Test classes con sus production classes
        """
        new_waves = []
        split_count = 0
        
        for wave_idx, wave in enumerate(waves):
            if len(wave) <= max_components:
                new_waves.append(wave)
                continue
            
            print(f"   ⚠️  Wave {wave_idx+1} tiene {len(wave)} componentes (>{max_components})")
            
            # Agrupar por tipo de metadata
            by_type = defaultdict(list)
            for node_id in wave:
                node = self.nodes[node_id]
                by_type[node.metadata_type].append(node_id)
            
            # Estrategia: dividir por tipo, luego por tamaño
            sub_waves = []
            current_sub_wave = []
            
            # Ordenar tipos por DEPLOY_ORDER
            sorted_types = sorted(
                by_type.keys(),
                key=lambda t: MetadataType.DEPLOY_ORDER.get(t, 99)
            )
            
            for metadata_type in sorted_types:
                components = by_type[metadata_type]
                
                # CustomMetadataRecord tiene límite más bajo (~200 files vs ~400 files)
                # porque genera 1 file por record
                effective_limit = 200 if metadata_type == 'CustomMetadataRecord' else max_components
                
                # Si este tipo cabe en el sub-wave actual
                if len(current_sub_wave) + len(components) <= effective_limit:
                    current_sub_wave.extend(components)
                else:
                    # Guardar sub-wave actual si no está vacío
                    if current_sub_wave:
                        sub_waves.append(current_sub_wave)
                        current_sub_wave = []
                    
                    # Si este tipo es muy grande, dividirlo en chunks
                    if len(components) > effective_limit:
                        for i in range(0, len(components), effective_limit):
                            chunk = components[i:i+effective_limit]
                            sub_waves.append(chunk)
                            split_count += 1
                            limit_type = "records (CMT)" if metadata_type == 'CustomMetadataRecord' else "componentes"
                            print(f"      ├─ Dividiendo {metadata_type}: {len(chunk)} {limit_type} (parte {i//effective_limit + 1})")
                    else:
                        current_sub_wave = components
            
            # Agregar último sub-wave si no está vacío
            if current_sub_wave:
                sub_waves.append(current_sub_wave)
            
            new_waves.extend(sub_waves)
            print(f"      ✅ Wave {wave_idx+1} dividida en {len(sub_waves)} sub-waves")
        
        if split_count > 0:
            print(f"   ✅ División de waves: {len(waves)} → {len(new_waves)} waves (evita límite de 300 componentes/~400 archivos)")
        
        return new_waves

    def generate_report(self) -> Dict:
        """Genera un reporte completo de dependencias"""
        deployment_order = self.generate_deployment_order()

        # Estadísticas
        stats = {
            'total_components': len(self.nodes),
            'by_type': defaultdict(int),
            'total_dependencies': sum(len(deps) for deps in self.dependency_graph.values()),
            'deployment_waves': len(deployment_order),
        }

        for node in self.nodes.values():
            stats['by_type'][node.metadata_type] += 1

        # Componentes más dependidos
        most_depended = sorted(
            self.nodes.items(),
            key=lambda x: len(x[1].dependents),
            reverse=True
        )[:10]

        report = {
            'statistics': dict(stats),
            'deployment_order': [
                [
                    {
                        'id': node_id,
                        'name': self.nodes[node_id].name,
                        'type': self.nodes[node_id].metadata_type,
                        'file': self.nodes[node_id].file_path,
                        'dependencies': len(self.nodes[node_id].dependencies),
                    }
                    for node_id in wave
                ]
                for wave in deployment_order
            ],
            'most_depended_components': [
                {
                    'id': node_id,
                    'name': node.name,
                    'type': node.metadata_type,
                    'dependents_count': len(node.dependents),
                }
                for node_id, node in most_depended
            ]
        }

        return report

    def print_summary(self):
        """Imprime un resumen del análisis"""
        report = self.generate_report()
        stats = report['statistics']

        print("\n" + "="*60)
        print("📊 RESUMEN DE ANÁLISIS DE DEPENDENCIAS")
        print("="*60)
        print(f"\n📦 Total de componentes: {stats['total_components']}")
        print(f"🔗 Total de dependencias: {stats['total_dependencies']}")
        print(f"🌊 Olas de despliegue: {stats['deployment_waves']}")

        print("\n📋 Componentes por tipo:")
        for mtype, count in sorted(stats['by_type'].items(), key=lambda x: x[1], reverse=True):
            print(f"   {mtype:30s}: {count:3d}")

        print("\n🎯 Top 10 componentes más dependidos:")
        for comp in report['most_depended_components']:
            print(f"   {comp['type']:20s} {comp['name']:40s} ({comp['dependents_count']} dependientes)")

        print("\n📦 Orden de despliegue recomendado:")
        for i, wave in enumerate(report['deployment_order'], 1):
            print(f"\n   Ola {i}: ({len(wave)} componentes)")
            # Agrupar por tipo
            by_type = defaultdict(list)
            for comp in wave:
                by_type[comp['type']].append(comp['name'])

            for mtype, names in sorted(by_type.items()):
                print(f"      {mtype}: {len(names)} componentes")
                if len(names) <= 5:
                    for name in names:
                        print(f"         - {name}")
                else:
                    for name in names[:3]:
                        print(f"         - {name}")
                    print(f"         ... y {len(names) - 3} más")

        print("\n" + "="*60)

    def save_report(self, output_file: str = "dependency_report.json"):
        """Guarda el reporte en formato JSON"""
        report = self.generate_report()
        output_path = self.project_path / output_file

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n💾 Reporte guardado en: {output_path}")

    def generate_deployment_manifest(self, output_dir: str = "deployment_manifests"):
        """Genera manifests (package.xml) por ola de despliegue"""
        deployment_order = self.generate_deployment_order()
        manifest_dir = self.project_path / output_dir
        manifest_dir.mkdir(exist_ok=True)

        print(f"\n📄 Generando manifests de despliegue en: {manifest_dir}")

        # Metadatos de cada ola para optimización de tests
        wave_metadata = {}

        for i, wave in enumerate(deployment_order, 1):
            manifest_path = manifest_dir / f"wave_{i}_package.xml"

            # Agrupar por tipo de metadata
            by_type = defaultdict(list)
            for node_id in wave:
                node = self.nodes[node_id]

                # Filtrar componentes managed (force__, sfdc__, etc.)
                if node.name.startswith('force__') or node.name.startswith('sfdc__'):
                    continue

                # Verificar que el archivo realmente exista físicamente
                file_path = Path(node.file_path)
                if file_path.exists():
                    by_type[node.metadata_type].append(node.name)

            # Solo generar manifest si hay componentes
            if by_type:
                # Generar XML
                xml_content = self._generate_package_xml(by_type)

                with open(manifest_path, 'w', encoding='utf-8') as f:
                    f.write(xml_content)

                # Determinar si esta ola requiere tests
                types_list = list(by_type.keys())
                requires_tests = self._wave_requires_tests(types_list)
                has_apex = 'ApexClass' in types_list or 'ApexTrigger' in types_list
                has_flows = 'Flow' in types_list

                # Extraer test classes específicas de esta ola
                test_classes = []
                if 'ApexClass' in by_type:
                    test_classes = [
                        cls_name for cls_name in by_type['ApexClass']
                        if SalesforceHeuristics.is_test_class(cls_name)
                    ]

                wave_metadata[f"wave_{i}"] = {
                    "requires_tests": requires_tests,
                    "has_apex": has_apex,
                    "has_flows": has_flows,
                    "test_classes": test_classes,  # Lista de test classes en esta ola
                    "types": types_list,
                    "component_count": sum(len(v) for v in by_type.values())
                }

                print(f"   ✅ Wave {i}: {manifest_path.name} ({sum(len(v) for v in by_type.values())} componentes)")
            else:
                print(f"   ⚠️  Wave {i}: Omitida (sin componentes válidos)")

        # Guardar metadatos de olas
        metadata_path = manifest_dir / "wave_metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(wave_metadata, f, indent=2, ensure_ascii=False)

        print(f"\n📦 {len(deployment_order)} manifests generados")
        print(f"📋 Metadata file: {metadata_path.name}")

        # Resumen de tests
        waves_with_tests = sum(1 for m in wave_metadata.values() if m['requires_tests'])
        waves_without_tests = len(wave_metadata) - waves_with_tests
        print(f"\n⚡ Optimización de Tests:")
        print(f"   ✅ {waves_with_tests} olas con tests (Apex/Flows)")
        print(f"   🚀 {waves_without_tests} olas sin tests (más rápidas)")

    def _wave_requires_tests(self, types_list: List[str]) -> bool:
        """
        Determina si una ola requiere ejecución de tests.

        Reglas:
        - ApexClass o ApexTrigger → SÍ (obligatorio por Salesforce)
        - Flow → SÍ (recomendado, pueden llamar Apex)
        - Otros tipos → NO (optimización de velocidad)
        """
        test_required_types = {'ApexClass', 'ApexTrigger', 'Flow'}
        return bool(set(types_list) & test_required_types)

    def _generate_package_xml(self, components_by_type: Dict[str, List[str]]) -> str:
        """Genera un archivo package.xml"""
        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
        ]

        # Mapeo de tipos internos a nombres de API de Salesforce
        type_mapping = {
            'ApexClass': 'ApexClass',
            'ApexTestSuite': 'ApexTestSuite',
            'ApexTrigger': 'ApexTrigger',
            'AuraDefinitionBundle': 'AuraDefinitionBundle',
            'Bot': 'Bot',
            'BotVersion': 'BotVersion',
            'BrandingSet': 'BrandingSet',
            'BusinessProcess': 'BusinessProcess',
            'ChannelLayout': 'ChannelLayout',
            'CompactLayout': 'CompactLayout',
            'ContentAsset': 'ContentAsset',
            'CorsWhitelistOrigin': 'CorsWhitelistOrigin',
            'CspTrustedSite': 'CspTrustedSite',
            'CustomField': 'CustomField',
            'CustomLabels': 'CustomLabels',
            'CustomMetadata': 'CustomObject',  # CustomMetadata TYPES son CustomObjects
            'CustomMetadataRecord': 'CustomMetadata',  # CustomMetadata RECORDS
            'CustomObject': 'CustomObject',
            'CustomPermission': 'CustomPermission',
            'DataCategoryGroup': 'DataCategoryGroup',
            'DataPackageKitDefinition': 'DataPackageKitDefinition',
            'DataPackageKitObject': 'DataPackageKitObject',
            'DataSourceObject': 'DataSourceObject',
            'DelegateGroup': 'DelegateGroup',
            'DigitalExperience': 'DigitalExperienceBundle',
            'DigitalExperienceConfig': 'DigitalExperienceConfig',
            'Document': 'Document',
            'EmailTemplate': 'EmailTemplate',
            'EmbeddedServiceConfig': 'EmbeddedServiceConfig',
            'EntitlementProcess': 'EntitlementProcess',
            'ExternalCredential': 'ExternalCredential',
            'FlexiPage': 'FlexiPage',
            'Flow': 'Flow',
            'GenAiFunction': 'GenAiFunction',
            'GenAiPlannerBundle': 'GenAiPlannerBundle',
            'GenAiPlugin': 'GenAiPlugin',
            'GenAiPromptTemplate': 'GenAiPromptTemplate',
            'GlobalValueSet': 'GlobalValueSet',
            'Group': 'Group',
            'Layout': 'Layout',
            'LightningApp': 'CustomApplication',
            'LightningComponentBundle': 'LightningComponentBundle',
            'ListView': 'ListView',
            'MessagingChannel': 'MessagingChannel',
            'MilestoneType': 'MilestoneType',
            'MutingPermissionSet': 'MutingPermissionSet',
            'NamedCredential': 'NamedCredential',
            'Network': 'Network',
            'NetworkBranding': 'NetworkBranding',
            'CustomNotificationType': 'CustomNotificationType',
            'ObjectTranslation': 'CustomObjectTranslation',
            'OmniSupervisorConfig': 'OmniSupervisorConfig',
            'OrgSettings': 'Settings',
            'PathAssistant': 'PathAssistant',
            'PermissionSet': 'PermissionSet',
            'PermissionSetGroup': 'PermissionSetGroup',
            'PresenceUserConfig': 'PresenceUserConfig',
            'Profile': 'Profile',
            'Queue': 'Queue',
            'QueueRoutingConfig': 'QueueRoutingConfig',
            'QuickAction': 'QuickAction',
            'RecordType': 'RecordType',
            'Role': 'Role',
            'SearchCustomization': 'SearchCustomization',
            'ServiceChannel': 'ServiceChannel',
            'ServicePresenceStatus': 'ServicePresenceStatus',
            'SharingRules': 'SharingRules',
            'Site': 'CustomSite',
            'StandardValueSet': 'StandardValueSet',
            'StandardValueSetTranslation': 'StandardValueSetTranslation',
            'StaticResource': 'StaticResource',
            'Translations': 'Translations',
            'ValidationRule': 'ValidationRule',
            'VisualforceComponent': 'ApexComponent',
            'VisualforcePage': 'ApexPage',
            'WebLink': 'WebLink',
            'WorkflowRule': 'Workflow',
        }

        for mtype, members in sorted(components_by_type.items()):
            api_name = type_mapping.get(mtype, mtype)
            xml_lines.append('    <types>')
            for member in sorted(members):
                xml_lines.append(f'        <members>{member}</members>')
            xml_lines.append(f'        <name>{api_name}</name>')
            xml_lines.append('    </types>')

        xml_lines.append('    <version>65.0</version>')
        xml_lines.append('</Package>')

        return '\n'.join(xml_lines)

    def scan_for_unknown_types(self):
        """Detecta tipos de metadata no implementados en el analyzer"""
        unknown_types = []

        # Lista de directorios implementados
        implemented_dirs = {
            'classes', 'triggers', 'aura', 'bots', 'brandingSets',
            'channelLayouts', 'contentassets', 'corsWhitelistOrigins',
            'cspTrustedSites', 'customMetadata', 'customPermissions',
            'datacategorygroups', 'dataPackageKitDefinitions', 'DataPackageKitObjects',
            'dataSourceObjects', 'delegateGroups', 'digitalExperienceConfigs',
            'digitalExperiences', 'documents', 'email', 'EmbeddedServiceConfig',
            'entitlementProcesses', 'externalCredentials', 'flexipages', 'flows',
            'genAiFunctions', 'genAiPlannerBundles', 'genAiPlugins', 'genAiPromptTemplates',
            'globalValueSets', 'groups', 'labels', 'layouts', 'lwc',
            'messagingChannels', 'milestoneTypes', 'mutingpermissionsets',
            'namedCredentials', 'networkBranding', 'networks', 'notificationtypes',
            'objectTranslations', 'objects', 'omniSupervisorConfigs', 'pages',
            'pathAssistants', 'permissionsetgroups', 'permissionsets',
            'presenceUserConfigs', 'profiles', 'queueRoutingConfigs', 'queues',
            'quickActions', 'roles', 'searchCustomizations', 'serviceChannels',
            'servicePresenceStatuses', 'settings', 'sharingRules', 'sites',
            'standardValueSetTranslations', 'standardValueSets', 'staticresources',
            'testSuites', 'translations', 'workflows', 'applications', 'components'
        }

        for dir_path in self.metadata_path.iterdir():
            if not dir_path.is_dir():
                continue

            dir_name = dir_path.name

            # ¿Este directorio NO está implementado?
            if dir_name not in implemented_dirs:
                # Contar archivos
                files = list(dir_path.glob('*.*-meta.xml'))
                if not files:
                    # Podría ser un directorio contenedor
                    files = [f for f in dir_path.rglob('*.*-meta.xml')]

                if files:
                    # Intentar inferir el tipo
                    sample = files[0]
                    inferred_type = self._infer_type_from_filename(sample.name)

                    unknown_types.append({
                        'directory': dir_name,
                        'inferred_type': inferred_type,
                        'count': len(files),
                        'sample': sample.name
                    })

        return unknown_types

    def _infer_type_from_filename(self, filename):
        """Inferir tipo de metadata de la extensión del archivo"""
        if '.' not in filename:
            return 'Unknown'

        parts = filename.split('.')
        if len(parts) >= 2:
            extension = parts[-2]  # Tomar el penúltimo (antes de -meta.xml)

            # Capitalizar y remover guiones
            type_name = ''.join(word.capitalize() for word in extension.split('-'))
            return type_name

        return 'Unknown'

    def _calculate_max_depth(self, node, visited=None):
        """Calcula la profundidad máxima de un nodo en el grafo de dependencias"""
        if visited is None:
            visited = set()

        node_key = f"{node.metadata_type}.{node.name}"
        if node_key in visited:
            return 0  # Evitar ciclos

        visited.add(node_key)

        if not node.dependencies:
            return 0

        max_dep_depth = 0
        for dep_key in node.dependencies:
            # Buscar el nodo dependencia en el diccionario
            if dep_key in self.nodes:
                dep_node = self.nodes[dep_key]
                dep_depth = self._calculate_max_depth(dep_node, visited.copy())
                max_dep_depth = max(max_dep_depth, dep_depth)

        return max_dep_depth + 1

    def post_analysis_report(self):
        """Genera reporte post-análisis con sugerencias de mejora"""

        print("\n" + "="*60)
        print("🔍 POST-ANALYSIS CHECKS")
        print("="*60)

        # 1. Tipos no implementados
        unknown = self.scan_for_unknown_types()
        if unknown:
            print(f"\n⚠️  TIPOS NO IMPLEMENTADOS ({len(unknown)}):")
            for ut in unknown:
                print(f"\n   📦 {ut['directory']}")
                print(f"      Tipo inferido: {ut['inferred_type']}")
                print(f"      Componentes: {ut['count']}")
                print(f"      Ejemplo: {ut['sample']}")
                print(f"      👉 Acción: Implementar _analyze_{ut['directory']}()")
        else:
            print("\n✅ Todos los directorios están implementados")

        # 2. Componentes aislados (sin dependencias)
        isolated = [n for n in self.nodes.values()
                    if len(n.dependencies) == 0 and len(n.dependents) == 0]

        # Filtrar tipos que naturalmente no tienen dependencias
        natural_isolated = {'GlobalValueSet', 'CustomLabels', 'Translation',
                          'OrgSettings', 'CorsWhitelistOrigin', 'CspTrustedSite'}
        suspicious = [n for n in isolated if n.metadata_type not in natural_isolated]

        if len(suspicious) > 10:
            print(f"\n⚠️  COMPONENTES AISLADOS ({len(suspicious)}):")
            print("   Estos componentes no tienen dependencias detectadas.")
            print("   Podría indicar patterns de dependencias no capturados.")
            print(f"\n   Top 10:")
            for node in suspicious[:10]:
                print(f"     • {node.metadata_type}.{node.name}")
        elif len(suspicious) > 0:
            print(f"\n✅ Solo {len(suspicious)} componentes aislados (normal)")
        else:
            print("\n✅ Todos los componentes tienen dependencias detectadas")

        # 3. Validar DEPLOY_ORDER
        print(f"\n✅ VALIDACIÓN DEPLOY_ORDER:")

        # Calcular profundidad real de cada tipo
        type_depths = {}
        for node in self.nodes.values():
            depth = self._calculate_max_depth(node)
            if node.metadata_type not in type_depths:
                type_depths[node.metadata_type] = []
            type_depths[node.metadata_type].append(depth)

        # Comparar con DEPLOY_ORDER configurado
        mismatches = []
        for type_name, depths in type_depths.items():
            if type_name in MetadataType.DEPLOY_ORDER:
                configured = MetadataType.DEPLOY_ORDER[type_name]
                actual_max = max(depths)
                actual_avg = sum(depths) / len(depths)

                # Si la profundidad real es mayor que la configurada, hay problema
                if actual_max > configured + 2:  # Margen de 2
                    mismatches.append({
                        'type': type_name,
                        'configured': configured,
                        'actual_max': actual_max,
                        'actual_avg': actual_avg
                    })

        if mismatches:
            print(f"\n   ⚠️  Tipos con orden subóptimo ({len(mismatches)}):")
            for mm in mismatches:
                print(f"     • {mm['type']}")
                print(f"       Configurado: {mm['configured']}")
                print(f"       Real (max): {mm['actual_max']:.1f}")
                print(f"       Sugerido: {int(mm['actual_max']) + 1}")
        else:
            print("   ✅ Todos los tipos tienen orden apropiado")

        # 4. Guardar reporte JSON
        report = {
            'timestamp': datetime.now().isoformat(),
            'unknown_types': unknown,
            'isolated_components_count': len(suspicious),
            'isolated_components_sample': [
                f"{n.metadata_type}.{n.name}" for n in suspicious[:20]
            ],
            'deploy_order_mismatches': mismatches,
            'stats': {
                'total_components': len(self.nodes),
                'total_dependencies': sum(len(n.dependencies) for n in self.nodes.values()),
                'types_analyzed': len(set(n.metadata_type for n in self.nodes.values()))
            }
        }

        report_path = Path('analyzer_health_report.json')
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)

        print(f"\n💾 Reporte de salud guardado en: {report_path}")
        print("="*60)


def main():
    parser = argparse.ArgumentParser(
        description='Analizador de Dependencias de Salesforce para CI/CD'
    )
    parser.add_argument(
        '--project-path',
        default='.',
        help='Ruta al proyecto de Salesforce (default: directorio actual)'
    )
    parser.add_argument(
        '--output',
        default='dependency_report.json',
        help='Archivo de salida para el reporte JSON'
    )
    parser.add_argument(
        '--generate-manifests',
        action='store_true',
        help='Generar manifests de despliegue por ola'
    )
    parser.add_argument(
        '--manifests-dir',
        default='deployment_manifests',
        help='Directorio para los manifests generados'
    )

    args = parser.parse_args()

    print("🚀 Salesforce Dependency Analyzer")
    print("="*60)

    analyzer = SalesforceDependencyAnalyzer(args.project_path)
    analyzer.analyze()
    analyzer.print_summary()
    analyzer.save_report(args.output)

    if args.generate_manifests:
        analyzer.generate_deployment_manifest(args.manifests_dir)

    print("\n✅ Análisis completado!")


if __name__ == '__main__':
    main()

