import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { beforeEach, describe, it } from 'mocha';
import { OpenAIService, type OpenAIFetch } from '../../../src/ai/openai-service.js';
import { createLLMProvider } from '../../../src/ai/llm-provider-factory.js';

describe('OpenAIService', () => {
  let service: OpenAIService;
  let fetchCalls: Array<{ input: Parameters<typeof fetch>[0]; init?: Parameters<typeof fetch>[1] }>;
  let fetchFn: OpenAIFetch;

  beforeEach(() => {
    fetchCalls = [];
    fetchFn = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      fetchCalls.push({ input, init });

      return new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          model: 'gpt-4o-mini',
          usage: { ['total_tokens']: 77 },
          choices: [
            {
              message: {
                content: '{"message":"OpenAI response"}',
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }) as OpenAIFetch;

    service = new OpenAIService({
      enabled: true,
      endpoint: 'https://api.openai.test/v1/chat/completions',
      apiKey: 'openai-test-key',
      model: 'gpt-4o-mini',
      timeout: 5000,
      rateLimit: 20,
      fetchFn,
    });
  });

  it('sends chat-completions style requests and parses responses', async () => {
    const response = await service.sendRequest({
      model: 'gpt-4o-mini',
      prompt: 'Summarize this deployment risk.',
      temperature: 0.1,
      maxTokens: 111,
    });

    expect(response.content).to.include('OpenAI response');
    expect(response.tokensUsed).to.equal(77);
    expect(response.model).to.equal('gpt-4o-mini');
    expect(fetchCalls).to.have.lengthOf(1);
    expect(String(fetchCalls[0].input)).to.equal('https://api.openai.test/v1/chat/completions');
    expect(fetchCalls[0].init?.method).to.equal('POST');
    expect(String(fetchCalls[0].init?.body)).to.include('"messages"');
    expect(String(fetchCalls[0].init?.body)).to.include('"max_tokens":111');
  });

  it('throws when disabled', async () => {
    const disabled = new OpenAIService({ enabled: false });

    try {
      await disabled.sendRequest({ model: 'gpt-4o-mini', prompt: 'test' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect((error as Error).message).to.include('disabled');
    }
  });

  it('factory can build the openai provider', async () => {
    const provider = createLLMProvider({
      provider: 'openai',
      endpoint: 'https://api.openai.test/v1/chat/completions',
      apiKey: 'openai-test-key',
      model: 'gpt-4o-mini',
      enabled: true,
      timeout: 5000,
      rateLimit: 20,
      fetchFn,
    });

    const response = await provider.sendRequest({
      model: 'gpt-4o-mini',
      prompt: 'hello',
    });

    expect(provider.getConfig().provider).to.equal('openai');
    expect(response.model).to.equal('gpt-4o-mini');
  });

  it('factory reads provider defaults from repo config when baseDir is supplied', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-llm-factory-'));

    try {
      await writeFile(
        path.join(tempDir, '.smart-deployment.json'),
        JSON.stringify({
          llm: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            endpoint: 'https://api.openai.test/v1/chat/completions',
            timeout: 45_000,
          },
        }),
        'utf8'
      );

      const provider = createLLMProvider({
        baseDir: tempDir,
        apiKey: 'openai-test-key',
        enabled: true,
        fetchFn,
      });

      const response = await provider.sendRequest({
        model: provider.getConfig().model,
        prompt: 'hello from repo config',
      });

      expect(provider.getConfig().provider).to.equal('openai');
      expect(provider.getConfig().timeout).to.equal(45_000);
      expect(response.model).to.equal('gpt-4o-mini');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
