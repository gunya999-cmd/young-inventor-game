export interface SavedProgress {
  currentLevelId: string;
  completedLevelIds: string[];
  attempts: Record<string, number>;
}

const STORAGE_KEY = 'young-inventor-progress-v1';
const DEFAULT_PROGRESS: SavedProgress = {
  currentLevelId: 'c1-q1',
  completedLevelIds: [],
  attempts: {}
};

export function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    return {
      currentLevelId: parsed.currentLevelId ?? DEFAULT_PROGRESS.currentLevelId,
      completedLevelIds: Array.isArray(parsed.completedLevelIds) ? parsed.completedLevelIds : [],
      attempts: parsed.attempts ?? {}
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function saveProgress(progress: SavedProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function recordAttempt(progress: SavedProgress, levelId: string): SavedProgress {
  const next = {
    ...progress,
    attempts: { ...progress.attempts, [levelId]: (progress.attempts[levelId] ?? 0) + 1 }
  };
  saveProgress(next);
  return next;
}

export function completeLevel(progress: SavedProgress, levelId: string, nextLevelId?: string): SavedProgress {
  const completedLevelIds = progress.completedLevelIds.includes(levelId)
    ? progress.completedLevelIds
    : [...progress.completedLevelIds, levelId];
  const next = { ...progress, completedLevelIds, currentLevelId: nextLevelId ?? levelId };
  saveProgress(next);
  return next;
}
