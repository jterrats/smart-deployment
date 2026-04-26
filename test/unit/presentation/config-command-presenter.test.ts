import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ConfigCommandPresenter } from '../../../src/presentation/config-command-presenter.js';

describe('ConfigCommandPresenter', () => {
  it('renders config values and update messages', () => {
    const presenter = new ConfigCommandPresenter();
    const logs: string[] = [];
    const io = {
      log: (message: string) => logs.push(message),
    };

    presenter.reportUsageHint(io);
    presenter.reportCurrentConfig(io, {
      priorities: {
        'ApexClass:ConfigCls': 100,
      },
      testLevel: 'RunLocalTests',
    });
    presenter.reportLlmConfig(io, {
      llm: {
        provider: 'openai',
      },
    });
    presenter.reportPriority(io, 'ApexClass:ConfigCls', 100);
    presenter.reportConfigValue(io, 'testLevel', 'RunLocalTests');
    presenter.reportLlmUpdated(io, {
      llm: {
        provider: 'openai',
      },
    });
    presenter.reportPriorityUpdated(io, 'ApexClass:ConfigCls', 100);
    presenter.reportConfigValueUpdated(io, 'testLevel', 'RunLocalTests');

    expect(logs).to.include('Use --help to see available options');
    expect(logs).to.include('📋 Current Configuration:');
    expect(logs).to.include('  Metadata Priorities:');
    expect(logs).to.include('    ApexClass:ConfigCls: 100');
    expect(logs).to.include('  Other Settings:');
    expect(logs).to.include('    testLevel: RunLocalTests');
    expect(logs).to.include('llm: {"provider":"openai"}');
    expect(logs).to.include('Priority for ApexClass:ConfigCls: 100');
    expect(logs).to.include('testLevel: RunLocalTests');
    expect(logs).to.include('✅ Updated LLM configuration: {"provider":"openai"}');
    expect(logs).to.include('✅ Set priority for ApexClass:ConfigCls = 100');
    expect(logs).to.include('✅ Set testLevel = RunLocalTests');
  });
});
