import type { SiteAdapter } from './types';
import { codeforces } from './codeforces';
import { cses } from './cses';
import { usaco } from './usaco';
import { cpalgorithms } from './cpalgorithms';

import { vjudge } from './vjudge';

const ADAPTERS: SiteAdapter[] = [codeforces, cses, usaco, cpalgorithms, vjudge];

export function resolveAdapter(loc: Location): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(loc)) ?? null;
}
