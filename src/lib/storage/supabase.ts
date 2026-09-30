import { supabase } from '../supabase';
import { DEFAULT_SHOWN, emptyData, type AppData, type DayLog, type Food, type Recipe, type Settings, type WeightEntry } from '../types';
import { LOCAL_KEY, LocalRepository } from './local';
import type { Repository } from './repository';

/** Public storage bucket for food photos; see supabase/003_food_photos.sql. */
const IMAGE_BUCKET = 'food-images';

/** Set once browser data has been copied up, so it is never imported twice. */
const IMPORTED_KEY = 'easy-tracking-imported';

/** Throws the PostgREST error if there is one, otherwise returns the rows. */
function ok<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

/**
 * One row per entity. `user_id` is filled by the column default (auth.uid()) and
 * row level security limits every query to the signed-in user's rows.
 */
export class SupabaseRepository implements Repository {
  readonly label = 'Synced';
  private db = supabase();

  async load(): Promise<AppData> {
    const [settings, recipes, foods, days, weights] = await Promise.all([
      this.db.from('settings').select('kcal, p, c, f, units, show').maybeSingle().then(ok<Settings | null>),
      this.db.from('recipes').select('id, name, servings, ingredients, updated_at').then(ok<RecipeRow[]>),
      this.db.from('foods').select(FOOD_COLUMNS).then(ok<FoodRow[]>),
      this.db.from('day_logs').select('date, entries').then(ok<DayLog[]>),
      this.db.from('weights').select('date, am, pm').then(ok<WeightEntry[]>),
    ]);

    if (!settings && !recipes.length && !foods.length && !days.length && !weights.length) {
      const imported = await this.importFromBrowser();
      if (imported) return imported;
    }

    const base = emptyData();
    return {
      settings: settings ?? base.settings,
      recipes: Object.fromEntries(recipes.map(r => [r.id, fromRow(r)])),
      foods: Object.fromEntries(foods.map(f => [f.id, foodFromRow(f)])),
      days: Object.fromEntries(days.map(d => [d.date, d])),
      weights: Object.fromEntries(weights.map(w => [w.date, w])),
    };
  }

  /** First sign-in on a browser that already has local data: copy it up once. */
  private async importFromBrowser(): Promise<AppData | null> {
    if (localStorage.getItem(IMPORTED_KEY) || !localStorage.getItem(LOCAL_KEY)) return null;
    const d = await new LocalRepository().load();
    await Promise.all([
      this.saveSettings(d.settings),
      this.db.from('recipes').upsert(Object.values(d.recipes).map(toRow)).then(ok),
      this.db.from('foods').upsert(Object.values(d.foods).map(foodToRow)).then(ok),
      this.db.from('day_logs').upsert(Object.values(d.days)).then(ok),
      this.db.from('weights').upsert(Object.values(d.weights)).then(ok),
    ]);
    localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
    return d;
  }

  async saveSettings(s: Settings) {
    ok(await this.db.from('settings').upsert({ kcal: s.kcal, p: s.p, c: s.c, f: s.f, units: s.units ?? 'metric', show: s.show ?? DEFAULT_SHOWN }));
  }
  async upsertRecipe(r: Recipe) {
    ok(await this.db.from('recipes').upsert(toRow(r)));
  }
  async deleteRecipe(id: string) {
    ok(await this.db.from('recipes').delete().eq('id', id));
  }
  async upsertFood(f: Food) {
    ok(await this.db.from('foods').upsert(foodToRow(f)));
  }
  async deleteFood(id: string) {
    ok(await this.db.from('foods').delete().eq('id', id));
    // Remove an uploaded photo too, if there is one; a missing file is not an error.
    const path = await this.imagePath(id).catch(() => null);
    if (path) await this.db.storage.from(IMAGE_BUCKET).remove([path]);
  }
  async uploadFoodImage(foodId: string, image: Blob) {
    const path = await this.imagePath(foodId);
    const { error } = await this.db.storage.from(IMAGE_BUCKET).upload(path, image, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw error;
    const { data } = this.db.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    // Same path on replace, so bust caches with a version.
    return `${data.publicUrl}?v=${Date.now()}`;
  }
  /** Each user's photos live in a folder named after their user id (enforced by storage policies). */
  private async imagePath(foodId: string) {
    const { data } = await this.db.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) throw new Error('Not signed in');
    return `${uid}/${foodId}.jpg`;
  }
  async upsertDay(d: DayLog) {
    ok(await this.db.from('day_logs').upsert({ date: d.date, entries: d.entries }));
  }
  async deleteDay(date: string) {
    ok(await this.db.from('day_logs').delete().eq('date', date));
  }
  async upsertWeight(w: WeightEntry) {
    ok(await this.db.from('weights').upsert({ date: w.date, am: w.am, pm: w.pm }));
  }
  async deleteWeight(date: string) {
    ok(await this.db.from('weights').delete().eq('date', date));
  }
}

type RecipeRow = Omit<Recipe, 'updatedAt'> & { updated_at: string };

const toRow = ({ updatedAt, ...r }: Recipe): RecipeRow => ({ ...r, updated_at: updatedAt });
const fromRow = ({ updated_at, ...r }: RecipeRow): Recipe => ({ ...r, updatedAt: updated_at });

const FOOD_COLUMNS = 'id, name, brand, unit, code, source, image, kcal, p, c, f, sugar, fibre, salt, updated_at';
type FoodRow = Omit<Food, 'updatedAt' | 'brand' | 'code' | 'image'> & {
  brand: string | null;
  code: string | null;
  image: string | null;
  updated_at: string;
};

const foodToRow = ({ updatedAt, brand, code, image, ...f }: Food): FoodRow => ({
  ...f,
  brand: brand ?? null,
  code: code ?? null,
  image: image ?? null,
  updated_at: updatedAt,
});
const foodFromRow = ({ updated_at, brand, code, image, ...f }: FoodRow): Food => ({
  ...f,
  ...(brand ? { brand } : {}),
  ...(code ? { code } : {}),
  ...(image ? { image } : {}),
  updatedAt: updated_at,
});
