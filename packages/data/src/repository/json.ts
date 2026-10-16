import type { DataRepository } from '@walkwe/core';

export interface JsonRepositoryOptions {
  /** Where dataset files are served from, e.g. "/data/". */
  baseUrl: string;
  fetch?: typeof fetch;
}

/** DataRepository over static JSON files: `${baseUrl}${dataset}.json`. */
export class JsonRepository implements DataRepository {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl, fetch: fetchImpl }: JsonRepositoryOptions) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    this.fetchImpl = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async load<T>(dataset: string, parse: (raw: unknown) => T, opts: { signal?: AbortSignal } = {}): Promise<T> {
    if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(dataset) || dataset.includes('..')) {
      throw new Error(`Invalid dataset name: ${dataset}`);
    }
    const res = await this.fetchImpl(`${this.baseUrl}${dataset}.json`, opts.signal ? { signal: opts.signal } : {});
    if (!res.ok) throw new Error(`Dataset ${dataset}: HTTP ${res.status}`);
    return parse(await res.json());
  }
}
