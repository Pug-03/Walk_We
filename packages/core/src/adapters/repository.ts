/**
 * Read access to published datasets (sidewalk graph, shade layers, routes,
 * incidents). Today: static JSON files. Later: an API backed by
 * Postgres/PostGIS. Callers pass a dataset name and a parser (a Zod schema's
 * parse in practice) so validation happens at the boundary, whatever the
 * backend.
 */
export interface DataRepository {
  load<T>(dataset: string, parse: (raw: unknown) => T, opts?: { signal?: AbortSignal }): Promise<T>;
}
