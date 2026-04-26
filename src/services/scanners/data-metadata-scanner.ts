import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { glob as globAsync } from 'glob';
import {
  groupCustomMetadataWithRecords,
  parseCustomMetadataRecord,
  parseCustomMetadataType,
} from '../../parsers/custom-metadata-parser.js';
import { parseCustomObject } from '../../parsers/custom-object-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';

export async function parseCustomObjectComponent(objectDir: string): Promise<MetadataComponent | undefined> {
  const objectName = path.basename(objectDir);
  const objectFile = path.join(objectDir, `${objectName}.object-meta.xml`);

  try {
    await fs.access(objectFile);
  } catch {
    return undefined;
  }

  const content = await fs.readFile(objectFile, 'utf-8');
  const parsed = await parseCustomObject(objectName, content);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    if (
      (dependency.type === 'lookup_field' || dependency.type === 'master_detail_field') &&
      dependency.referencedObject
    ) {
      deps.add(dependency.referencedObject);
    }
  });

  return {
    name: objectName,
    type: 'CustomObject' as const,
    filePath: objectFile,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseCustomMetadataComponents(cmtDir: string): Promise<MetadataComponent[]> {
  const typeName = path.basename(cmtDir);
  const typeFile = path.join(cmtDir, `${typeName}.md-meta.xml`);

  const content = await fs.readFile(typeFile, 'utf-8');
  const parsedType = await parseCustomMetadataType(typeName, content);
  const recordFiles = (
    await globAsync(path.join(cmtDir, '*.md'), {
      absolute: true,
    })
  ).filter((recordFile) => path.basename(recordFile) !== path.basename(typeFile));
  const records = await Promise.all(
    recordFiles.map(async (recordFile) => {
      const recordContent = await fs.readFile(recordFile, 'utf-8');
      const recordName = path.basename(recordFile, '.md');
      return parseCustomMetadataRecord(recordName, recordContent);
    })
  );
  const grouped = groupCustomMetadataWithRecords(parsedType, records);

  const deps = new Set<string>();
  for (const dependency of grouped.dependencies) {
    switch (dependency.type) {
      case 'relationship_field':
      case 'lookup_reference':
        if (dependency.referencedObject) {
          deps.add(dependency.referencedObject);
        }
        break;
      case 'record':
        deps.add(`CustomMetadataRecord:${dependency.name}`);
        break;
      default:
        break;
    }
  }

  return [
    {
      name: typeName,
      type: 'CustomMetadata' as const,
      filePath: typeFile,
      dependencies: deps,
      dependents: new Set<string>(),
      priorityBoost: 0,
    },
    ...grouped.records.map((record) => ({
      name: record.fullName,
      type: 'CustomMetadataRecord' as const,
      filePath: path.join(cmtDir, `${record.fullName}.md`),
      dependencies: new Set<string>([`CustomMetadata:${typeName}`]),
      dependents: new Set<string>(),
      priorityBoost: 0,
    })),
  ];
}
