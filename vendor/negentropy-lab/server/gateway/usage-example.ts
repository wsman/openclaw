/**
 * 🚀 Negentropy-Lab Gateway 使用示例
 * 
 * 展示如何启动和使用整合了WebSocket的Gateway服务器
 * 
 * 宪法依据：
 * - §306 零停机协议：演示无中断启动和关闭
 * - §101 同步公理：示例代码与文档保持同步
 * - §102 熵减原则：示例应降低系统熵值
 */

import { startGatewayServer } from './server.impl-with-ws';

/**
 * 示例1：启动基础Gateway服务器
 */
async function exampleBasicGateway() {
  console.log('🎯 示例1：启动基础Gateway服务器');
  
  try {
    // 启动Gateway服务器，默认端口4514
    const server = await startGatewayServer(4514, {
      bind: 'loopback', // 绑定到127.0.0.1
      controlUiEnabled: true,
      openAiChatCompletionsEnabled: true,
      openResponsesEnabled: true,
      auth: {
        token: 'negentropy-secret-token',
        allowTailscale: false,
      },
    });
    
    console.log('✅ Gateway服务器启动成功');
    console.log('📡 HTTP地址: http://127.0.0.1:4514');
    console.log('⚡ WebSocket地址: ws://127.0.0.1:4514/gateway');
    console.log('🔑 认证Token: negentropy-secret-token');
    
    // 显示连接统计（模拟）
    setTimeout(() => {
      const stats = server.getConnectionStats?.();
      console.log('📊 连接统计:', stats || { total: 0, authenticated: 0 });
    }, 1000);
    
    // 10秒后优雅关闭
    setTimeout(async () => {
      console.log('🛑 正在优雅关闭服务器...');
      await server.close({ reason: '示例演示完成' });
      console.log('✅ 服务器已关闭');
    }, 10000);
    
  } catch (error) {
    console.error('❌ Gateway服务器启动失败:', error);
  }
}

/**
 * 示例2：LAN模式启动（局域网访问）
 */
async function exampleLanGateway() {
  console.log('\n🎯 示例2：启动LAN模式Gateway服务器');
  
  try {
    const server = await startGatewayServer(4515, {
      bind: 'lan', // 绑定到0.0.0.0，允许局域网访问
      openAiChatCompletionsEnabled: true,
      websocket: {
        maxPayloadBytes: 20 * 1024 * 1024, // 20MB最大消息
        handshakeTimeoutMs: 15000, // 15秒握手超时
      },
    });
    
    console.log('✅ LAN模式Gateway服务器启动成功');
    console.log('📡 HTTP地址: http://0.0.0.0:4515 (所有网卡)');
    console.log('⚡ WebSocket地址: ws://0.0.0.0:4515/gateway');
    console.log('⚠️  注意: LAN模式下需配置防火墙规则');
    
    // 10秒后关闭
    setTimeout(async () => {
      await server.close({ reason: 'LAN模式演示完成' });
      console.log('✅ LAN模式服务器已关闭');
    }, 10000);
    
  } catch (error) {
    console.error('❌ LAN模式Gateway启动失败:', error);
  }
}

/**
 * 示例3：开发模式启动（无需认证）
 */
async function exampleDevGateway() {
  console.log('\n🎯 示例3：启动开发模式Gateway服务器');
  
  // 设置开发环境变量
  process.env.NODE_ENV = 'development';
  
  try {
    const server = await startGatewayServer(4516, {
      bind: 'auto',
      openAiChatCompletionsEnabled: true,
      openResponsesEnabled: true,
      auth: {
        // 开发模式可以使用简单密码或跳过认证
        password: 'dev-password',
      },
    });
    
    console.log('✅ 开发模式Gateway服务器启动成功');
    console.log('📡 开发地址: http://localhost:4516');
    console.log('⚡ WebSocket地址: ws://localhost:4516/gateway');
    console.log('🔓 开发认证: 密码 "dev-password" 或本地连接跳过认证');
    
    // 显示可用API端点
    setTimeout(() => {
      console.log('\n🛠️  可用API端点:');
      console.log('  • GET  /health                 - 健康检查');
      console.log('  • POST /v1/chat/completions    - OpenAI兼容API');
      console.log('  • POST /v1/responses           - OpenResponses API');
      console.log('  • POST /hooks/:action          - Webhooks');
      console.log('  • GET  /api/websocket/stats    - WebSocket统计');
      console.log('  • WS   /gateway               - WebSocket JSON-RPC网关');
    }, 500);
    
    // 10秒后关闭
    setTimeout(async () => {
      await server.close({ reason: '开发模式演示完成' });
      console.log('\n✅ 开发模式服务器已关闭');
    }, 10000);
    
  } catch (error) {
    console.error('❌ 开发模式Gateway启动失败:', error);
  }
}

/**
 * 示例4：WebSocket客户端使用示例（伪代码）
 */
function exampleWebSocketClient() {
  console.log('\n🎯 示例4：WebSocket客户端使用指南');
  
  console.log('📝 WebSocket客户端连接示例:');
  console.log(`
// 1. 创建WebSocket连接
const ws = new WebSocket('ws://localhost:4514/gateway');

// 2. 连接建立后发送认证请求
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'request',
    id: 'auth_1',
    method: 'connect',
    params: {
      token: 'negentropy-secret-token',
      client: { name: 'example-client', version: '1.0.0' }
    }
  }));
};

// 3. 处理服务器响应
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'response' && message.id === 'auth_1') {
    if (message.ok) {
      console.log('✅ 认证成功:', message.result.auth);
      
      // 发送系统信息请求
      ws.send(JSON.stringify({
        type: 'request',
        id: 'sys_1',
        method: 'system.info',
        params: {}
      }));
    } else {
      console.error('❌ 认证失败:', message.error);
    }
  }
  
  if (message.type === 'event') {
    console.log('📢 服务器事件:', message.event, message.payload);
  }
};

// 4. 发送Agent请求
function sendAgentRequest(prompt: string) {
  ws.send(JSON.stringify({
    type: 'request',
    id: 'agent_' + Date.now(),
    method: 'agent',
    params: {
      prompt,
      tools: [],
      sessionKey: 'test-session'
    }
  }));
}
  `);
}

/**
 * 运行所有示例
 */
async function runAllExamples() {
  console.log('🚀 Negentropy-Lab Gateway 移植项目示例演示');
  console.log('='.repeat(60));
  
  await exampleBasicGateway();
  await exampleLanGateway();
  await exampleDevGateway();
  exampleWebSocketClient();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有示例演示完成');
  console.log('📋 总结:');
  console.log('  • Gateway服务器支持HTTP和WebSocket协议');
  console.log('  • 兼容OpenAI API标准');
  console.log('  • 完整的认证和权限系统');
  console.log('  • 支持零停机部署');
  console.log('  • 遵循宪法驱动开发(CDD)原则');
}

// 执行示例演示
if (require.main === module) {
  runAllExamples().catch(console.error);
}

// 导出供其他模块使用
export {
  exampleBasicGateway,
  exampleLanGateway,
  exampleDevGateway,
  exampleWebSocketClient,
  runAllExamples,
};