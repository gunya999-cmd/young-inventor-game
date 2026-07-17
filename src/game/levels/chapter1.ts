import type { LevelDefinition } from '../types';

export const CHAPTER_ONE_LEVELS: LevelDefinition[] = [
  {
    id: 'c1-q1', chapter: 1, quest: 1, title: 'Замкни дорожку',
    objective: 'Поставь одну пластину между двумя дорожками.', teachingPoint: 'Перемещение детали',
    introLine: 'Луми: «Мне не хватает одной детали…»', availablePartIds: ['beam-medium'],
    placedParts: [
      { instanceId: 'ball', partId: 'ball', x: 286, y: 250, rotationDeg: 0, fixed: true },
      { instanceId: 'bridge', partId: 'beam-medium', x: 790, y: 688, rotationDeg: -6 }
    ],
    snapTargets: [{ id: 'gap', acceptsPartIds: ['beam-medium'], x: 790, y: 392, rotationDeg: 12, radius: 150, angleToleranceDeg: 12, positionTolerance: 50 }],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 8500, hint: 'Перетащи красную пластину в голубой разрыв.', successLine: 'Луми получает первый заряд!',
    failureHints: ['Пластина должна касаться обеих дорожек.', 'Попробуй совместить её с голубыми точками.']
  },
  {
    id: 'c1-q2', chapter: 1, quest: 2, title: 'Правильный угол',
    objective: 'Поверни пластину так, чтобы шар не сорвался.', teachingPoint: 'Вращение детали двумя пальцами',
    introLine: 'Луми: «Дорожка есть, но угол неправильный.»', availablePartIds: ['beam-medium'],
    placedParts: [
      { instanceId: 'ball', partId: 'ball', x: 286, y: 250, rotationDeg: 0, fixed: true },
      { instanceId: 'bridge', partId: 'beam-medium', x: 790, y: 392, rotationDeg: -18 }
    ],
    snapTargets: [{ id: 'gap', acceptsPartIds: ['beam-medium'], x: 790, y: 392, rotationDeg: 12, radius: 70, angleToleranceDeg: 8, positionTolerance: 35 }],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 8500, hint: 'Вращай деталь двумя пальцами или большой ручкой.', successLine: 'Отличный угол!',
    failureHints: ['Поверни правый край немного вниз.', 'Следи, чтобы переход между дорожками был плавным.']
  },
  {
    id: 'c1-q3', chapter: 1, quest: 3, title: 'Выбери длину',
    objective: 'Выбери пластину, которая полностью перекроет разрыв.', teachingPoint: 'Выбор подходящего компонента',
    introLine: 'Луми: «Не каждая деталь подходит к задаче.»', availablePartIds: ['beam-short', 'beam-medium', 'beam-long'],
    placedParts: [{ instanceId: 'ball', partId: 'ball', x: 286, y: 250, rotationDeg: 0, fixed: true }],
    snapTargets: [{ id: 'gap', acceptsPartIds: ['beam-medium'], x: 790, y: 392, rotationDeg: 12, radius: 150, angleToleranceDeg: 12, positionTolerance: 50 }],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 8500, hint: 'Короткая не достанет, длинная перекроет дорожки. Нужна средняя.', successLine: 'Ты выбрал подходящую деталь!',
    failureHints: ['Проверь, достаёт ли пластина до обеих дорожек.', 'Сравни длины деталей до запуска.']
  }
];

export function getLevel(levelId: string): LevelDefinition {
  return CHAPTER_ONE_LEVELS.find((level) => level.id === levelId) ?? CHAPTER_ONE_LEVELS[0];
}
