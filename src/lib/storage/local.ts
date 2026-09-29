import { emptyData, type AppData, type DayLog, type Food, type Recipe, type Settings, type WeightEntry } from '../types';
import type { Repository } from './repository';

export const LOCAL_KEY = 'easy-tracking-v1';
/** Key used before the app was renamed; its data is moved to LOCAL_KEY on first load. */
const OLD_KEY = 'plate-and-scale-v1';

/** Keeps the whole dataset as one JSON blob in localStorage. Only call from the browser. */
export class LocalRepository implements Repository {
  readonly label = 'Saved in this browser';
  private data: AppData = emptyData();

  async load() {
    const base = emptyData();
    const old = window.localStorage.getItem(OLD_KEY);
    if (old != null && window.localStorage.getItem(LOCAL_KEY) == null) window.localStorage.setItem(LOCAL_KEY, old);
    window.localStorage.removeItem(OLD_KEY);
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<AppData>;
      this.data = {
        settings: { ...base.settings, ...(d.settings ?? {}) },
        recipes: d.recipes ?? {},
        foods: d.foods ?? {},
        days: d.days ?? {},
        weights: d.weights ?? {},
      };
    } else {
      this.data = base;
    }
    return structuredClone(this.data);
  }

  private async flush() {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(this.data));
  }

  saveSettings(s: Settings) { this.data.settings = { ...s }; return this.flush(); }
  upsertRecipe(r: Recipe) { this.data.recipes[r.id] = structuredClone(r); return this.flush(); }
  deleteRecipe(id: string) { delete this.data.recipes[id]; return this.flush(); }
  upsertFood(f: Food) { this.data.foods[f.id] = { ...f }; return this.flush(); }
  deleteFood(id: string) { delete this.data.foods[id]; return this.flush(); }
  upsertDay(d: DayLog) { this.data.days[d.date] = structuredClone(d); return this.flush(); }
  deleteDay(date: string) { delete this.data.days[date]; return this.flush(); }
  upsertWeight(w: WeightEntry) { this.data.weights[w.date] = { ...w }; return this.flush(); }
  deleteWeight(date: string) { delete this.data.weights[date]; return this.flush(); }
}
