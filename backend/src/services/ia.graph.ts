import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { END, MemorySaver, StateGraph } from '@langchain/langgraph';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AgendamentoState } from '../types/ia-state';

export type GraphState = AgendamentoState & {
  messages: BaseMessage[];
};

const memory = new MemorySaver();

export function buildIaGraph(model: ChatGoogleGenerativeAI, tools: any[]) {
  const toolNode = new ToolNode(tools);

  const graph = new StateGraph<any>({
    channels: {
      step: null,
      paciente: null,
      intencao: null,
      ultimoErro: null,
      messages: null,
    },
  });

  graph.addNode('agent', async (state: GraphState) => {
    const response = await model.invoke(state.messages);
    return { ...state, messages: [...state.messages, response] };
  });

  graph.addNode('tools', async (state: GraphState) => {
    const result = await toolNode.invoke(state);
    return { ...state, messages: result.messages as BaseMessage[] };
  });

  (graph as any).addEdge('__start__', 'agent');
  (graph as any).addEdge('tools', 'agent');

  (graph as any).addConditionalEdges(
    'agent',
    (state: any) => {
      const last = state.messages[state.messages.length - 1];
      if (last instanceof AIMessage && last.tool_calls && last.tool_calls.length > 0) {
        return 'tools';
      }
      return END;
    },
    {
      tools: 'tools',
      [END]: END,
    },
  );

  return graph.compile({
    checkpointer: memory,
  });
}

