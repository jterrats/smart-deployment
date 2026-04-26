import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ConfigMutationService } from '../../../src/config/config-mutation-service.js';

describe('ConfigMutationService', () => {
  it('updates llm config incrementally', () => {
    const service = new ConfigMutationService();

    const nextConfig = service.updateLlmConfig(
      {
        llm: {
          provider: 'agentforce',
        },
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        timeout: 45_000,
      }
    );

    expect(nextConfig.llm).to.deep.equal({
      provider: 'openai',
      model: 'gpt-4o-mini',
      timeout: 45_000,
    });
  });

  it('parses metadata priorities', () => {
    const service = new ConfigMutationService();
    const result = service.setPriority({}, 'ApexClass:MyClass=100');

    expect(result.metadataId).to.equal('ApexClass:MyClass');
    expect(result.priority).to.equal(100);
    expect(result.nextConfig.priorities).to.deep.equal({
      'ApexClass:MyClass': 100,
    });
  });

  it('parses generic config values', () => {
    const service = new ConfigMutationService();
    const result = service.setConfigValue({}, 'testLevel=RunLocalTests');

    expect(result.key).to.equal('testLevel');
    expect(result.value).to.equal('RunLocalTests');
    expect(result.nextConfig.testLevel).to.equal('RunLocalTests');
  });
});
