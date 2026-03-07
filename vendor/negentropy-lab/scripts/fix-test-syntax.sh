#!/bin/bash

# 修复测试文件中的语法错误
# 修复: () => resolve(); 应该是 () => resolve())

FILES=(
  "tests/integration/plugins/agent-websocket-integration.test.ts"
  "tests/e2e/long-running-task-e2e.test.ts"
  "tests/e2e/multi-client-concurrency-e2e.test.ts"
  "tests/e2e/failure-recovery-e2e.test.ts"
  "tests/integration/plugins/full-workflow-integration.test.ts"
  "tests/integration/plugins/agent-monitor-integration.test.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Fixing syntax errors in $file"
    # 修复：() => resolve(); -> () => resolve())
    sed -i 's/() => resolve();/() => resolve())/g' "$file"
    # 修复：); 而不是 );)
    sed -i 's/} ));/} );/g' "$file"
  else
    echo "File not found: $file"
  fi
done

echo "Syntax fix complete!"
