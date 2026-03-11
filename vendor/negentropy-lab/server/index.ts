import { createNegentropyServer } from './bootstrap/createNegentropyServer';
import { buildServerOptionsFromEnv } from './bootstrap/serverProcessOptions';
import { activeRooms } from './runtime/activeRooms';

let serverInstancePromise = createNegentropyServer(buildServerOptionsFromEnv());

serverInstancePromise.catch((error) => {
  console.error('[Server] 启动失败', error);
  process.exitCode = 1;
});

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝:', reason);
});

export { activeRooms, serverInstancePromise };
