import { env } from '../env.js';

/**
 * Redis key namespacing.
 *
 * Every key this service writes goes through here. The namespace comes from the
 * environment so that a test run, a preview deployment and production can share
 * a Redis without a cache entry from one being served to another — which, when
 * the cached value is a market's commission rate keyed by a database UUID, is
 * not a stale-cache bug but a wrong-money bug.
 */
export function key(...parts: readonly (string | number)[]): string {
  return [env().REDIS_NAMESPACE, ...parts].join(':');
}

export function namespacePrefix(): string {
  return `${env().REDIS_NAMESPACE}:`;
}
