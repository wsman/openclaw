/**
 * 🚀 openclaw模块
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * 
 * @filename openclaw.ts
 * @version 1.0.0
 * @category general
 * @last_updated 2026-02-11
 */
import { Router } from 'express';
import { Server } from 'colyseus';
import { activeRooms } from '../index';

export function createOpenClawRouter(gameServer: Server): Router {
    const router = Router();

    router.post('/', (req, res) => {
        const { type, source, content, timestamp } = req.body;

        if (!type || !source || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const payload = {
            type,
            source,
            content,
            timestamp: timestamp || new Date().toISOString()
        };

        // Broadcast to all active rooms
        activeRooms.forEach(room => {
            room.broadcast("openclaw-event", payload);
        });

        console.log(`[OpenClaw Hook] Received ${type} from ${source}. Broadcasted to ${activeRooms.size} rooms.`);
        res.status(200).json({ status: 'success' });
    });

    return router;
}
