import { requireMechanic } from './mechanicsCatalog';

export const CAMPAIGN_STAGE_01_ID = 'campaign-stage-01';

export const CAMPAIGN_STAGE_01_MECHANICS = [
  'mass-heavy',
  'ramp',
  'lever',
  'barrier',
  'goal-receiver',
] as const;

export const CAMPAIGN_STAGE_01_DEFINITION = {
  id: CAMPAIGN_STAGE_01_ID,
  title: 'Первый маршрут',
  goal: 'Доставь стальной шар в зелёный приёмник.',
  editor: 'free-xy-275d-pointer-v1',
  physics: 'rapier3d-0.19.3-free-build-stage01-v1',
  inventory: { ramp: 2, lever: 1, platform: 1 },
  solutionPolicy: 'multiple-valid-solutions',
  mechanics: CAMPAIGN_STAGE_01_MECHANICS.map((id) => requireMechanic(id)),
} as const;
