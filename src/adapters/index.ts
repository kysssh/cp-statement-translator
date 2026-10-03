import type { SiteAdapter } from './types';
import { codeforces } from './codeforces';
import { cses } from './cses';
import { usaco } from './usaco';

const ADAPTERS: SiteAdapter[] = [codeforces, cses, usaco];

export function resolveAdapter(loc: Location): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(loc)) ?? null;
}
