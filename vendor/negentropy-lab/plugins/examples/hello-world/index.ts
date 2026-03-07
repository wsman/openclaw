/**
 * Hello World example plugin.
 */

import type {
  PluginApi,
  PluginDefinition,
  PluginHookHandlerMap,
} from '../../../server/plugins/types/plugin-interfaces';

const onSystemStart: PluginHookHandlerMap['system_start'] = async () => {
  console.log('\n========================================');
  console.log('System Started');
  console.log('========================================\n');
};

const onSystemStop: PluginHookHandlerMap['system_stop'] = async () => {
  console.log('\n========================================');
  console.log('System Stopped');
  console.log('========================================\n');
};

const onPluginLoaded: PluginHookHandlerMap['plugin_loaded'] = async (event) => {
  console.log(`Plugin loaded: ${event.pluginId}`);
};

const onBeforeAgentTask: PluginHookHandlerMap['before_agent_task'] = async (event, ctx) => {
  console.log(`Agent task starting: ${event.taskId ?? 'unknown'}`);
  console.log(`Complexity: ${ctx.complexity ?? 'unknown'}`);
};

const onAfterAgentTask: PluginHookHandlerMap['after_agent_task'] = async (event) => {
  console.log(`Agent task completed: ${event.taskId ?? 'unknown'} (${event.success ?? false})`);
};

const onMessageReceived: PluginHookHandlerMap['message_received'] = async (event) => {
  console.log(`Message received: ${event.content ?? ''}`);
};

const onMessageSent: PluginHookHandlerMap['message_sent'] = async (event) => {
  console.log(`Message sent: ${event.content ?? ''}`);
};

const onConfigChanged: PluginHookHandlerMap['config_changed'] = async (_event, ctx) => {
  console.log(`Configuration changed: ${ctx.key ?? 'unknown'}`);
};

const onErrorOccurred: PluginHookHandlerMap['error_occurred'] = async (_event, ctx) => {
  console.error(`Error occurred: ${ctx.errorMessage ?? 'unknown'}`);
};

const registerHooks = (api: PluginApi): void => {
  api.on('system_start', onSystemStart);
  api.on('system_stop', onSystemStop);
  api.on('plugin_loaded', onPluginLoaded);
  api.on('before_agent_task', onBeforeAgentTask, { priority: 10 });
  api.on('after_agent_task', onAfterAgentTask, { priority: 10 });
  api.on('message_received', onMessageReceived);
  api.on('message_sent', onMessageSent);
  api.on('config_changed', onConfigChanged);
  api.on('error_occurred', onErrorOccurred);
  api.logger.info('All hooks registered successfully');
};

export default {
  id: 'hello-world',
  name: 'Hello World Plugin',
  description: 'A simple example plugin for Negentropy-Lab',
  version: '1.0.0',
  kind: 'core',
  main: 'index.ts',
  openclawCompat: true,
  negentropy: {
    agentIntegration: {
      model: 'google-antigravity/gemini-3-flash',
      timeout: 30000,
      depth: 5,
      permissions: ['read', 'write'],
    },
    entropyMonitor: {
      metrics: ['cpu', 'memory', 'disk'],
      thresholds: {
        cpu: 80,
        memory: 90,
        disk: 85,
      },
      alertLevel: 'warn',
    },
    constitutionalCompliance: {
      requiredClauses: ['§101', '§102', '§108', '§118', '§306'],
      validationRules: {
        type: 'object',
        rules: [
          {
            name: 'Model Specification',
            description: 'Model must be explicitly specified',
            type: 'required',
          },
          {
            name: 'Timeout Configuration',
            description: 'Timeout must be configured for L4 tasks',
            type: 'required',
          },
        ],
      },
    },
  },

  async initialize(api: PluginApi): Promise<void> {
    api.logger.info('Hello World plugin initialized!');
  },

  async activate(api: PluginApi): Promise<void> {
    api.logger.info('Hello World plugin activated!');
    registerHooks(api);
  },

  async deactivate(api: PluginApi): Promise<void> {
    api.logger.info('Hello World plugin deactivated!');
  },

  async cleanup(api: PluginApi): Promise<void> {
    api.logger.info('Hello World plugin cleaned up!');
  },
} as PluginDefinition;
