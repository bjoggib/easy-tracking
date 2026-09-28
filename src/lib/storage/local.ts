import { emptyData, type AppData, type DayLog, type Recipe, type Settings, type WeightEntry } from '../types';
import type { Repository } from './repository';

const KEY = 'plate-and-scale-v1';

/** Keeps the whole dataset as one JSON blob in localStorage. Only call from the browser. */
export class LocalRepository implements Repository {
  readonly label = 'Saved in this browser';
  private data: AppData = emptyData();

  async load() {
    const base = emptyData();
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<AppData>;
      this.data = {
        settings: { ...base.settings, ...(d.settings ?? {}) },
        recipes: d.recipes ?? {},
        days: d.days ?? {},
        weights: d.weights ?? {},
      };
    } else {
      this.data = base;
    }
    return structuredClone(this.data);
  }

  private async flush() {
    window.localStorage.setItem(KEY, JSON.stringify(this.data));
  }

  saveSettings(s: Settings) { this.data.settings = { ...s }; return this.flush(); }
  upsertRecipe(r: Recipe) { this.data.recipes[r.id] = structuredClone(r); return this.flush(); }
  deleteRecipe(id: string) { delete this.data.recipes[id]; return this.flush(); }
  upsertDay(d: DayLog) { this.data.days[d.date] = structuredClone(d); return this.flush(); }
  deleteDay(date: string) { delete this.data.days[date]; return this.flush(); }
  upsertWeight(w: WeightEntry) { this.data.weights[w.date] = { ...w }; return this.flush(); }
  deleteWeight(date: string) { delete this.data.weights[date]; return this.flush(); }
}
