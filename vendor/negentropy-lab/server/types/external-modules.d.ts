declare module 'commander' {
  export class Command {
    [key: string]: any;
    constructor(name?: string);
    name(value?: string): this;
    description(value?: string): this;
    version(value?: string): this;
    command(nameAndArgs: string): this;
    argument(name: string, description?: string): this;
    option(flags: string, description?: string, defaultValue?: any): this;
    requiredOption(flags: string, description?: string, defaultValue?: any): this;
    action(fn: (...args: any[]) => any): this;
    addCommand(cmd: Command): this;
    parse(argv?: readonly string[]): this;
    parseAsync(argv?: readonly string[]): Promise<this>;
    opts<T = any>(): T;
  }
}

declare module '@qdrant/js-client-rest' {
  export class QdrantClient {
    [key: string]: any;
    constructor(config?: Record<string, any>);
    getCollections(): Promise<{ collections: Array<{ name: string }> }>;
    createCollection(name: string, options: Record<string, any>): Promise<any>;
    upsert(collectionName: string, payload: Record<string, any>): Promise<any>;
    search(collectionName: string, payload: Record<string, any>): Promise<Array<{ id: string | number; score: number; payload: unknown }>>;
    delete(collectionName: string, payload: Record<string, any>): Promise<any>;
  }
}

declare module 'multicast-dns' {
  type MdnsClient = {
    on: (event: string, handler: (...args: any[]) => void) => void;
    query: (query: any) => void;
    respond: (response: any) => void;
    destroy: () => void;
  };

  export default function mdns(options?: Record<string, any>): MdnsClient;
}

declare module 'colyseus.js' {
  export class Client {
    constructor(endpoint: string);
    joinOrCreate(roomName: string, options?: Record<string, any>): Promise<{
      sessionId: string;
      state: any;
      send: (type: string, message?: any) => void;
      leave: () => Promise<void>;
    }>;
  }
}

