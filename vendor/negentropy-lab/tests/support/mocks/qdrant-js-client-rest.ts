/**
 * Qdrant client mock for Vitest.
 * Keeps unit tests independent from external qdrant dependency.
 */

type CollectionInfo = { name: string };

const collections = new Map<string, { points_count: number; status: string }>();

export class QdrantClient {
  constructor(_options: Record<string, unknown> = {}) {}

  async getCollections(): Promise<{ collections: CollectionInfo[] }> {
    return {
      collections: Array.from(collections.keys()).map((name) => ({ name })),
    };
  }

  async createCollection(
    name: string,
    _config: Record<string, unknown>,
  ): Promise<{ status: string }> {
    if (!collections.has(name)) {
      collections.set(name, { points_count: 0, status: 'green' });
    }
    return { status: 'ok' };
  }

  async upsert(
    name: string,
    payload: { points?: Array<{ id: string | number }> },
  ): Promise<{ status: string }> {
    const current = collections.get(name) ?? { points_count: 0, status: 'green' };
    current.points_count += payload.points?.length ?? 0;
    collections.set(name, current);
    return { status: 'ok' };
  }

  async search(
    _name: string,
    _payload: Record<string, unknown>,
  ): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    return [];
  }

  async delete(
    _name: string,
    _payload: Record<string, unknown>,
  ): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  async getCollection(
    name: string,
  ): Promise<{ points_count: number; status: string }> {
    return collections.get(name) ?? { points_count: 0, status: 'green' };
  }
}

export default { QdrantClient };
