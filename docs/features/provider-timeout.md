# Model Provider Timeout Configuration

## Overview

This feature allows configuring custom timeout settings for LLM model providers, enabling longer-running requests for complex tasks.

## Feature Status

- **Added**: 2026-02-12
- **Version**: OpenClaw 2026.2.12+
- **Author**: 办公厅主任

## Configuration

### Schema Changes

Added `timeoutMs` field to `ModelProviderSchema` in `src/config/zod-schema.core.ts`:

```typescript
export const ModelProviderSchema = z
  .object({
    baseUrl: z.string().min(1),
    apiKey: z.string().optional(),
    auth: z.union([...]).optional(),
    api: ModelApiSchema.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    authHeader: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional(), // New field
    models: z.array(ModelDefinitionSchema),
  })
  .strict();
```

### Type Definition

Added `timeoutMs` field to `ModelProviderConfig` in `src/config/types.models.ts`:

```typescript
export type ModelProviderConfig = {
  baseUrl: string;
  apiKey?: string;
  auth?: ModelProviderAuthMode;
  api?: ModelApi;
  headers?: Record<string, string>;
  authHeader?: boolean;
  timeoutMs?: number; // New field
  models: ModelDefinitionConfig[];
};
```

## Usage

### Configuration Example

In `~/.openclaw/openclaw.json`:

```json
{
  "models": {
    "providers": {
      "zai": {
        "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
        "apiKey": "your-api-key",
        "api": "openai-completions",
        "timeoutMs": 900000,
        "models": [
          {
            "id": "glm-4.7",
            "name": "GLM 4.7",
            "contextWindow": 204800,
            "maxTokens": 131072
          }
        ]
      }
    }
  }
}
```

### Timeout Values

- **Default**: 600000ms (10 minutes) - if not specified
- **Recommended Range**: 60000ms (1 minute) to 1800000ms (30 minutes)
- **Unit**: Milliseconds (ms)

## Use Cases

1. **Long-Running Agent Tasks**: Agents performing complex analysis or code generation tasks
2. **Large File Processing**: Tasks involving large codebases or documents
3. **High-Complexity Operations**: Multi-step reasoning or planning tasks

## Implementation Details

### Files Modified

1. `src/config/zod-schema.core.ts` - Added `timeoutMs` to schema
2. `src/config/types.models.ts` - Added `timeoutMs` to type definition
3. Configuration validation now accepts `timeoutMs` field

### Backward Compatibility

- ✅ Fully backward compatible
- ✅ Optional field - existing configurations without `timeoutMs` continue to work
- ✅ No breaking changes to API or behavior

## Testing

To verify the configuration is working:

```bash
# 1. Add timeoutMs to your configuration
# 2. Restart OpenClaw Gateway
openclaw gateway restart

# 3. Check for validation errors
openclaw doctor

# 4. Monitor logs for timeout-related messages
tail -f ~/.openclaw/logs/gateway.log | grep -i timeout
```

## Future Enhancements

Potential improvements for future versions:

1. **Per-Model Timeout**: Allow different timeout values for different models within the same provider
2. **Dynamic Timeout Adjustment**: Automatically adjust timeout based on task complexity
3. **Timeout Metrics**: Track and report timeout statistics
4. **Adaptive Timeout**: Machine learning-based timeout prediction

## Troubleshooting

### Issue: Configuration Validation Error

**Error**: `models.providers.zai: Unrecognized key: "timeoutMs"`

**Solution**:

- Ensure you're using OpenClaw 2026.2.12 or later
- Run `openclaw doctor --fix` to remove invalid keys
- Restart Gateway after configuration changes

### Issue: Timeout Still Occurring

**Possible Causes**:

1. Provider-side timeout (independent of OpenClaw timeout)
2. Network connectivity issues
3. Provider API rate limiting

**Solution**:

- Increase `timeoutMs` value
- Check provider documentation for their timeout limits
- Monitor network connectivity

## Related Documentation

- [OpenClaw Configuration Guide](../README.md#configuration)
- [Model Provider Setup](./model-providers.md)
- [Agent Task Management](./agent-tasks.md)

---

**Last Updated**: 2026-02-12  
**Maintainer**: OpenClaw Team
