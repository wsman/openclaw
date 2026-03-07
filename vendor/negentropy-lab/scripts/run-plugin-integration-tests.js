/**
 * 测试运行脚本 - 插件集成测试
 */

// CommonJS import
const agentPluginModule = require('../plugins/core/agent-integration/index');
const monitorPluginModule = require('../plugins/core/entropy-monitor/index');
const wsPluginModule = require('../plugins/core/websocket-channel/index');

// Mock PluginApi
const mockPluginApi = {
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  config: {
    get: jest.fn(),
  },
  events: {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
};

// 获取插件实例
let agentPlugin = null;
let monitorPlugin = null;
let wsPlugin = null;

async function setupPlugins() {
  console.log('Setting up plugins...');

  // 使用模块的默认导出或直接引用
  const agentDef = agentPluginModule.default || agentPluginModule;
  const monitorDef = monitorPluginModule.default || monitorPluginModule;
  const wsDef = wsPluginModule.default || wsPluginModule;

  // 初始化插件
  await agentDef.initialize(mockPluginApi);
  await monitorDef.initialize(mockPluginApi);
  await wsDef.initialize(mockPluginApi);

  // 激活插件
  await agentDef.activate(mockPluginApi);
  await monitorDef.activate(mockPluginApi);
  await wsDef.activate(mockPluginApi);

  agentPlugin = agentDef;
  monitorPlugin = monitorDef;
  wsPlugin = wsDef;

  console.log('Plugins initialized successfully!');
}

async function teardownPlugins() {
  console.log('Tearing down plugins...');

  if (agentPlugin && agentPlugin.deactivate) {
    await agentPlugin.deactivate(mockPluginApi);
  }
  if (monitorPlugin && monitorPlugin.deactivate) {
    await monitorPlugin.deactivate(mockPluginApi);
  }
  if (wsPlugin && wsPlugin.deactivate) {
    await wsPlugin.deactivate(mockPluginApi);
  }

  console.log('Plugins torn down successfully!');
}

async function testAgentPlugin() {
  console.log('\n=== Testing Agent Plugin ===');

  try {
    // 测试LLM调用
    const response = await agentPlugin.callLLM('zai/glm-4.7', 'Hello, World!');
    console.log('LLM Response:', response);

    // 测试任务调度
    await agentPlugin.scheduleTask({
      taskId: 'test-task-1',
      description: 'Test task',
      type: 'analysis',
    }, 'L1');

    console.log('✅ Agent plugin tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Agent plugin tests failed:', error);
    return false;
  }
}

async function testMonitorPlugin() {
  console.log('\n=== Testing Monitor Plugin ===');

  try {
    // 测试熵值获取
    const entropy = await monitorPlugin.getEntropy();
    console.log('Entropy:', entropy);

    // 测试CPU监控
    const cpuStats = await monitorPlugin.getCPUStats();
    console.log('CPU Stats:', cpuStats);

    // 测试内存监控
    const memoryStats = await monitorPlugin.getMemoryStats();
    console.log('Memory Stats:', memoryStats);

    // 测试告警
    monitorPlugin.setThreshold('h_sys', 0.7, (alert) => {
      console.log('Alert triggered:', alert.message);
    });

    console.log('✅ Monitor plugin tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Monitor plugin tests failed:', error);
    return false;
  }
}

async function testWebSocketPlugin() {
  console.log('\n=== Testing WebSocket Plugin ===');

  try {
    // 测试服务器启动
    const serverStarted = await wsPlugin.startServer(30010);
    console.log('Server started:', serverStarted);

    // 测试获取统计信息
    const stats = await wsPlugin.getStatistics();
    console.log('Statistics:', stats);

    // 测试广播
    await wsPlugin.broadcast({
      type: 'agent_message',
      content: {
        message: 'Test broadcast',
        timestamp: Date.now(),
      },
      messageId: `msg-${Date.now()}`,
      timestamp: Date.now(),
    });

    console.log('✅ WebSocket plugin tests passed!');
    return true;
  } catch (error) {
    console.error('❌ WebSocket plugin tests failed:', error);
    return false;
  } finally {
    // 清理
    try {
      await wsPlugin.stopServer();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function testIntegration() {
  console.log('\n=== Testing Integration ===');

  try {
    // 测试完整流程：监控 → Agent → WebSocket
    console.log('1. Starting WebSocket server...');
    await wsPlugin.startServer(30011);

    console.log('2. Getting entropy...');
    const entropy = await monitorPlugin.getEntropy();
    console.log('   Current entropy:', entropy.h_sys);

    console.log('3. Broadcasting entropy update...');
    await wsPlugin.broadcast({
      type: 'entropy_update',
      content: {
        entropy: entropy,
        timestamp: Date.now(),
      },
      messageId: `msg-${Date.now()}`,
      timestamp: Date.now(),
    });

    console.log('4. Scheduling task...');
    await agentPlugin.scheduleTask({
      taskId: 'integration-task-1',
      description: 'Integration test task',
      type: 'analysis',
    }, 'L1');

    console.log('5. Broadcasting task status...');
    await wsPlugin.broadcast({
      type: 'agent_message',
      content: {
        taskId: 'integration-task-1',
        status: 'completed',
        timestamp: Date.now(),
      },
      messageId: `msg-${Date.now()}`,
      timestamp: Date.now(),
    });

    console.log('✅ Integration tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Integration tests failed:', error);
    return false;
  } finally {
    try {
      await wsPlugin.stopServer();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  console.log('🚀 Starting Plugin Integration Tests');
  console.log('='.repeat(50));

  let allPassed = true;

  try {
    // Setup
    await setupPlugins();

    // Run tests
    allPassed = await testAgentPlugin() && allPassed;
    allPassed = await testMonitorPlugin() && allPassed;
    allPassed = await testWebSocketPlugin() && allPassed;
    allPassed = await testIntegration() && allPassed;

    // Teardown
    await teardownPlugins();

    // Summary
    console.log('\n' + '='.repeat(50));
    if (allPassed) {
      console.log('✅ All tests passed!');
    } else {
      console.log('❌ Some tests failed!');
    }
    console.log('='.repeat(50));

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test suite failed with error:', error);
    await teardownPlugins();
    process.exit(1);
  }
}

main();
