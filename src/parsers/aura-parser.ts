import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { AuraComponentMetadata, AuraComponentType } from '../types/salesforce/aura.js';

const logger = getLogger('AuraParser');

/**
 * Aura dependency types
 */
export type AuraDependencyType = 'apex_controller' | 'child_component' | 'event' | 'interface' | 'extends' | 'helper';

/**
 * Represents a dependency found in an Aura component
 */
export type AuraDependency = {
  type: AuraDependencyType;
  name: string;
  namespace?: string;
};

/**
 * Result of parsing an Aura component
 * Optionally includes metadata from .cmp-meta.xml, .app-meta.xml, etc.
 */
export type AuraParseResult = {
  componentName: string;
  componentType: AuraComponentType;
  apexController?: string;
  extendsComponent?: string;
  implementsInterfaces: string[];
  childComponents: string[];
  events: string[];
  dependencies: AuraDependency[];
  hasController: boolean;
  hasHelper: boolean;
  hasStyle: boolean;
  metadata?: AuraComponentMetadata;
};

/**
 * Extract Apex controller from component markup
 *
 * @ac US-017-AC-1: Extract controller Apex class
 */
function extractApexController(cmpXml: string): string | undefined {
  // Pattern: controller="MyController" or controller="ns__MyController"
  const controllerMatch = cmpXml.match(/controller\s*=\s*["']([a-zA-Z][a-zA-Z0-9_.]*?)["']/);
  return controllerMatch ? controllerMatch[1] : undefined;
}

/**
 * Extract component extends relationship
 *
 * @ac US-017-AC-5: Extract interface implementations (also handles extends)
 */
function extractExtends(cmpXml: string): string | undefined {
  // Pattern: extends="c:BaseComponent" or extends="namespace:BaseComponent"
  const extendsMatch = cmpXml.match(/extends\s*=\s*["']([a-zA-Z][a-zA-Z0-9_:]*?)["']/);
  return extendsMatch ? extendsMatch[1] : undefined;
}

/**
 * Extract interface implementations
 *
 * @ac US-017-AC-5: Extract interface implementations
 */
function extractImplements(cmpXml: string): string[] {
  // Pattern: implements="flexipage:availableForAllPageTypes,force:hasRecordId"
  const implementsMatch = cmpXml.match(/implements\s*=\s*["']([^"']+)["']/);
  if (!implementsMatch) {
    return [];
  }

  return implementsMatch[1]
    .split(',')
    .map((impl) => impl.trim())
    .filter((impl) => impl.length > 0);
}

/**
 * Extract child component references
 *
 * @ac US-017-AC-3: Extract child component references
 */
function extractChildComponents(cmpXml: string): string[] {
  const children: string[] = [];

  // Pattern: <c:ChildComponent ... /> or <namespace:ComponentName ... />
  const componentPattern = /<([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)[^>]*\/>/g;
  const matches = cmpXml.matchAll(componentPattern);

  for (const match of matches) {
    const namespace = match[1];
    const componentName = match[2];

    // Exclude aura: namespace (framework components)
    if (namespace !== 'aura' && namespace !== 'lightning' && namespace !== 'ui' && namespace !== 'force') {
      const fullName = `${namespace}:${componentName}`;
      if (!children.includes(fullName)) {
        children.push(fullName);
      }
    }
  }

  // Also check for non-self-closing tags: <c:ChildComponent>...</c:ChildComponent>
  const openTagPattern = /<([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)[^/>]*>/g;
  const openMatches = cmpXml.matchAll(openTagPattern);

  for (const match of openMatches) {
    const namespace = match[1];
    const componentName = match[2];

    if (namespace !== 'aura' && namespace !== 'lightning' && namespace !== 'ui' && namespace !== 'force') {
      const fullName = `${namespace}:${componentName}`;
      if (!children.includes(fullName)) {
        children.push(fullName);
      }
    }
  }

  return children;
}

/**
 * Extract event references
 *
 * @ac US-017-AC-4: Extract event references
 */
function extractEvents(cmpXml: string): string[] {
  const events: string[] = [];

  // Pattern: <aura:registerEvent name="myEvent" type="c:MyEvent"/>
  const registerPattern = /<aura:registerEvent[^>]*type\s*=\s*["']([a-zA-Z][a-zA-Z0-9_:]*?)["']/g;
  const registerMatches = cmpXml.matchAll(registerPattern);

  for (const match of registerMatches) {
    const eventType = match[1];
    if (!events.includes(eventType)) {
      events.push(eventType);
    }
  }

  // Pattern: <aura:handler event="c:MyEvent" action="{!c.handleEvent}"/>
  const handlerPattern = /<aura:handler[^>]*event\s*=\s*["']([a-zA-Z][a-zA-Z0-9_:]*?)["']/g;
  const handlerMatches = cmpXml.matchAll(handlerPattern);

  for (const match of handlerMatches) {
    const eventType = match[1];
    if (!events.includes(eventType)) {
      events.push(eventType);
    }
  }

  return events;
}

/**
 * Determine component type from XML
 */
function getComponentType(cmpXml: string): 'component' | 'application' | 'event' | 'interface' {
  if (cmpXml.includes('<aura:application')) {
    return 'application';
  }
  if (cmpXml.includes('<aura:event')) {
    return 'event';
  }
  if (cmpXml.includes('<aura:interface')) {
    return 'interface';
  }
  return 'component';
}

/**
 * Parse an Aura component and extract dependencies
 *
 * @param componentName - Name of the Aura component
 * @param cmpContent - Content of the .cmp file
 * @param hasController - Whether the component has a controller.js file
 * @param hasHelper - Whether the component has a helper.js file
 * @param hasStyle - Whether the component has a style.css file
 * @returns AuraParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the component cannot be parsed
 *
 * @ac US-017-AC-6: Validate bundle structure
 * @ac US-017-AC-7: Parse all bundle files (.cmp, .js, .css, etc.)
 *
 * @example
 * ```typescript
 * const result = parseAura('MyComponent', cmpContent, true, true, false);
 * console.log(result.apexController); // 'MyController'
 * console.log(result.childComponents); // ['c:ChildComponent']
 * console.log(result.events); // ['c:MyEvent']
 * ```
 */
export function parseAura(
  componentName: string,
  cmpContent: string,
  hasController = false,
  hasHelper = false,
  hasStyle = false
): AuraParseResult {
  try {
    logger.debug(`Parsing Aura component: ${componentName}`);

    // Determine component type
    const componentType = getComponentType(cmpContent);

    // Extract dependencies
    const apexController = extractApexController(cmpContent);
    const extendsComponent = extractExtends(cmpContent);
    const implementsInterfaces = extractImplements(cmpContent);
    const childComponents = extractChildComponents(cmpContent);
    const events = extractEvents(cmpContent);

    // Build dependencies array
    const dependencies: AuraDependency[] = [];

    if (apexController) {
      dependencies.push({
        type: 'apex_controller',
        name: apexController,
        namespace: apexController.includes('__') ? apexController.split('__')[0] : undefined,
      });
    }

    if (extendsComponent) {
      dependencies.push({
        type: 'extends',
        name: extendsComponent,
        namespace: extendsComponent.includes(':') ? extendsComponent.split(':')[0] : undefined,
      });
    }

    for (const iface of implementsInterfaces) {
      dependencies.push({
        type: 'interface',
        name: iface,
        namespace: iface.includes(':') ? iface.split(':')[0] : undefined,
      });
    }

    for (const child of childComponents) {
      dependencies.push({
        type: 'child_component',
        name: child,
        namespace: child.includes(':') ? child.split(':')[0] : undefined,
      });
    }

    for (const event of events) {
      dependencies.push({
        type: 'event',
        name: event,
        namespace: event.includes(':') ? event.split(':')[0] : undefined,
      });
    }

    if (hasHelper) {
      dependencies.push({
        type: 'helper',
        name: `${componentName}Helper`,
      });
    }

    const result: AuraParseResult = {
      componentName,
      componentType,
      apexController,
      extendsComponent,
      implementsInterfaces,
      childComponents,
      events,
      dependencies,
      hasController,
      hasHelper,
      hasStyle,
    };

    logger.debug(`Parsed Aura component: ${componentName}`, {
      componentType,
      apexController: !!apexController,
      extendsComponent: !!extendsComponent,
      implementsInterfaces: implementsInterfaces.length,
      childComponents: childComponents.length,
      events: events.length,
      dependencies: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Aura component: ${componentName}`, {
      filePath: componentName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
