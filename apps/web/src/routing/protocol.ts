import type { RouteRequest, RouteResult } from '@walkwe/core';

// Messages between the UI thread and the routing worker. Dates cross as ISO
// strings (structured clone keeps Date, but this keeps the protocol plain
// JSON for a future server endpoint).

export type WireRequest = Omit<RouteRequest, 'departAt'> & { departAt: string };

export type ToWorker =
  | { id: number; type: 'warm' }
  | { id: number; type: 'route'; request: WireRequest };

export type FromWorker =
  | { id: number; type: 'ready'; meta: DatasetMeta }
  | { id: number; type: 'result'; result: RouteResult }
  | { id: number; type: 'error'; reason: 'outside-coverage' | 'no-path' | 'data' | 'internal'; message: string };

export interface LayerInfo {
  id: 'walkways' | 'buildings' | 'trees' | 'elevated' | 'malls' | 'cctv' | 'lamps' | 'pois' | 'incidents';
  sources: Array<{ name: string; url: string; license: string; notes?: string | undefined }>;
  updatedAt: string;
  count: number;
}

export interface DatasetMeta {
  updatedAt: string;
  osmUpdatedAt: string;
  /** Share of buildings whose height is an estimate, 0..1. */
  estimatedHeightShare: number;
  /** Day-mode sources (walkways + shade casters). */
  sources: Array<{ name: string; license: string }>;
  /** Every layer, for the data-limitations page. */
  layers: LayerInfo[];
  /** Share of walkway length with lighting from data (tag/lamp), 0..1. */
  litKnownShare: number;
  malls: { total: number; withHours: number };
  incidents: { total: number; placeholders: number };
}
