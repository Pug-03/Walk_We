import { RoutingError, type RouteRequest, type RouteResult, type RoutingEngine } from '@walkwe/core';
import type { DatasetMeta, FromWorker, ToWorker } from './protocol.ts';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

export class RoutingFailure extends Error {
  constructor(readonly reason: 'outside-coverage' | 'no-path' | 'data' | 'internal', message: string) {
    super(message);
  }
}

/**
 * RoutingEngine that runs AreaRouter in a Web Worker. Swapping in a server
 * (GraphHopper, an API) means another RoutingEngine — the UI doesn't change.
 */
export class WorkerRoutingEngine implements RoutingEngine {
  readonly id = 'worker-area-astar';
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, { resolve: (m: FromWorker) => void; reject: (e: Error) => void }>();
  private metaPromise: Promise<DatasetMeta> | null = null;

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
        this.pending.get(e.data.id)?.resolve(e.data);
        this.pending.delete(e.data.id);
      };
      // A worker that fails to load or crashes (e.g. out of memory on an old
      // phone) must not leave the planner spinning: fail every waiting call
      // and start fresh next time.
      const fail = () => {
        for (const p of this.pending.values()) p.reject(new Error('routing worker failed'));
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
        this.metaPromise = null;
      };
      this.worker.onerror = fail;
      this.worker.onmessageerror = fail;
    }
    return this.worker;
  }

  private send(msg: WithoutId<ToWorker>): Promise<FromWorker> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ensure().postMessage({ ...msg, id } as ToWorker);
    });
  }

  /** Start loading the dataset early (e.g. once both points are picked). */
  warm(): Promise<DatasetMeta> {
    this.metaPromise ??= this.send({ type: 'warm' }).then((m) => {
      if (m.type === 'ready') return m.meta;
      this.metaPromise = null;
      throw new RoutingFailure(m.type === 'error' ? m.reason : 'internal', m.type === 'error' ? m.message : '');
    });
    return this.metaPromise;
  }

  async route(request: RouteRequest): Promise<RouteResult> {
    const m = await this.send({ type: 'route', request: { ...request, departAt: request.departAt.toISOString() } });
    if (m.type === 'result') return m.result;
    if (m.type === 'error' && (m.reason === 'outside-coverage' || m.reason === 'no-path')) throw new RoutingError(m.reason, m.message);
    throw new RoutingFailure(m.type === 'error' ? m.reason : 'internal', m.type === 'error' ? m.message : 'unexpected reply');
  }
}
