/**
 * 🚀 向量搜索API路由
 * 
 * @constitution
 * §102 熵减原则：通过语义搜索降低信息检索复杂度
 * §148 控制论架构公理：记忆回路API
 * §306 零停机原则：支持高可用部署
 * 
 * @filename vectorRoutes.ts
 * @version 1.0.0
 * @category API
 * @last_updated 2026-02-26
 */

import { Router, Request, Response } from 'express';
import { getVectorizationPipeline } from '../services/VectorizationPipeline';
import { getQdrantService } from '../services/QdrantService';
import { getOpenClawLogAdapter } from '../adapters/OpenClawLogAdapter';

const router: Router = Router();
const pipeline = getVectorizationPipeline();
const qdrantService = getQdrantService();
const logAdapter = getOpenClawLogAdapter();

/**
 * POST /api/vector/search
 * 语义搜索
 */
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, collection = 'openclaw_logs', limit = 10, scoreThreshold = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '缺少查询参数 query',
      });
    }

    const results = await pipeline.search(collection, query, limit, scoreThreshold);

    res.json({
      success: true,
      query,
      collection,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[VectorAPI] 搜索失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '搜索失败',
    });
  }
});

/**
 * POST /api/vector/index
 * 索引文档
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const { documents, collection = 'openclaw_logs' } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({
        success: false,
        error: '缺少文档数组 documents',
      });
    }

    const tasks = documents.map((doc, index) => ({
      id: doc.id || `doc_${Date.now()}_${index}`,
      content: doc.content,
      metadata: doc.metadata || {},
      collection,
      priority: doc.priority || 'medium' as const,
    }));

    const taskIds = pipeline.addBatchTasks(tasks);
    const results = await pipeline.processQueue();

    res.json({
      success: true,
      indexed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      taskIds,
    });
  } catch (error) {
    console.error('[VectorAPI] 索引失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '索引失败',
    });
  }
});

/**
 * GET /api/vector/collections
 * 获取所有集合
 */
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const collections = await qdrantService.listCollections();

    const collectionDetails = await Promise.all(
      collections.map(async (name) => {
        const info = await qdrantService.getCollectionInfo(name);
        return {
          name,
          pointsCount: info?.pointsCount || 0,
          status: info?.status || 'unknown',
        };
      })
    );

    res.json({
      success: true,
      collections: collectionDetails,
    });
  } catch (error) {
    console.error('[VectorAPI] 获取集合失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取集合失败',
    });
  }
});

/**
 * GET /api/vector/collections/:name
 * 获取集合详情
 */
router.get('/collections/:name', async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name);
    const info = await qdrantService.getCollectionInfo(name);

    if (!info) {
      return res.status(404).json({
        success: false,
        error: `集合 ${name} 不存在`,
      });
    }

    res.json({
      success: true,
      collection: {
        name,
        ...info,
      },
    });
  } catch (error) {
    console.error('[VectorAPI] 获取集合详情失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取集合详情失败',
    });
  }
});

/**
 * DELETE /api/vector/collections/:name
 * 删除集合
 */
router.delete('/collections/:name', async (req: Request, res: Response) => {
  try {
    const name = String(req.params.name);
    const client = qdrantService.getClient();
    await client.deleteCollection(name);

    res.json({
      success: true,
      message: `集合 ${name} 已删除`,
    });
  } catch (error) {
    console.error('[VectorAPI] 删除集合失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除集合失败',
    });
  }
});

/**
 * POST /api/vector/logs/ingest
 * 接收OpenClaw日志
 */
router.post('/logs/ingest', async (req: Request, res: Response) => {
  try {
    const { logs } = req.body;

    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({
        success: false,
        error: '缺少日志数组 logs',
      });
    }

    logAdapter.ingestLogs(logs);

    res.json({
      success: true,
      received: logs.length,
      message: '日志已接收并加入处理队列',
    });
  } catch (error) {
    console.error('[VectorAPI] 接收日志失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '接收日志失败',
    });
  }
});

/**
 * POST /api/vector/logs/search
 * 搜索日志
 */
router.post('/logs/search', async (req: Request, res: Response) => {
  try {
    const { query, limit = 10, filters } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '缺少查询参数 query',
      });
    }

    const results = await logAdapter.searchLogs(query, limit, filters);

    res.json({
      success: true,
      query,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error('[VectorAPI] 搜索日志失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '搜索日志失败',
    });
  }
});

/**
 * GET /api/vector/logs/high-entropy
 * 获取高熵日志
 */
router.get('/logs/high-entropy', async (req: Request, res: Response) => {
  try {
    const limitParam = req.query.limit;
    const limit = parseInt(typeof limitParam === 'string' ? limitParam : '20') || 20;
    const logs = await logAdapter.getHighEntropyLogs(limit);

    res.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('[VectorAPI] 获取高熵日志失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取高熵日志失败',
    });
  }
});

/**
 * GET /api/vector/stats
 * 获取流水线统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = pipeline.getStats();
    const health = await pipeline.healthCheck();

    res.json({
      success: true,
      stats,
      health,
    });
  } catch (error) {
    console.error('[VectorAPI] 获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计失败',
    });
  }
});

/**
 * GET /api/vector/health
 * 健康检查
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const pipelineHealth = await pipeline.healthCheck();
    const qdrantHealth = await qdrantService.healthCheck();
    const logAdapterHealth = await logAdapter.healthCheck();

    const overallStatus = 
      pipelineHealth.status === 'healthy' && 
      qdrantHealth.status === 'healthy' && 
      logAdapterHealth.status === 'healthy'
        ? 'healthy'
        : 'unhealthy';

    res.json({
      success: true,
      status: overallStatus,
      components: {
        pipeline: pipelineHealth,
        qdrant: qdrantHealth,
        logAdapter: logAdapterHealth,
      },
    });
  } catch (error) {
    console.error('[VectorAPI] 健康检查失败:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : '健康检查失败',
    });
  }
});

export default router;
