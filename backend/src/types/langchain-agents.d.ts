declare module 'langchain/agents' {
  export interface AgentExecutorInput {
    agent: any;
    tools: any[];
    verbose?: boolean;
  }

  export class AgentExecutor {
    constructor(input: AgentExecutorInput);
    invoke(input: Record<string, unknown>): Promise<any>;
  }

  export interface CreateToolCallingAgentInput {
    llm: any;
    tools: any[];
    prompt: any;
  }

  export function createToolCallingAgent(input: CreateToolCallingAgentInput): Promise<any>;
}

