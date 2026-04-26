import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseEmailTemplate } from '../../parsers/email-template-parser.js';
import { parseFlexiPage } from '../../parsers/flexipage-parser.js';
import { parseLayout } from '../../parsers/layout-parser.js';
import { parseVisualforce } from '../../parsers/visualforce-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';

function addAll(target: Set<string>, values: Iterable<string>, defaultType?: string): void {
  for (const value of values) {
    target.add(defaultType && !value.includes(':') ? `${defaultType}:${value}` : value);
  }
}

export async function parseLayoutComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const layoutName = path.basename(filePath, '.layout-meta.xml');
  const parsed = await parseLayout(filePath, layoutName);

  const deps = new Set<string>();
  const optionalDependencies = new Set<string>();
  deps.add(parsed.object);
  addAll(deps, parsed.relatedObjects);
  addAll(deps, parsed.fields);
  addAll(deps, parsed.relatedLists);
  addAll(deps, parsed.customButtons);
  addAll(deps, parsed.visualforcePages, 'VisualforcePage');
  addAll(deps, parsed.quickActions, 'QuickAction');
  addAll(deps, parsed.canvasApps);
  addAll(deps, parsed.customLinks, 'WebLink');
  addAll(optionalDependencies, parsed.optionalDependencies.customButtons);
  addAll(optionalDependencies, parsed.optionalDependencies.visualforcePages, 'VisualforcePage');
  addAll(optionalDependencies, parsed.optionalDependencies.quickActions, 'QuickAction');
  addAll(optionalDependencies, parsed.optionalDependencies.canvasApps);
  addAll(optionalDependencies, parsed.optionalDependencies.customLinks, 'WebLink');

  return {
    name: layoutName,
    type: 'Layout' as const,
    filePath,
    dependencies: deps,
    optionalDependencies,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseFlexiPageComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const flexipageName = path.basename(filePath, '.flexipage-meta.xml');
  const parsed = await parseFlexiPage(filePath, flexipageName);

  const deps = new Set<string>();
  addAll(deps, parsed.lwcComponents);
  addAll(deps, parsed.auraComponents);
  addAll(deps, parsed.objects);
  addAll(deps, parsed.recordTypeFilters, 'RecordType');
  addAll(deps, parsed.quickActions, 'QuickAction');

  return {
    name: flexipageName,
    type: 'FlexiPage' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseEmailTemplateComponent(
  filePath: string,
  fileExists: (filePath: string) => Promise<boolean>
): Promise<MetadataComponent | undefined> {
  const templateName = path.basename(filePath, '.email-meta.xml');
  const metadataContent = await fs.readFile(filePath, 'utf-8');
  const bodyPath = filePath.replace(/\.email-meta\.xml$/, '');
  const templateContent = (await fileExists(bodyPath)) ? await fs.readFile(bodyPath, 'utf-8') : metadataContent;
  const parsed = await parseEmailTemplate(templateName, templateContent, metadataContent);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    switch (dependency.type) {
      case 'visualforce_page':
        deps.add(`VisualforcePage:${dependency.name}`);
        break;
      case 'related_entity':
        deps.add(dependency.name);
        break;
      case 'merge_field':
        if (dependency.objectName) {
          deps.add(dependency.objectName);
        }
        break;
      default:
        break;
    }
  });

  return {
    name: templateName,
    type: 'EmailTemplate' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseVisualforceComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const content = await fs.readFile(filePath, 'utf-8');
  const fileName = path.basename(filePath);
  const parsed = parseVisualforce(fileName, content);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    switch (dependency.type) {
      case 'apex_controller':
      case 'apex_extension':
        deps.add(`ApexClass:${dependency.name}`);
        break;
      case 'standard_controller':
        deps.add(dependency.name);
        break;
      case 'vf_component':
        deps.add(`VisualforceComponent:${dependency.name}`);
        break;
      default:
        break;
    }
  });

  const componentType: 'VisualforcePage' | 'VisualforceComponent' =
    parsed.type === 'page' ? 'VisualforcePage' : 'VisualforceComponent';

  return {
    name: parsed.name,
    type: componentType,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}
