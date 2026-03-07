/**
 * 审批流程系统
 * 
 * @module approval/workflow
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// 审批请求
export interface ApprovalRequest {
  id: string;
  command: string;
  commandType: string;
  source: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approver?: string;
  approvedAt?: number;
  approvalNote?: string;
  metadata?: Record<string, any>;
}

// 审批统计
export interface ApprovalStats {
  pendingCount: number;
  todayApproved: number;
  todayRejected: number;
  avgApprovalTime: number;
  approvalRate: number;
}

/**
 * 审批工作流
 */
export class ApprovalWorkflow {
  private queue: ApprovalRequest[] = [];
  private history: ApprovalRequest[] = [];
  private stats: ApprovalStats = {
    pendingCount: 0,
    todayApproved: 0,
    todayRejected: 0,
    avgApprovalTime: 0,
    approvalRate: 0,
  };

  /**
   * 创建审批请求
   */
  createRequest(params: {
    command: string;
    commandType: string;
    source: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    expiresIn?: number;
    metadata?: Record<string, any>;
  }): ApprovalRequest {
    const expiresIn = params.expiresIn || 3600000; // 默认1小时

    const request: ApprovalRequest = {
      id: uuidv4(),
      command: params.command,
      commandType: params.commandType,
      source: params.source,
      riskLevel: params.riskLevel,
      reason: params.reason,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      status: 'pending',
      metadata: params.metadata,
    };

    this.queue.push(request);
    this.stats.pendingCount = this.queue.length;

    logger.info(`Created approval request: ${request.id}`);
    return request;
  }

  /**
   * 获取待审批队列
   */
  getQueue(): ApprovalRequest[] {
    return this.queue.filter((r) => r.status === 'pending');
  }

  /**
   * 批准请求
   */
  approve(requestId: string, approver: string, note?: string): boolean {
    const request = this.queue.find((r) => r.id === requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'approved';
    request.approver = approver;
    request.approvedAt = Date.now();
    request.approvalNote = note;

    this.history.push(request);
    this.queue = this.queue.filter((r) => r.id !== requestId);
    this.updateStats('approved', request.approvedAt - request.createdAt);

    logger.info(`Approved request: ${requestId} by ${approver}`);
    return true;
  }

  /**
   * 拒绝请求
   */
  reject(requestId: string, approver: string, note?: string): boolean {
    const request = this.queue.find((r) => r.id === requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    request.status = 'rejected';
    request.approver = approver;
    request.approvedAt = Date.now();
    request.approvalNote = note;

    this.history.push(request);
    this.queue = this.queue.filter((r) => r.id !== requestId);
    this.updateStats('rejected');

    logger.info(`Rejected request: ${requestId} by ${approver}`);
    return true;
  }

  /**
   * 过期处理
   */
  expireRequests(): void {
    const now = Date.now();
    this.queue.forEach((request) => {
      if (request.expiresAt < now && request.status === 'pending') {
        request.status = 'expired';
        this.history.push(request);
        logger.warn(`Request expired: ${request.id}`);
      }
    });
    this.queue = this.queue.filter((r) => r.status === 'pending');
    this.stats.pendingCount = this.queue.length;
  }

  /**
   * 更新统计
   */
  private updateStats(action: 'approved' | 'rejected', duration?: number): void {
    if (action === 'approved') {
      this.stats.todayApproved++;
      if (duration) {
        this.stats.avgApprovalTime = 
          (this.stats.avgApprovalTime + duration) / 2;
      }
    } else {
      this.stats.todayRejected++;
    }
    
    this.stats.pendingCount = this.queue.length;
    this.stats.approvalRate = 
      (this.stats.todayApproved / (this.stats.todayApproved + this.stats.todayRejected)) * 100;
  }

  /**
   * 获取统计
   */
  getStats(): ApprovalStats {
    return { ...this.stats };
  }

  /**
   * 获取历史
   */
  getHistory(limit = 100): ApprovalRequest[] {
    return this.history.slice(0, limit);
  }
}

// 全局实例
export const approvalWorkflow = new ApprovalWorkflow();
