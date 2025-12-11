/**
 * Test Fixtures - US-068
 * Realistic test fixtures for comprehensive testing
 *
 * @ac US-068-AC-1: Sample Salesforce projects
 * @ac US-068-AC-2: Various project structures
 * @ac US-068-AC-3: Edge case scenarios
 * @ac US-068-AC-4: Large project samples (1000+ files)
 * @ac US-068-AC-5: Corrupted file samples
 * @ac US-068-AC-6: Circular dependency samples
 * @issue #68
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { getLogger } from '../../src/utils/logger.js';

const logger = getLogger('ProjectFixtures');

export interface ProjectFixture {
  name: string;
  description: string;
  structure: ProjectStructure;
  metadataFiles: string[];
  expectedComponents: number;
  expectedDependencies: number;
  hasCircularDependencies: boolean;
  hasCorruptedFiles: boolean;
}

export interface ProjectStructure {
  root: string;
  packageDirs: string[];
  metadataTypes: string[];
  fileCount: number;
}

/**
 * @ac US-068-AC-1: Sample Salesforce projects
 * @ac US-068-AC-2: Various project structures
 */
export class ProjectFixtures {
  private readonly fixturesDir = path.join(process.cwd(), 'test/fixtures/projects');

  /**
   * @ac US-068-AC-1: Sample Salesforce projects
   * Create standard SFDX project fixture
   */
  public async createStandardProject(name: string): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);

    await fs.mkdir(projectPath, { recursive: true });

    // Create sfdx-project.json
    const sfdxProject = {
      packageDirectories: [
        {
          path: 'force-app',
          default: true,
        },
      ],
      sourceApiVersion: '61.0',
    };

    await fs.writeFile(
      path.join(projectPath, 'sfdx-project.json'),
      JSON.stringify(sfdxProject, null, 2),
      'utf-8'
    );

    // Create basic structure
    const forceAppPath = path.join(projectPath, 'force-app/main/default');
    await fs.mkdir(path.join(forceAppPath, 'classes'), { recursive: true });
    await fs.mkdir(path.join(forceAppPath, 'triggers'), { recursive: true });
    await fs.mkdir(path.join(forceAppPath, 'objects'), { recursive: true });

    // Create sample metadata files
    const metadataFiles: string[] = [];

    // Sample Apex Class
    const apexClassPath = path.join(forceAppPath, 'classes/TestClass.cls');
    await fs.writeFile(apexClassPath, 'public class TestClass {}', 'utf-8');
    metadataFiles.push(apexClassPath);

    const apexClassMetaPath = path.join(forceAppPath, 'classes/TestClass.cls-meta.xml');
    await fs.writeFile(
      apexClassMetaPath,
      `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>61.0</apiVersion>
    <status>Active</status>
</ApexClass>`,
      'utf-8'
    );
    metadataFiles.push(apexClassMetaPath);

    logger.info('Standard project fixture created', { name, projectPath });

    return {
      name,
      description: 'Standard SFDX project structure',
      structure: {
        root: projectPath,
        packageDirs: ['force-app'],
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: 1,
      expectedDependencies: 0,
      hasCircularDependencies: false,
      hasCorruptedFiles: false,
    };
  }

  /**
   * @ac US-068-AC-3: Edge case scenarios
   * Create project with edge cases
   */
  public async createEdgeCaseProject(name: string): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);
    await fs.mkdir(projectPath, { recursive: true });

    const metadataFiles: string[] = [];

    // Create project with:
    // - Empty directories
    // - Files without metadata
    // - Nested structures
    // - Special characters in names

    const forceAppPath = path.join(projectPath, 'force-app/main/default');
    await fs.mkdir(path.join(forceAppPath, 'classes'), { recursive: true });
    await fs.mkdir(path.join(forceAppPath, 'empty-dir'), { recursive: true });

    // File with special characters
    const specialClassPath = path.join(forceAppPath, 'classes/Test_Class__c.cls');
    await fs.writeFile(specialClassPath, 'public class Test_Class__c {}', 'utf-8');
    metadataFiles.push(specialClassPath);

    logger.info('Edge case project fixture created', { name });

    return {
      name,
      description: 'Project with edge cases',
      structure: {
        root: projectPath,
        packageDirs: ['force-app'],
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: 1,
      expectedDependencies: 0,
      hasCircularDependencies: false,
      hasCorruptedFiles: false,
    };
  }

  /**
   * @ac US-068-AC-4: Large project samples (1000+ files)
   * Create large project fixture
   */
  public async createLargeProject(name: string, fileCount: number = 1000): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);
    await fs.mkdir(projectPath, { recursive: true });

    const metadataFiles: string[] = [];
    const forceAppPath = path.join(projectPath, 'force-app/main/default');
    await fs.mkdir(path.join(forceAppPath, 'classes'), { recursive: true });

    // Generate many files
    for (let i = 0; i < fileCount; i++) {
      const className = `TestClass${i}`;
      const classPath = path.join(forceAppPath, `classes/${className}.cls`);
      await fs.writeFile(classPath, `public class ${className} {}`, 'utf-8');
      metadataFiles.push(classPath);

      const metaPath = path.join(forceAppPath, `classes/${className}.clsm-meta.xml`);
      await fs.writeFile(
        metaPath,
        `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>61.0</apiVersion>
    <status>Active</status>
</ApexClass>`,
        'utf-8'
      );
      metadataFiles.push(metaPath);
    }

    logger.info('Large project fixture created', { name, fileCount });

    return {
      name,
      description: `Large project with ${fileCount} files`,
      structure: {
        root: projectPath,
        packageDirs: ['force-app'],
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: fileCount,
      expectedDependencies: 0,
      hasCircularDependencies: false,
      hasCorruptedFiles: false,
    };
  }

  /**
   * @ac US-068-AC-5: Corrupted file samples
   * Create project with corrupted files
   */
  public async createCorruptedProject(name: string): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);
    await fs.mkdir(projectPath, { recursive: true });

    const metadataFiles: string[] = [];
    const forceAppPath = path.join(projectPath, 'force-app/main/default');
    await fs.mkdir(path.join(forceAppPath, 'classes'), { recursive: true });

    // Valid file
    const validPath = path.join(forceAppPath, 'classes/ValidClass.cls');
    await fs.writeFile(validPath, 'public class ValidClass {}', 'utf-8');
    metadataFiles.push(validPath);

    // Corrupted XML metadata
    const corruptedMetaPath = path.join(forceAppPath, 'classes/CorruptedClass.cls-meta.xml');
    await fs.writeFile(corruptedMetaPath, '<?xml version="1.0"?><ApexClass><unclosed>', 'utf-8');
    metadataFiles.push(corruptedMetaPath);

    // Invalid Apex syntax
    const invalidApexPath = path.join(forceAppPath, 'classes/InvalidClass.cls');
    await fs.writeFile(invalidApexPath, 'public class InvalidClass {', 'utf-8');
    metadataFiles.push(invalidApexPath);

    logger.info('Corrupted project fixture created', { name });

    return {
      name,
      description: 'Project with corrupted files',
      structure: {
        root: projectPath,
        packageDirs: ['force-app'],
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: 1,
      expectedDependencies: 0,
      hasCircularDependencies: false,
      hasCorruptedFiles: true,
    };
  }

  /**
   * @ac US-068-AC-6: Circular dependency samples
   * Create project with circular dependencies
   */
  public async createCircularDependencyProject(name: string): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);
    await fs.mkdir(projectPath, { recursive: true });

    const metadataFiles: string[] = [];
    const forceAppPath = path.join(projectPath, 'force-app/main/default');
    await fs.mkdir(path.join(forceAppPath, 'classes'), { recursive: true });

    // Class A depends on Class B
    const classAPath = path.join(forceAppPath, 'classes/ClassA.cls');
    await fs.writeFile(
      classAPath,
      'public class ClassA { public ClassB b; }',
      'utf-8'
    );
    metadataFiles.push(classAPath);

    // Class B depends on Class A (circular!)
    const classBPath = path.join(forceAppPath, 'classes/ClassB.cls');
    await fs.writeFile(
      classBPath,
      'public class ClassB { public ClassA a; }',
      'utf-8'
    );
    metadataFiles.push(classBPath);

    // Class C → Class D → Class E → Class C (3-way cycle)
    const classCPath = path.join(forceAppPath, 'classes/ClassC.cls');
    await fs.writeFile(classCPath, 'public class ClassC { public ClassD d; }', 'utf-8');
    metadataFiles.push(classCPath);

    const classDPath = path.join(forceAppPath, 'classes/ClassD.cls');
    await fs.writeFile(classDPath, 'public class ClassD { public ClassE e; }', 'utf-8');
    metadataFiles.push(classDPath);

    const classEPath = path.join(forceAppPath, 'classes/ClassE.cls');
    await fs.writeFile(classEPath, 'public class ClassE { public ClassC c; }', 'utf-8');
    metadataFiles.push(classEPath);

    logger.info('Circular dependency project fixture created', { name });

    return {
      name,
      description: 'Project with circular dependencies',
      structure: {
        root: projectPath,
        packageDirs: ['force-app'],
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: 5,
      expectedDependencies: 5,
      hasCircularDependencies: true,
      hasCorruptedFiles: false,
    };
  }

  /**
   * Create monorepo fixture
   */
  public async createMonorepoProject(name: string): Promise<ProjectFixture> {
    const projectPath = path.join(this.fixturesDir, name);
    await fs.mkdir(projectPath, { recursive: true });

    const metadataFiles: string[] = [];

    // Create multiple SFDX projects
    const projects = ['project-a', 'project-b', 'project-c'];

    for (const projectName of projects) {
      const projectDir = path.join(projectPath, projectName);
      await fs.mkdir(projectDir, { recursive: true });

      // Create sfdx-project.json for each
      const sfdxProject = {
        packageDirectories: [
          {
            path: 'force-app',
            default: true,
          },
        ],
        sourceApiVersion: '61.0',
      };

      await fs.writeFile(
        path.join(projectDir, 'sfdx-project.json'),
        JSON.stringify(sfdxProject, null, 2),
        'utf-8'
      );

      // Create sample class
      const forceAppPath = path.join(projectDir, 'force-app/main/default/classes');
      await fs.mkdir(forceAppPath, { recursive: true });

      const classPath = path.join(forceAppPath, `${projectName}Class.cls`);
      await fs.writeFile(classPath, `public class ${projectName}Class {}`, 'utf-8');
      metadataFiles.push(classPath);
    }

    logger.info('Monorepo project fixture created', { name, projects: projects.length });

    return {
      name,
      description: 'Monorepo with multiple SFDX projects',
      structure: {
        root: projectPath,
        packageDirs: projects.map((p) => `${p}/force-app`),
        metadataTypes: ['ApexClass'],
        fileCount: metadataFiles.length,
      },
      metadataFiles,
      expectedComponents: projects.length,
      expectedDependencies: 0,
      hasCircularDependencies: false,
      hasCorruptedFiles: false,
    };
  }

  /**
   * Clean up fixtures
   */
  public async cleanup(): Promise<void> {
    try {
      await fs.rm(this.fixturesDir, { recursive: true, force: true });
      logger.info('Test fixtures cleaned up');
    } catch (error) {
      logger.warn('Failed to cleanup fixtures', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get fixture path
   */
  public getFixturePath(fixtureName: string): string {
    return path.join(this.fixturesDir, fixtureName);
  }
}

