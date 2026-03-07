/**
 * 批量迁移 Jest 语法到 Vitest - 完整版
 * 
 * 用法: node scripts/migrate-jest-to-vitest.js
 */

const fs = require('fs');
const path = require('path');

// 完整的测试文件列表
const filesToMigrate = [
  // Server tests
  'server/tests/LLMService.test.ts',
  'server/tests/IntelligentRouter.test.ts',
  
  // Integration tests
  'tests/integration/triple-loop-integration.test.ts',
  'tests/integration/observation-loop.test.ts',
  'tests/integration/plugins/full-workflow-integration.test.ts',
  'tests/integration/plugins/agent-monitor-integration.test.ts',
  'tests/integration/plugins/agent-websocket-integration.test.ts',
  'tests/integration/plugins/plugin-integration-simple.test.ts',
  
  // E2E tests
  'tests/e2e/multi-client-concurrency-e2e.test.ts',
  'tests/e2e/long-running-task-e2e.test.ts',
  'tests/e2e/failure-recovery-e2e.test.ts',
  
  // Unit tests - Gateway
  'tests/unit/gateway/RPCMethods.test.ts',
  'tests/unit/gateway/MessageHandler.test.ts',
  'tests/unit/gateway/WebSocketHandler.test.ts',
  'tests/unit/gateway/server-channels.test.ts',
  'tests/unit/gateway/llm-service.test.ts',
  
  // Unit tests - Agents
  'tests/unit/agents/AgentCoordinator.test.ts',
  'tests/unit/agents/AgentEngine.test.ts',
  'tests/unit/agents/BaseAgent.test.ts',
  
  // Unit tests - ChatRoom
  'tests/unit/chatroom/ChatRoom.test.ts',
];

const replacements = [
  // jest.fn() → vi.fn()
  { from: /jest\.fn\(\)/g, to: 'vi.fn()' },
  // jest.spyOn() → vi.spyOn()
  { from: /jest\.spyOn\(/g, to: 'vi.spyOn(' },
  // jest.mock() → vi.mock()
  { from: /jest\.mock\(/g, to: 'vi.mock(' },
  // jest.useFakeTimers() → vi.useFakeTimers()
  { from: /jest\.useFakeTimers\(\)/g, to: 'vi.useFakeTimers()' },
  // jest.useRealTimers() → vi.useRealTimers()
  { from: /jest\.useRealTimers\(\)/g, to: 'vi.useRealTimers()' },
  // jest.setTimeout() → 注释掉
  { from: /jest\.setTimeout\([^)]+\)/g, to: '// setTimeout configured in vitest.config' },
  // jest.clearAllMocks() → vi.clearAllMocks()
  { from: /jest\.clearAllMocks\(\)/g, to: 'vi.clearAllMocks()' },
  // jest.resetAllMocks() → vi.resetAllMocks()
  { from: /jest\.resetAllMocks\(\)/g, to: 'vi.resetAllMocks()' },
  // jest.restoreAllMocks() → vi.restoreAllMocks()
  { from: /jest\.restoreAllMocks\(\)/g, to: 'vi.restoreAllMocks()' },
  // jest.advanceTimersByTime() → vi.advanceTimersByTime()
  { from: /jest\.advanceTimersByTime\(/g, to: 'vi.advanceTimersByTime(' },
  // jest.runAllTimers() → vi.runAllTimers()
  { from: /jest\.runAllTimers\(\)/g, to: 'vi.runAllTimers()' },
  // jest.runOnlyPendingTimers() → vi.runOnlyPendingTimers()
  { from: /jest\.runOnlyPendingTimers\(\)/g, to: 'vi.runOnlyPendingTimers()' },
  // as jest.MockedFunction → as MockedFunction (remove or keep)
  { from: /as jest\.MockedFunction</g, to: 'as any // MockedFunction<' },
  // @jest/globals → vitest
  { from: /@jest\/globals/g, to: 'vitest' },
];

function addVitestImport(content) {
  // 检查是否已经有 vitest 导入
  if (content.includes("from 'vitest'") || content.includes('from "vitest"')) {
    return content;
  }
  
  // 检查文件开头是否有注释
  const lines = content.split('\n');
  let firstImportIndex = 0;
  let inMultilineComment = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过多行注释
    if (line.includes('/**')) {
      inMultilineComment = true;
    }
    if (line.includes('*/')) {
      inMultilineComment = false;
      continue;
    }
    if (inMultilineComment) continue;
    
    // 跳过单行注释
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
    
    // 找到第一个 import 语句
    if (line.startsWith('import ')) {
      firstImportIndex = i;
      break;
    }
  }
  
  // 检查是否需要 vi
  const needsVi = content.includes('vi.fn()') || content.includes('vi.mock(') || content.includes('vi.spyOn(');
  const needsTimer = content.includes('vi.useFakeTimers') || content.includes('vi.advanceTimers');
  
  let vitestImports = ['describe', 'it', 'expect', 'beforeEach', 'afterEach', 'beforeAll', 'afterAll'];
  if (needsVi) vitestImports.push('vi');
  
  const importStatement = `import { ${vitestImports.join(', ')} } from 'vitest';`;
  
  // 在第一个 import 之前插入
  lines.splice(firstImportIndex, 0, importStatement);
  
  return lines.join('\n');
}

function migrateFile(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return { success: false, reason: 'not_found' };
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;
  let changeCount = 0;
  
  // 应用所有替换
  for (const { from, to } of replacements) {
    const matches = content.match(from);
    if (matches && matches.length > 0) {
      changeCount += matches.length;
      content = content.replace(from, to);
      changed = true;
    }
  }
  
  // 添加 Vitest 导入
  if (changed) {
    content = addVitestImport(content);
  }
  
  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ 已迁移 (${changeCount}处): ${filePath}`);
    return { success: true, changes: changeCount };
  } else {
    console.log(`⏭️  无需迁移: ${filePath}`);
    return { success: true, changes: 0 };
  }
}

console.log('🔄 开始批量迁移 Jest 语法到 Vitest...\n');

let totalMigrated = 0;
let totalChanges = 0;
let notFound = 0;

for (const file of filesToMigrate) {
  const result = migrateFile(file);
  if (result.success && result.changes > 0) {
    totalMigrated++;
    totalChanges += result.changes;
  } else if (!result.success) {
    notFound++;
  }
}

console.log(`\n✨ 迁移完成!`);
console.log(`   - 已迁移文件: ${totalMigrated}/${filesToMigrate.length}`);
console.log(`   - 总修改数: ${totalChanges} 处`);
console.log(`   - 未找到文件: ${notFound} 个`);