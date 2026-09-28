import type { AppData, DayLog, Recipe, Settings, WeightEntry } from '../types';

/**
 * Everything the app needs from persistence. The UI only talks to this interface,
 * so swapping localStorage for Supabase means adding one implementation.
 * Writes are per entity (one recipe, one day, one weight date), which maps 1:1 onto table rows.
 */
export interface Repository {
  /** Short text shown in the header, e.g. "Saved in this browser". */
  readonly label: string;
  load(): Promise<AppData>;
  saveSettings(settings: Settings): Promise<void>;
  upsertRecipe(recipe: Recipe): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  upsertDay(day: DayLog): Promise<void>;
  deleteDay(date: string): Promise<void>;
  upsertWeight(entry: WeightEntry): Promise<void>;
  deleteWeight(date: string): Promise<void>;
}
