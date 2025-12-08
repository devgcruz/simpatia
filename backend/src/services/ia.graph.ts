import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { END, StateGraph } from '@langchain/langgraph';
import type { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { AgendamentoState } from '../types/ia-state';
import { prisma } from '../lib/prisma';

export type GraphState = AgendamentoState & {
  messages: BaseMessage[];
};

type StoredCheckpoint = {
  thread_id: string;
  checkpoint: any;
  metadata: any;
  parent_checkpoint_id?: string | null;
};

class PrismaCheckpointSaver {
  async get(config: { thread_id?: string }) {
    if (!config.thread_id) return null;
    const row = await (prisma as any).threadCheckpoint.findUnique({
      where: { thread_id: config.thread_id },
    });
    if (!row) return null;
    return {
      checkpoint: row.checkpoint as any,
      metadata: row.metadata as any,
      parent_checkpoint_id: row.parent_checkpoint_id,
    };
  }

  async put(
    config: { thread_id?: string; parent_checkpoint_id?: string | null },
    value: { checkpoint: any; metadata: any },
  ) {
    if (!config.thread_id) return;
    await (prisma as any).threadCheckpoint.upsert({
      where: { thread_id: config.thread_id },
      update: {
        checkpoint: value.checkpoint as any,
        metadata: value.metadata as any,
        parent_checkpoint_id: config.parent_checkpoint_id ?? null,
      },
      create: {
        thread_id: config.thread_id,
        checkpoint: value.checkpoint as any,
        metadata: value.metadata as any,
        parent_checkpoint_id: config.parent_checkpoint_id ?? null,
      },
    });
  }
}

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

  const checkpointer: any = new PrismaCheckpointSaver();

  return graph.compile({
    checkpointer,
  });
}

