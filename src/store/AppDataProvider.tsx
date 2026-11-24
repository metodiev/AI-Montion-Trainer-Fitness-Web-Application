import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData, AppSettings, PlannerPreferences, SessionCompletion, WorkoutRecord } from '@/game/types';
import { completeWorkout } from '@/services/GameProgression';
import {
  browserStorage,
  createDefaultData,
  loadAppData,
  saveAppData,
  type StorageLike,
} from '@/services/storage';

interface AppDataContextValue {
  data: AppData;
  storageAvailable: boolean;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updatePlanner: (patch: Partial<PlannerPreferences>) => void;
  completeWorkoutSession: (record: WorkoutRecord) => SessionCompletion;
  resetProgress: () => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({
  children,
  storageOverride,
}: {
  children: ReactNode;
  storageOverride?: StorageLike | null;
}) {
  const [data, setData] = useState<AppData>(() => createDefaultData());
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const storageRef = useRef<StorageLike | null>(null);

  useEffect(() => {
    const storage = storageOverride !== undefined ? storageOverride : browserStorage();
    storageRef.current = storage;
    setStorageAvailable(!!storage);
    setData(loadAppData(storage));
    setHydrated(true);
  }, [storageOverride]);

  useEffect(() => {
    if (!hydrated) return;
    saveAppData(storageRef.current, data);
  }, [data, hydrated]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }, []);

  const updatePlanner = useCallback((patch: Partial<PlannerPreferences>) => {
    setData((current) => ({
      ...current,
      planner: { ...current.planner, ...patch },
    }));
  }, []);

  const completeWorkoutSession = useCallback(
    (record: WorkoutRecord): SessionCompletion => {
      const result = completeWorkout(data, record);
      setData(result.data);
      return result;
    },
    [data],
  );

  const resetProgress = useCallback(() => {
    const defaults = createDefaultData();
    setData((current) => ({
      ...defaults,
      settings: current.settings,
      planner: current.planner,
    }));
  }, []);

  const value = useMemo<AppDataContextValue>(
    () => ({
      data,
      storageAvailable,
      updateSettings,
      updatePlanner,
      completeWorkoutSession,
      resetProgress,
    }),
    [data, storageAvailable, updateSettings, updatePlanner, completeWorkoutSession, resetProgress],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside AppDataProvider');
  return context;
}
