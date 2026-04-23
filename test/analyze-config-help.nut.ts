import { expect } from 'chai';
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
} from './helpers/nut-helpers.js';

describe('NUT: analyze, config, and help coverage', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('analyze scans metadata, generates waves, and does not create deployment state', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-project', {
      'force-app/main/default/classes/Base.cls': 'public class Base {}\n',
      'force-app/main/default/classes/Service.cls': [
        'public class Service {',
        '  public void run() {',
        '    Base value = new Base();',
        '    System.debug(value);',
        '  }',
        '}',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; components: number; dependencies: number }>(
      `analyze --source-path ${projectRoot} --json`,
      homeDir
    );
    let stateFileExists = true;
    try {
      await access(path.join(projectRoot, '.smart-deployment/deployment-state.json'), fsConstants.F_OK);
    } catch {
      stateFileExists = false;
    }

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"components": 2');
    expect(stateFileExists).to.equal(false);
  });

  it('analyze saves a deployment plan when requested', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-plan-project', {
      'force-app/main/default/classes/Planner.cls': 'public class Planner {}\n',
    });
    const planPath = path.join(projectRoot, 'output-plan.json');

    const result = execNutCommand<{ success: boolean; planSaved: boolean }>(
      `analyze --source-path ${projectRoot} --save-plan --plan-path ${planPath} --json`,
      homeDir
    );

    const savedPlan = await readFile(planPath, 'utf8');

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"planSaved": true');
    expect(savedPlan).to.include('"waves"');
    expect(savedPlan).to.include('"generatedAt"');
  });

  it('analyze persists AI priority overrides in the saved plan when AI is enabled', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-ai-plan-project', {
      'force-app/main/default/classes/PaymentHandler.cls': 'public class PaymentHandler {}\n',
      'force-app/main/default/classes/LogService.cls': 'public class LogService {}\n',
    });
    const planPath = path.join(projectRoot, 'ai-output-plan.json');

    const result = execNutCommand<{ success: boolean; planSaved: boolean }>(
      `analyze --source-path ${projectRoot} --use-ai --org-type Production --industry Fintech --save-plan --plan-path ${planPath} --json`,
      homeDir
    );

    const savedPlan = await readFile(planPath, 'utf8');

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(result.shellOutput.stdout).to.include('"planSaved": true');
    expect(result.shellOutput.stdout).to.include('"ai"');
    expect(result.shellOutput.stdout).to.include('"enabled": true');
    expect(result.shellOutput.stdout).to.include('"provider"');
    expect(result.shellOutput.stdout).to.include('"inferenceFallback"');
    expect(savedPlan).to.include('"aiEnabled": true');
    expect(savedPlan).to.include('"aiModel"');
    expect(savedPlan).to.include('"source": "ai"');
    expect(savedPlan).to.include('PaymentHandler');
  });

  it('analyze writes a JSON report when output is requested', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-json-report-project', {
      'force-app/main/default/classes/ReportJson.cls': 'public class ReportJson {}\n',
    });
    const reportPath = path.join(projectRoot, 'analysis-report.json');

    const result = execNutCommand<{ success: boolean }>(
      `analyze --source-path ${projectRoot} --output ${reportPath} --format json --json`,
      homeDir
    );
    const savedReport = await readFile(reportPath, 'utf8');

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(savedReport).to.include('"summary"');
    expect(savedReport).to.include('"components": 1');
    expect(savedReport).to.include('"waves"');
  });

  it('analyze writes an HTML report when requested', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-html-report-project', {
      'force-app/main/default/classes/ReportHtml.cls': 'public class ReportHtml {}\n',
    });
    const reportPath = path.join(projectRoot, 'analysis-report.html');

    const result = execNutCommand<{ success: boolean }>(
      `analyze --source-path ${projectRoot} --output ${reportPath} --format html --json`,
      homeDir
    );
    const savedReport = await readFile(reportPath, 'utf8');

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(savedReport).to.include('<html');
    expect(savedReport).to.include('Metadata Analysis Report');
    expect(savedReport).to.include('Wave Breakdown');
  });

  it('analyze writes AI report context when AI output is requested', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-ai-report-project', {
      'force-app/main/default/classes/PaymentHandler.cls': 'public class PaymentHandler {}\n',
    });
    const reportPath = path.join(projectRoot, 'analysis-ai-report.json');

    const result = execNutCommand<{ success: boolean }>(
      `analyze --source-path ${projectRoot} --use-ai --output ${reportPath} --format json --json`,
      homeDir
    );
    const savedReport = JSON.parse(await readFile(reportPath, 'utf8')) as {
      ai?: {
        enabled: boolean;
        provider?: string;
        model?: string;
        inferenceFallback?: boolean;
        effect?: {
          priorityAdjustments: number;
          inferredDependencies: number;
          fallbackApplied: boolean;
          summary: string;
        };
      };
    };

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(savedReport.ai).to.deep.include({
      enabled: true,
      provider: 'agentforce',
      model: 'agentforce-1',
      inferenceFallback: true,
    });
    expect(savedReport.ai?.effect).to.deep.include({
      priorityAdjustments: 1,
      inferredDependencies: 0,
      fallbackApplied: true,
    });
    expect(savedReport.ai?.effect?.summary).to.include('priority adjustment(s) applied');
    expect(savedReport.ai?.effect?.summary).to.include('static fallback used for dependency inference');
  });

  it('analyze writes AI transparency details into HTML reports when AI output is requested', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'analyze-ai-html-report-project', {
      'force-app/main/default/classes/PaymentHandler.cls': 'public class PaymentHandler {}\n',
    });
    const reportPath = path.join(projectRoot, 'analysis-ai-report.html');

    const result = execNutCommand<{ success: boolean }>(
      `analyze --source-path ${projectRoot} --use-ai --output ${reportPath} --format html --json`,
      homeDir
    );
    const savedReport = await readFile(reportPath, 'utf8');

    expect(result.shellOutput.stdout).to.include('"success": true');
    expect(savedReport).to.include('AI Transparency');
    expect(savedReport).to.include('Provider: <strong>agentforce</strong>');
    expect(savedReport).to.include('Model: <strong>agentforce-1</strong>');
    expect(savedReport).to.include('Inference fallback used: <strong>Yes</strong>');
    expect(savedReport).to.include('AI effect summary: <strong>');
  });

  it('config sets, gets, lists, and persists configuration values', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'config-project', {
      'force-app/main/default/classes/ConfigCls.cls': 'public class ConfigCls {}\n',
    });

    execNutCommand('config --source-path ' + projectRoot + ' --set testLevel=RunLocalTests', homeDir);
    execNutCommand('config --source-path ' + projectRoot + ' --set-priority ApexClass:ConfigCls=100', homeDir);

    const getResult = execNutCommand('config --source-path ' + projectRoot + ' --get testLevel', homeDir);
    const priorityResult = execNutCommand(
      'config --source-path ' + projectRoot + ' --get-priority ApexClass:ConfigCls',
      homeDir
    );
    const listResult = execNutCommand('config --source-path ' + projectRoot + ' --list', homeDir);
    const savedConfig = await readFile(path.join(projectRoot, '.smart-deployment.json'), 'utf8');

    expect(getResult.shellOutput.stdout).to.include('testLevel: RunLocalTests');
    expect(priorityResult.shellOutput.stdout).to.include('Priority for ApexClass:ConfigCls: 100');
    expect(listResult.shellOutput.stdout).to.include('Metadata Priorities:');
    expect(listResult.shellOutput.stdout).to.include('Other Settings:');
    expect(savedConfig).to.include('"testLevel": "RunLocalTests"');
    expect(savedConfig).to.include('"ApexClass:ConfigCls": 100');
  });

  it('config persists repo-level LLM settings and can read them back', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'config-llm-project', {
      'force-app/main/default/classes/LlmConfig.cls': 'public class LlmConfig {}\n',
    });

    execNutCommand('config --source-path ' + projectRoot + ' --set-llm-provider openai', homeDir);
    execNutCommand('config --source-path ' + projectRoot + ' --set-llm-model gpt-4o-mini', homeDir);
    execNutCommand(
      'config --source-path ' + projectRoot + ' --set-llm-endpoint https://api.openai.test/v1/chat/completions',
      homeDir
    );
    execNutCommand('config --source-path ' + projectRoot + ' --set-llm-timeout 45000', homeDir);

    const getResult = execNutCommand('config --source-path ' + projectRoot + ' --get-llm', homeDir);
    const savedConfig = await readFile(path.join(projectRoot, '.smart-deployment.json'), 'utf8');

    expect(getResult.shellOutput.stdout).to.include('"provider":"openai"');
    expect(getResult.shellOutput.stdout).to.include('"model":"gpt-4o-mini"');
    expect(savedConfig).to.include('"provider": "openai"');
    expect(savedConfig).to.include('"model": "gpt-4o-mini"');
    expect(savedConfig).to.include('"endpoint": "https://api.openai.test/v1/chat/completions"');
    expect(savedConfig).to.include('"timeout": 45000');
  });

  it('command help output exposes examples and key flags', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);

    const analyzeHelp = execNutCommand('analyze --help', homeDir);
    const configHelp = execNutCommand('config --help', homeDir);
    const startHelp = execNutCommand('start --help', homeDir);

    expect(analyzeHelp.shellOutput.stdout).to.include('--source-path');
    expect(analyzeHelp.shellOutput.stdout).to.include('--save-plan');
    expect(analyzeHelp.shellOutput.stdout).to.include('--use-ai');
    expect(analyzeHelp.shellOutput.stdout).to.include('--org-type');
    expect(analyzeHelp.shellOutput.stdout).to.include('--industry');
    expect(configHelp.shellOutput.stdout).to.include('EXAMPLES');
    expect(configHelp.shellOutput.stdout).to.include('--set-priority');
    expect(configHelp.shellOutput.stdout).to.include('--set-llm-provider');
    expect(configHelp.shellOutput.stdout).to.include('--set-llm-model');
    expect(startHelp.shellOutput.stdout).to.include('--allow-cycle-remediation');
    expect(startHelp.shellOutput.stdout).to.include('--use-ai');
    expect(startHelp.shellOutput.stdout).to.include('--org-type');
    expect(startHelp.shellOutput.stdout).to.include('--industry');
    expect(startHelp.shellOutput.stdout).to.include('--target-org');
  });
});
