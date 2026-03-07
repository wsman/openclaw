/**
 * Legacy Gateway LLMService test shim.
 * Used by obsolete unit tests that still target the pre-refactor API surface.
 */

export enum ModelProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  COHERE = 'cohere',
  AZURE_OPENAI = 'azure_openai',
  AWS_BEDROCK = 'aws_bedrock',
}

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export class LLMService {
  constructor(public config: ModelConfig) {}

  async chat(_request: unknown): Promise<any> {
    return {
      choices: [{ message: { content: 'shim-response' } }],
      usage: { total_tokens: 0 },
    };
  }
}

export default LLMService;
