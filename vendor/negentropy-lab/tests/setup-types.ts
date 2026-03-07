/**
 * Jest Setup File for Type Definitions
 *
 * This file provides type definitions for Jest tests to resolve
 * PluginHookHandlerMap and other imported types.
 */

import type {
  PluginApi,
  PluginHookHandlerMap,
  PluginDefinition,
} from '../server/plugins/types/plugin-interfaces';

// Export types to make them available in tests
export type { PluginApi, PluginHookHandlerMap, PluginDefinition };
