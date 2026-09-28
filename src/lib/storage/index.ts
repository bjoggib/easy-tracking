import { LocalRepository } from './local';
import type { Repository } from './repository';

export type { Repository } from './repository';

/**
 * Picks the storage backend. When Supabase is ready, add a SupabaseRepository
 * implementing `Repository` and return it here when NEXT_PUBLIC_STORAGE === 'supabase'.
 */
export function createRepository(): Repository {
  switch (process.env.NEXT_PUBLIC_STORAGE) {
    // case 'supabase': return new SupabaseRepository();
    default:
      return new LocalRepository();
  }
}
