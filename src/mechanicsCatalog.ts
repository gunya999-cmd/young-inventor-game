export type MechanicPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type LayerPolicy = 'same-layer' | 'layer-bridge' | 'all-layers';
export type MechanicCategory =
  | 'body'
  | 'surface'
  | 'machine'
  | 'transmission'
  | 'trigger'
  | 'energy'
  | 'environment'
  | 'agent'
  | 'goal';

export type MechanicSignal =
  | 'gravity'
  | 'contact'
  | 'force'
  | 'impulse'
  | 'pressure'
  | 'linear_velocity'
  | 'angular_velocity'
  | 'torque'
  | 'rope_tension'
  | 'belt_rotation'
  | 'shaft_rotation'
  | 'gear_mesh'
  | 'airflow'
  | 'light_flux'
  | 'focused_light'
  | 'heat'
  | 'electrical_power'
  | 'electrical_load'
  | 'switch_state'
  | 'sensor_contact'
  | 'latch'
  | 'timer'
  | 'count'
  | 'motion'
  | 'level_progress';

export type ConnectionKind =
  | 'none'
  | 'rope-anchor'
  | 'rope-route'
  | 'belt-shaft'
  | 'gear-mesh'
  | 'electrical'
  | 'rigid-pin'
  | 'layer-port';

export type MechanicDefinition = {
  id: string;
  label: string;
  category: MechanicCategory;
  priority: MechanicPriority;
  inputs: readonly MechanicSignal[];
  outputs: readonly MechanicSignal[];
  connections: readonly ConnectionKind[];
  layerPolicy: LayerPolicy;
  physicsSummary: string;
  states: readonly string[];
};

export const MECHANICS_CATALOG: readonly MechanicDefinition[] = [
  {
    id: 'mass-heavy', label: 'Heavy rolling mass', category: 'body', priority: 'P0',
    inputs: ['gravity', 'contact'], outputs: ['impulse', 'linear_velocity'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'High-density rigid body with friction and finite restitution.', states: ['resting', 'moving'],
  },
  {
    id: 'mass-light', label: 'Light ball', category: 'body', priority: 'P0',
    inputs: ['gravity', 'contact', 'airflow'], outputs: ['impulse', 'linear_velocity'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Low-density rigid body responsive to contact and airflow.', states: ['resting', 'moving'],
  },
  {
    id: 'mass-bouncy', label: 'Elastic ball', category: 'body', priority: 'P1',
    inputs: ['gravity', 'contact'], outputs: ['impulse', 'linear_velocity'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Rigid body with high restitution and spin.', states: ['resting', 'moving'],
  },
  {
    id: 'ramp', label: 'Inclined guide', category: 'surface', priority: 'P0',
    inputs: ['contact'], outputs: ['linear_velocity'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Static collision surface with friction; redirects gravity-driven motion.', states: ['idle'],
  },
  {
    id: 'lever', label: 'Pivoting lever', category: 'machine', priority: 'P0',
    inputs: ['contact', 'force', 'rope_tension'], outputs: ['angular_velocity', 'impulse', 'torque'], connections: ['rope-anchor', 'rigid-pin'],
    layerPolicy: 'same-layer', physicsSummary: 'Dynamic beam on a revolute joint with finite inertia and angular limits.', states: ['balanced', 'moving', 'limited'],
  },
  {
    id: 'spring-launcher', label: 'Spring-loaded pusher', category: 'machine', priority: 'P1',
    inputs: ['contact', 'latch'], outputs: ['impulse'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Hooke spring plus damping and physical latch/release.', states: ['latched', 'released', 'settling'],
  },
  {
    id: 'trampoline', label: 'Elastic surface', category: 'surface', priority: 'P1',
    inputs: ['contact', 'impulse'], outputs: ['impulse'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Compliant surface that returns energy through spring/damping response.', states: ['idle', 'compressed', 'rebounding'],
  },
  {
    id: 'bellows', label: 'Bellows airflow source', category: 'environment', priority: 'P1',
    inputs: ['force', 'contact'], outputs: ['airflow'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Mechanical stroke produces a directional bounded airflow field.', states: ['open', 'compressing', 'recovering'],
  },
  {
    id: 'wind-rotor', label: 'Wind rotor', category: 'energy', priority: 'P1',
    inputs: ['airflow'], outputs: ['shaft_rotation', 'angular_velocity'], connections: ['belt-shaft'],
    layerPolicy: 'same-layer', physicsSummary: 'Airflow creates finite torque on an inertial rotor.', states: ['idle', 'spinning'],
  },
  {
    id: 'rope', label: 'Rope', category: 'transmission', priority: 'P0',
    inputs: ['force', 'rope_tension'], outputs: ['rope_tension', 'force'], connections: ['rope-anchor', 'rope-route', 'layer-port'],
    layerPolicy: 'layer-bridge', physicsSummary: 'Finite-length flexible tension-only connection that can become slack.', states: ['slack', 'tensioned', 'cut'],
  },
  {
    id: 'anchor', label: 'Fixed rope anchor', category: 'transmission', priority: 'P0',
    inputs: ['rope_tension'], outputs: ['force'], connections: ['rope-anchor'],
    layerPolicy: 'same-layer', physicsSummary: 'Static reaction point for rope tension.', states: ['fixed'],
  },
  {
    id: 'pulley', label: 'Pulley', category: 'transmission', priority: 'P0',
    inputs: ['rope_tension'], outputs: ['rope_tension', 'angular_velocity'], connections: ['rope-route', 'rigid-pin'],
    layerPolicy: 'same-layer', physicsSummary: 'Routes rope while retaining sheave inertia and tension continuity.', states: ['idle', 'rotating'],
  },
  {
    id: 'belt', label: 'Drive belt', category: 'transmission', priority: 'P0',
    inputs: ['shaft_rotation'], outputs: ['belt_rotation', 'torque'], connections: ['belt-shaft', 'layer-port'],
    layerPolicy: 'layer-bridge', physicsSummary: 'Finite traction/slip transfers torque between compatible shafts.', states: ['slack', 'driving', 'slipping'],
  },
  {
    id: 'gear', label: 'Meshing gear', category: 'transmission', priority: 'P0',
    inputs: ['gear_mesh', 'shaft_rotation'], outputs: ['shaft_rotation', 'torque'], connections: ['gear-mesh', 'rigid-pin'],
    layerPolicy: 'same-layer', physicsSummary: 'Pitch-radius ratio transfers angular motion and finite torque.', states: ['idle', 'meshed', 'rotating'],
  },
  {
    id: 'conveyor', label: 'Conveyor', category: 'machine', priority: 'P0',
    inputs: ['belt_rotation', 'shaft_rotation'], outputs: ['linear_velocity', 'motion'], connections: ['belt-shaft'],
    layerPolicy: 'same-layer', physicsSummary: 'Moving surface transports rigid bodies through frictional contact.', states: ['stopped', 'moving'],
  },
  {
    id: 'cutter', label: 'Mechanical cutter', category: 'machine', priority: 'P1',
    inputs: ['contact', 'force'], outputs: ['sensor_contact'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Jointed blades close physically and sever intersecting cuttable connections.', states: ['open', 'closing', 'closed'],
  },
  {
    id: 'toggle-switch', label: 'Toggle power switch', category: 'trigger', priority: 'P0',
    inputs: ['contact', 'force'], outputs: ['switch_state'], connections: ['electrical'],
    layerPolicy: 'same-layer', physicsSummary: 'Articulated bistable switch changed by physical contact.', states: ['off', 'on'],
  },
  {
    id: 'generator', label: 'Mechanical generator', category: 'energy', priority: 'P0',
    inputs: ['shaft_rotation', 'electrical_load'], outputs: ['electrical_power'], connections: ['belt-shaft', 'electrical'],
    layerPolicy: 'same-layer', physicsSummary: 'Rotational input generates power while electrical load opposes the rotor.', states: ['idle', 'generating', 'loaded'],
  },
  {
    id: 'light-generator', label: 'Photoelectric source', category: 'energy', priority: 'P1',
    inputs: ['light_flux', 'focused_light'], outputs: ['electrical_power'], connections: ['electrical'],
    layerPolicy: 'same-layer', physicsSummary: 'Power derives from received light intensity with distance, focus and occlusion.', states: ['dark', 'illuminated', 'powered'],
  },
  {
    id: 'motor', label: 'Electric motor', category: 'energy', priority: 'P0',
    inputs: ['electrical_power', 'torque'], outputs: ['shaft_rotation', 'angular_velocity'], connections: ['electrical', 'belt-shaft'],
    layerPolicy: 'same-layer', physicsSummary: 'Finite-torque motor accelerates an inertial rotor and reacts to load.', states: ['off', 'accelerating', 'running', 'stalled'],
  },
  {
    id: 'fan', label: 'Powered fan', category: 'environment', priority: 'P0',
    inputs: ['electrical_power'], outputs: ['airflow'], connections: ['electrical'],
    layerPolicy: 'same-layer', physicsSummary: 'Powered rotor emits directional airflow with finite range and falloff.', states: ['off', 'running'],
  },
  {
    id: 'candle', label: 'Candle', category: 'energy', priority: 'P1',
    inputs: ['heat', 'airflow', 'contact'], outputs: ['light_flux', 'heat'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Ignitable flame emits local light and heat; strong airflow can extinguish it.', states: ['unlit', 'lit', 'extinguished'],
  },
  {
    id: 'flashlight', label: 'Flashlight', category: 'energy', priority: 'P1',
    inputs: ['switch_state'], outputs: ['light_flux'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Self-contained battery light emits a directional beam gated by its physical switch.', states: ['off', 'on'],
  },
  {
    id: 'magnifier', label: 'Magnifying lens', category: 'environment', priority: 'P1',
    inputs: ['light_flux'], outputs: ['focused_light', 'heat'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Convex lens redirects incident light toward a focal region, increasing local irradiance and heat.', states: ['idle', 'illuminated', 'focused'],
  },
  {
    id: 'pressure-trigger', label: 'Pressure trigger', category: 'trigger', priority: 'P0',
    inputs: ['contact', 'pressure'], outputs: ['switch_state', 'sensor_contact'], connections: ['electrical'],
    layerPolicy: 'same-layer', physicsSummary: 'Spring-loaded travel activates after real contact force crosses threshold.', states: ['released', 'pressed'],
  },
  {
    id: 'falling-weight', label: 'Hanging weight', category: 'body', priority: 'P0',
    inputs: ['gravity', 'rope_tension'], outputs: ['force', 'impulse'], connections: ['rope-anchor'],
    layerPolicy: 'same-layer', physicsSummary: 'Dense rigid body stores gravitational potential energy and loads ropes.', states: ['held', 'falling', 'resting'],
  },
  {
    id: 'barrier', label: 'Construction barrier', category: 'surface', priority: 'P0',
    inputs: ['contact'], outputs: ['force'], connections: ['none'],
    layerPolicy: 'all-layers', physicsSummary: 'Static support/deflection geometry with authored friction.', states: ['fixed'],
  },
  {
    id: 'goal-receiver', label: 'Goal receiver', category: 'goal', priority: 'P0',
    inputs: ['sensor_contact', 'switch_state', 'electrical_power', 'motion'], outputs: ['level_progress'], connections: ['none'],
    layerPolicy: 'same-layer', physicsSummary: 'Deterministic sensor/sustained-state evaluator; never scripts motion.', states: ['inactive', 'satisfied'],
  },
] as const;

export const MECHANICS_BY_ID: ReadonlyMap<string, MechanicDefinition> = new Map(
  MECHANICS_CATALOG.map((mechanic) => [mechanic.id, mechanic])
);

export function mechanicsByPriority(priority: MechanicPriority): readonly MechanicDefinition[] {
  return MECHANICS_CATALOG.filter((mechanic) => mechanic.priority === priority);
}

export function requireMechanic(id: string): MechanicDefinition {
  const mechanic = MECHANICS_BY_ID.get(id);
  if (!mechanic) throw new Error(`Unknown mechanic contract: ${id}`);
  return mechanic;
}

export const STAGE_02_MECHANICS = [
  'mass-heavy',
  'ramp',
  'lever',
  'mass-light',
  'rope',
  'pulley',
  'falling-weight',
  'pressure-trigger',
  'goal-receiver',
] as const;
