import type { SiteAdapter } from './types';
import { codeforces } from './codeforces';
import { cses } from './cses';

const ADAPTERS: SiteAdapter[] = [codeforces, cses];

export function resolveAdapter(loc: Location): SiteAdapter | null {
  return ADAPTERS.find((a) => a.matches(loc)) ?? null;
}
