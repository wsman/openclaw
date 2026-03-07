/**
 * 🛰️ Gateway 通道集成与消息流实现
 * 
 * 宪法依据：
 * - §101 同步公理：统一消息处理流程
 * - §107 通信安全：端到端消息安全保障
 * - §109 协作流程公理：Agent 协作流程标准化
 * - §110 协作效率公理：高效的消息分发与响应
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Core
 */

import { logger } from '../utils/logger';
import { GlobalInversifyContainer } from '../config/inversify.config';
import { TYPES } from '../config/inversify.types';
import { ChannelManager } from './channels/core/ChannelManager';
import { UnifiedMessage, OutgoingMessage, MessageType, MessagePriority } from './channels/types/Message';
import { IntelligentRouter } from '../services/IntelligentRouter';
import { AgentEngine } from './agent-engine';

/**
 * 初始化 Gateway 通道集成
 */
export async function initializeGatewayChannels(agentEngine: AgentEngine): Promise<ChannelManager> {
  logger.info('[Gateway] 正在初始化通道集成与消息流...');

  // 从容器获取 ChannelManager
  const channelManager = GlobalInversifyContainer.resolve<ChannelManager>(TYPES.ChannelManager);
  const intelligentRouter = GlobalInversifyContainer.resolve<IntelligentRouter>(TYPES.IntelligentRouter);

  // 初始化 ChannelManager
  await channelManager.initialize();

  // 注册消息接收处理器
  channelManager.on('message_received', async (data: any) => {
    const { message, channelId } = data;
    await handleIncomingMessageFlow(message, channelId, channelManager, intelligentRouter, agentEngine);
  });

  logger.info('[Gateway] 通道集成与消息流初始化完成');
  return channelManager;
}

/**
 * 处理传入消息流
 * 
 * 宪法依据：§109 协作流程公理，标准化消息处理路径
 */
async function handleIncomingMessageFlow(
  message: UnifiedMessage,
  channelId: string,
  channelManager: ChannelManager,
  intelligentRouter: IntelligentRouter,
  agentEngine: AgentEngine
): Promise<void> {
  const startTime = Date.now();
  logger.info(`[MessageFlow] 收到来自 ${message.platform}/${message.channelId} 的消息: ${message.id}`);

  try {
    // 1. 意图分析与路由决策 (通过 IntelligentRouter)
    const routingResult = await intelligentRouter.routeUserMessage(
      message.text,
      { platform: message.platform, channelId: message.channelId },
      message.userId
    );

    if (!routingResult.success || !routingResult.decision) {
      throw new Error(`路由决策失败: ${routingResult.error || '未知错误'}`);
    }

    const decision = routingResult.decision;
    logger.info(`[MessageFlow] 路由决策: ${decision.recommendedAction} -> ${decision.targetAgentName || '未指定'}`);

    // 2. 调用目标 Agent (通过 AgentEngine)
    // 注意：如果是 direct_route 且有 targetAgentId，直接调用
    // 如果是 cabinet_coordination，调用 Prime Minister
    // 如果是 manual_review，由 Office Director 处理并提示
    
    let responseText = '';
    const targetAgentId = decision.targetAgentId || 'agent:office_director';

    if (decision.recommendedAction === 'manual_review') {
      responseText = `⚠️ 任务复杂度过高 (${routingResult.analysis?.complexity.score}/10)，已转交人工审查。\n理由: ${decision.decisionReason}`;
    } else {
      // 执行 Agent 请求
      const agentResponse = await agentEngine.executeAgentRequest({
        agentId: targetAgentId,
        agentName: decision.targetAgentName || 'Unknown Agent',
        query: message.text,
        context: JSON.stringify({
          originalMessage: message,
          routingDecision: decision
        })
      });

      if (agentResponse.success) {
        // 解析响应数据
        if (typeof agentResponse.data === 'string') {
          responseText = agentResponse.data;
        } else if (agentResponse.data?.response) {
          responseText = agentResponse.data.response;
        } else {
          responseText = JSON.stringify(agentResponse.data);
        }
      } else {
        responseText = `❌ Agent 处理失败: ${agentResponse.error}`;
      }
    }

    // 3. 发送响应消息 (通过 ChannelManager)
    const outgoingMessage: OutgoingMessage = {
      id: `resp_${Date.now()}_${message.id}`,
      platform: message.platform,
      channelId: message.channelId,
      text: responseText,
      options: {
        threadId: message.metadata.platformMessageId, // 回复原消息
        priority: MessagePriority.NORMAL
      },
      tracking: {
        sourceMessageId: message.id
      }
    };

    await channelManager.sendMessage(outgoingMessage);

    const duration = Date.now() - startTime;
    logger.info(`[MessageFlow] 消息处理完成，总耗时: ${duration}ms`);

  } catch (error: any) {
    logger.error(`[MessageFlow] 处理消息流时出错: ${error.message}`);
    
    // 发送错误响应
    try {
      await channelManager.sendMessage({
        id: `err_${Date.now()}_${message.id}`,
        platform: message.platform,
        channelId: message.channelId,
        text: `❌ 抱歉，处理您的请求时发生了内部错误。\n错误信息: ${error.message}`,
        options: { threadId: message.metadata.platformMessageId }
      });
    } catch (sendError: any) {
      logger.error(`[MessageFlow] 发送错误响应失败: ${sendError.message}`);
    }
  }
}
