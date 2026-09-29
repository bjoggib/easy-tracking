'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRepository, type Repository } from './storage';
import { emptyData, type AppData, type DayEntry, type Food, type Recipe, type Settings } from './types';

type Store = {
  data: AppData;
  storageLabel: string;
  toast: (msg: string) => void;
  setTargets: (patch: Partial<Settings>) => void;
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  saveFood: (food: Food) => void;
  deleteFood: (id: string) => void;
  setEntries: (date: string, entries: DayEntry[]) => void;
  setWeight: (date: string, field: 'am' | 'pm', value: number | null) => void;
};

const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <DataProvider>');
  return s;
}

/** For chrome outside the loading gate (header): null until data has loaded. */
export function useOptionalStore() {
  return useContext(Ctx);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository | null>(null);
  const dataRef = useRef<AppData | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3600);
  }, []);

  useEffect(() => {
    const repo = createRepository();
    repoRef.current = repo;
    repo
      .load()
      .then(d => { dataRef.current = d; setData(d); })
      .catch(err => {
        console.error(err);
        const d = emptyData();
        dataRef.current = d;
        setData(d);
        toast('Saved data could not be read, so the app started empty.');
      });
  }, [toast]);

  /** Apply a change to local state immediately, then persist it. */
  const commit = useCallback(
    (change: (d: AppData) => AppData, write: (repo: Repository, next: AppData) => Promise<void>) => {
      const cur = dataRef.current;
      const repo = repoRef.current;
      if (!cur || !repo) return;
      const next = change(cur);
      dataRef.current = next;
      setData(next);
      write(repo, next).catch(err => {
        console.error(err);
        toast('That change did not save. Your browser may be blocking storage.');
      });
    },
    [toast],
  );

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    return {
      data,
      storageLabel: repoRef.current?.label ?? '',
      toast,
      setTargets: patch =>
        commit(
          d => ({ ...d, settings: { ...d.settings, ...patch } }),
          (repo, next) => repo.saveSettings(next.settings),
        ),
      saveRecipe: recipe =>
        commit(
          d => ({ ...d, recipes: { ...d.recipes, [recipe.id]: recipe } }),
          repo => repo.upsertRecipe(recipe),
        ),
      deleteRecipe: id =>
        commit(
          d => {
            const recipes = { ...d.recipes };
            delete recipes[id];
            return { ...d, recipes };
          },
          repo => repo.deleteRecipe(id),
        ),
      saveFood: food =>
        commit(
          d => ({ ...d, foods: { ...d.foods, [food.id]: food } }),
          repo => repo.upsertFood(food),
        ),
      deleteFood: id =>
        commit(
          d => {
            const foods = { ...d.foods };
            delete foods[id];
            return { ...d, foods };
          },
          repo => repo.deleteFood(id),
        ),
      setEntries: (date, entries) =>
        commit(
          d => {
            const days = { ...d.days };
            if (entries.length) days[date] = { date, entries };
            else delete days[date];
            return { ...d, days };
          },
          repo => (entries.length ? repo.upsertDay({ date, entries }) : repo.deleteDay(date)),
        ),
      setWeight: (date, field, value) =>
        commit(
          d => {
            const weights = { ...d.weights };
            const w = { ...(weights[date] ?? { date, am: null, pm: null }), [field]: value };
            if (w.am == null && w.pm == null) delete weights[date];
            else weights[date] = w;
            return { ...d, weights };
          },
          (repo, next) => (next.weights[date] ? repo.upsertWeight(next.weights[date]) : repo.deleteWeight(date)),
        ),
    };
  }, [data, commit, toast]);

  return (
    <>
      <Ctx.Provider value={store}>{children}</Ctx.Provider>
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </>
  );
}
