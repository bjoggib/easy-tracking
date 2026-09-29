import { LocalRepository } from './local';
import { SupabaseRepository } from './supabase';
import type { Repository } from './repository';

export type { Repository } from './repository';

/** Picks the storage backend from NEXT_PUBLIC_STORAGE. */
export function createRepository(): Repository {
  switch (process.env.NEXT_PUBLIC_STORAGE) {
    case 'supabase':
      return new SupabaseRepository();
    default:
      return new LocalRepository();
  }
}
