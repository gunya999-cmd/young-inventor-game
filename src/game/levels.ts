import type { LevelDefinition } from './types';

export const TUTORIAL_LEVELS: LevelDefinition[] = [
  {
    id: 'home-01-bridge',
    chapter: 1,
    quest: 1,
    title: 'Разбуди Луми',
    objective: 'Соедини дорожку и доставь энергетический шар в порт.',
    teachingPoint: 'Наклонная плоскость и непрерывная траектория.',
    introLine: 'Луми: «Мне не хватает одной детали…»',
    availablePartIds: ['beam-medium-red'],
    placedParts: [
      { instanceId: 'ball', partId: 'energy-ball', x: 286, y: 250, rotationDeg: 0, fixed: true },
      { instanceId: 'left-rail', partId: 'beam-long-blue', x: 476, y: 326, rotationDeg: 12, fixed: true },
      { instanceId: 'right-rail', partId: 'beam-long-blue', x: 1104, y: 458, rotationDeg: 12, fixed: true },
      { instanceId: 'receiver', partId: 'energy-receiver', x: 1360, y: 523, rotationDeg: 0, fixed: true }
    ],
    snapTargets: [
      {
        id: 'bridge-gap',
        acceptsPartIds: ['beam-medium-red'],
        x: 790,
        y: 392,
        rotationDeg: 12,
        radius: 155,
        angleToleranceDeg: 12,
        positionTolerance: 46
      }
    ],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 8500,
    hint: 'Поставь красную балку между двумя светящимися соединителями.',
    successLine: 'Луми снова в сети!',
    failureHints: [
      'Проверь, нет ли разрыва между балками.',
      'Наклон красной балки должен продолжать синюю дорожку.',
      'Поставь балку чуть ближе к светящимся точкам.'
    ]
  },
  {
    id: 'home-02-two-bridges',
    chapter: 1,
    quest: 2,
    title: 'Длинный путь',
    objective: 'Построй дорожку из двух деталей.',
    teachingPoint: 'Планирование маршрута из нескольких элементов.',
    introLine: 'Луми: «Теперь путь длиннее. Давай соберём его вместе!»',
    availablePartIds: ['beam-short-red', 'beam-medium-red'],
    placedParts: [
      { instanceId: 'ball', partId: 'energy-ball', x: 250, y: 220, rotationDeg: 0, fixed: true },
      { instanceId: 'left-rail', partId: 'beam-long-blue', x: 430, y: 300, rotationDeg: 14, fixed: true },
      { instanceId: 'right-rail', partId: 'beam-long-blue', x: 1210, y: 500, rotationDeg: 14, fixed: true },
      { instanceId: 'receiver', partId: 'energy-receiver', x: 1450, y: 570, rotationDeg: 0, fixed: true }
    ],
    snapTargets: [
      { id: 'gap-a', acceptsPartIds: ['beam-medium-red'], x: 735, y: 375, rotationDeg: 14, radius: 165, angleToleranceDeg: 14, positionTolerance: 52 },
      { id: 'gap-b', acceptsPartIds: ['beam-short-red'], x: 970, y: 435, rotationDeg: 14, radius: 150, angleToleranceDeg: 14, positionTolerance: 50 }
    ],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 9500,
    hint: 'Сначала закрой большой разрыв средней балкой, затем маленький — короткой.',
    successLine: 'Маршрут готов!',
    failureHints: ['Проверь оба соединения.', 'Начни с детали, которая подходит по длине.', 'Сделай общий наклон плавным.']
  },
  {
    id: 'home-03-button',
    chapter: 1,
    quest: 3,
    title: 'Нажми и открой',
    objective: 'Направь шар на кнопку, чтобы открыть энергопорт.',
    teachingPoint: 'Причинно-следственная цепочка: движение → кнопка → механизм.',
    introLine: 'Луми: «Порт закрыт. Где-то должна быть кнопка!»',
    availablePartIds: ['beam-medium-red'],
    placedParts: [
      { instanceId: 'ball', partId: 'energy-ball', x: 270, y: 230, rotationDeg: 0, fixed: true },
      { instanceId: 'left-rail', partId: 'beam-long-blue', x: 470, y: 310, rotationDeg: 13, fixed: true },
      { instanceId: 'button', partId: 'button-red', x: 900, y: 505, rotationDeg: 0, fixed: true },
      { instanceId: 'right-rail', partId: 'beam-long-blue', x: 1170, y: 485, rotationDeg: -8, fixed: true },
      { instanceId: 'receiver', partId: 'energy-receiver', x: 1430, y: 445, rotationDeg: 0, fixed: true }
    ],
    snapTargets: [
      { id: 'button-ramp', acceptsPartIds: ['beam-medium-red'], x: 760, y: 405, rotationDeg: 18, radius: 170, angleToleranceDeg: 16, positionTolerance: 58 }
    ],
    goal: { type: 'button-then-sensor', bodyInstanceId: 'ball', buttonInstanceId: 'button', sensorInstanceId: 'receiver' },
    simulationTimeoutMs: 10000,
    hint: 'Балка должна сначала привести шар к кнопке, а затем на правую дорожку.',
    successLine: 'Кнопка сработала — порт открыт!',
    failureHints: ['Шар должен коснуться кнопки.', 'Попробуй сделать спуск к кнопке немного круче.', 'После кнопки шару нужен путь вправо.']
  },
  {
    id: 'home-04-spring',
    chapter: 1,
    quest: 4,
    title: 'Прыжок энергии',
    objective: 'Используй пружину, чтобы перебросить шар через препятствие.',
    teachingPoint: 'Преобразование энергии и направление импульса.',
    introLine: 'Луми: «Дорожка закончилась. Может быть, шар умеет прыгать?»',
    availablePartIds: ['spring-yellow', 'beam-short-red'],
    placedParts: [
      { instanceId: 'ball', partId: 'energy-ball', x: 290, y: 230, rotationDeg: 0, fixed: true },
      { instanceId: 'left-rail', partId: 'beam-long-blue', x: 500, y: 330, rotationDeg: 14, fixed: true },
      { instanceId: 'right-rail', partId: 'beam-long-blue', x: 1150, y: 455, rotationDeg: 7, fixed: true },
      { instanceId: 'receiver', partId: 'energy-receiver', x: 1410, y: 500, rotationDeg: 0, fixed: true }
    ],
    snapTargets: [
      { id: 'spring-seat', acceptsPartIds: ['spring-yellow'], x: 790, y: 485, rotationDeg: 0, radius: 150, angleToleranceDeg: 20, positionTolerance: 56 },
      { id: 'landing-ramp', acceptsPartIds: ['beam-short-red'], x: 950, y: 405, rotationDeg: 8, radius: 150, angleToleranceDeg: 18, positionTolerance: 52 }
    ],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 10500,
    hint: 'Поставь пружину под траекторией шара, а короткую балку — в месте приземления.',
    successLine: 'Отличный прыжок!',
    failureHints: ['Пружина должна находиться прямо под шаром.', 'Подвинь площадку приземления ближе.', 'Проверь угол короткой балки.']
  },
  {
    id: 'home-05-free-build',
    chapter: 1,
    quest: 5,
    title: 'Твоё решение',
    objective: 'Доставь шар в порт любым способом.',
    teachingPoint: 'Свободный эксперимент и сравнение решений.',
    introLine: 'Луми: «Теперь придумай собственную машину!»',
    availablePartIds: ['beam-short-red', 'beam-medium-red', 'spring-yellow'],
    placedParts: [
      { instanceId: 'ball', partId: 'energy-ball', x: 260, y: 210, rotationDeg: 0, fixed: true },
      { instanceId: 'left-rail', partId: 'beam-long-blue', x: 445, y: 300, rotationDeg: 16, fixed: true },
      { instanceId: 'receiver', partId: 'energy-receiver', x: 1390, y: 520, rotationDeg: 0, fixed: true }
    ],
    snapTargets: [],
    goal: { type: 'body-enters-sensor', bodyInstanceId: 'ball', sensorInstanceId: 'receiver', holdMs: 120 },
    simulationTimeoutMs: 12000,
    hint: 'Можно построить плавную дорожку или использовать пружину.',
    successLine: 'Это уже настоящая машина!',
    failureHints: ['Проследи весь путь шара от старта до порта.', 'Сделай места соединений более плавными.', 'Попробуй другой порядок деталей.']
  }
];

export const getTutorialLevel = (quest: number): LevelDefinition => {
  const level = TUTORIAL_LEVELS.find((item) => item.quest === quest);
  if (!level) throw new Error(`Tutorial quest ${quest} not found`);
  return level;
};
