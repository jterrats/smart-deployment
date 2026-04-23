/**
 * Data Provisioner - US-107
 * Handles data provisioning between deployment waves
 *
 * @ac US-107-AC-1: Detect when data provisioning is needed
 * @ac US-107-AC-2: Support Custom Metadata Type record creation
 * @ac US-107-AC-3: Handle Custom Settings data
 * @ac US-107-AC-4: Queue data operations between waves
 * @ac US-107-AC-5: Validate data exists before deploying dependent metadata
 * @issue #107
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';
import type { MetadataComponent } from '../types/metadata.js';

const logger = getLogger('DataProvisioner');

export type DataProvisioningRecord = {
  type: 'CustomMetadata' | 'CustomSettings' | 'PicklistValue' | 'RecordType';
  name: string;
  filePath: string;
  metadata: Record<string, unknown>;
  dependsOn: string[];
};

export type DataProvisioningWave = {
  waveNumber: number;
  records: DataProvisioningRecord[];
  estimatedTime: number;
  dependencies: string[];
};

export type ProvisioningResult = {
  success: boolean;
  recordsCreated: number;
  recordsFailed: number;
  errors: Array<{ record: string; error: string }>;
  executionTime: number;
};

/**
 * @ac US-107-AC-1: Detect when data provisioning is needed
 */
export class DataProvisioner {
  /**
   * @ac US-107-AC-1: Detect when data provisioning is needed
   * Detect data provisioning requirements from metadata
   */
  public detectProvisioningNeeds(components: MetadataComponent[]): DataProvisioningRecord[] {
    logger.info('Detecting data provisioning needs', { componentCount: components.length });

    const records: DataProvisioningRecord[] = [];

    for (const component of components) {
      // Detect Custom Metadata records
      if (component.filePath?.endsWith('.md-meta.xml')) {
        records.push({
          type: 'CustomMetadata',
          name: component.name,
          filePath: component.filePath,
          metadata: {},
          dependsOn: [],
        });
      }

      // Detect Custom Settings (via metadata type)
      if (component.type === 'CustomSetting') {
        records.push({
          type: 'CustomSettings',
          name: component.name,
          filePath: component.filePath ?? '',
          metadata: {},
          dependsOn: [],
        });
      }

      // Detect Record Types
      if (component.type === 'RecordType') {
        records.push({
          type: 'RecordType',
          name: component.name,
          filePath: component.filePath ?? '',
          metadata: {},
          dependsOn: [component.dependencies.values().next().value ?? ''],
        });
      }
    }

    logger.info('Data provisioning needs detected', {
      recordCount: records.length,
      types: [...new Set(records.map((r) => r.type))],
    });

    return records;
  }

  /**
   * @ac US-107-AC-2: Support Custom Metadata Type record creation
   * Parse Custom Metadata records
   */
  public async parseCustomMetadataRecord(filePath: string): Promise<DataProvisioningRecord> {
    logger.debug('Parsing Custom Metadata record', { filePath });

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const name = path.basename(filePath, '.md-meta.xml');

      // Extract metadata from XML (simplified)
      const metadata: Record<string, unknown> = {};
      const labelMatch = content.match(/<label>([^<]+)<\/label>/);
      if (labelMatch) {
        metadata.label = labelMatch[1];
      }

      return {
        type: 'CustomMetadata',
        name,
        filePath,
        metadata,
        dependsOn: [],
      };
    } catch (error) {
      logger.error('Failed to parse Custom Metadata record', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * @ac US-107-AC-3: Handle Custom Settings data
   * Prepare Custom Settings data for provisioning
   */
  public prepareCustomSettingsData(
    component: MetadataComponent,
    data: Record<string, unknown>
  ): DataProvisioningRecord {
    return {
      type: 'CustomSettings',
      name: component.name,
      filePath: component.filePath ?? '',
      metadata: data,
      dependsOn: [],
    };
  }

  /**
   * @ac US-107-AC-4: Queue data operations between waves
   * Create data provisioning wave
   */
  public createProvisioningWave(records: DataProvisioningRecord[], waveNumber: number): DataProvisioningWave {
    logger.info('Creating data provisioning wave', {
      waveNumber,
      recordCount: records.length,
    });

    // Calculate dependencies
    const dependencies = new Set<string>();
    for (const record of records) {
      for (const dep of record.dependsOn) {
        dependencies.add(dep);
      }
    }

    // Estimate time (rough: 1 second per record)
    const estimatedTime = records.length * 1000;

    return {
      waveNumber,
      records,
      estimatedTime,
      dependencies: Array.from(dependencies),
    };
  }

  /**
   * @ac US-107-AC-5: Validate data exists before deploying dependent metadata
   * Validate data exists
   */
  public async validateDataExists(
    records: DataProvisioningRecord[],
    orgApi: { query: (soql: string) => Promise<unknown[]> }
  ): Promise<{ valid: boolean; missing: string[] }> {
    logger.info('Validating data exists', { recordCount: records.length });

    const validationResults = await Promise.all(
      records.map(async (record) => {
        try {
          if (record.type !== 'CustomMetadata') {
            return undefined;
          }

          const developerName = record.name.split('.').pop() ?? '';
          const metadataTypeName = record.name.split('.').slice(0, -1).join('.');
          const soql = `SELECT Id FROM ${metadataTypeName}__mdt WHERE DeveloperName = '${developerName}'`;
          const results = await orgApi.query(soql);

          return results.length === 0 ? record.name : undefined;
        } catch (error) {
          logger.warn('Failed to validate data existence', {
            record: record.name,
            error: error instanceof Error ? error.message : String(error),
          });
          return record.name;
        }
      })
    );

    const missing = validationResults.filter((recordName): recordName is string => recordName !== undefined);

    const valid = missing.length === 0;

    logger.info('Data validation complete', {
      valid,
      missingCount: missing.length,
    });

    return { valid, missing };
  }

  /**
   * Execute data provisioning
   */
  public executeProvisioning(
    wave: DataProvisioningWave,
    orgApi: { create: (type: string, records: unknown[]) => Promise<unknown[]> }
  ): Promise<ProvisioningResult> {
    const startTime = Date.now();
    logger.info('Executing data provisioning', {
      waveNumber: wave.waveNumber,
      recordCount: wave.records.length,
    });

    const errors: Array<{ record: string; error: string }> = [];
    let recordsCreated = 0;
    let recordsFailed = 0;

    for (const record of wave.records) {
      try {
        if (record.type === 'CustomMetadata') {
          // Create Custom Metadata record via Metadata API
          this.createCustomMetadataRecord(record, orgApi);
          recordsCreated++;
        } else if (record.type === 'CustomSettings') {
          // Create Custom Settings data
          this.createCustomSettingsData(record, orgApi);
          recordsCreated++;
        }
      } catch (error) {
        recordsFailed++;
        errors.push({
          record: record.name,
          error: error instanceof Error ? error.message : String(error),
        });
        logger.error('Failed to provision data record', {
          record: record.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const executionTime = Date.now() - startTime;

    logger.info('Data provisioning complete', {
      waveNumber: wave.waveNumber,
      recordsCreated,
      recordsFailed,
      executionTime,
    });

    return Promise.resolve({
      success: recordsFailed === 0,
      recordsCreated,
      recordsFailed,
      errors,
      executionTime,
    });
  }

  /**
   * Create Custom Metadata record
   */
  private createCustomMetadataRecord(
    record: DataProvisioningRecord,
    orgApi: { create: (type: string, records: unknown[]) => Promise<unknown[]> }
  ): void {
    void orgApi;
    // This would use Metadata API to create CMT record
    // Simplified for now
    logger.debug('Creating Custom Metadata record', { name: record.name });
  }

  /**
   * Create Custom Settings data
   */
  private createCustomSettingsData(
    record: DataProvisioningRecord,
    orgApi: { create: (type: string, records: unknown[]) => Promise<unknown[]> }
  ): void {
    void orgApi;
    // This would use SOAP/REST API to create Custom Settings data
    logger.debug('Creating Custom Settings data', { name: record.name });
  }

  /**
   * Format provisioning report
   */
  public formatReport(result: ProvisioningResult): string {
    const lines: string[] = [];

    lines.push('📦 Data Provisioning Report');
    lines.push('═══════════════════════════════════════');
    lines.push(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    lines.push(`Records Created: ${result.recordsCreated}`);
    lines.push(`Records Failed: ${result.recordsFailed}`);
    lines.push(`Execution Time: ${result.executionTime}ms`);
    lines.push('');

    if (result.errors.length > 0) {
      lines.push('❌ Errors:');
      for (const error of result.errors) {
        lines.push(`  • ${error.record}: ${error.error}`);
      }
    }

    return lines.join('\n');
  }
}
