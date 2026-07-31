import { describe, expect, test } from 'vitest';
import { PhysicsEngine } from './physics';
import type { MachineSnapshot } from './model';

const STEP=1/120;
function run(engine:PhysicsEngine,seconds:number){for(let i=0;i<Math.round(seconds/STEP);i+=1)engine.step(STEP);}

describe('powered devices',()=>{
 test('an unsignalled conveyor moves a dynamic load along its surface',()=>{
  const snapshot:MachineSnapshot={parts:[{id:'belt',kind:'conveyor',x:500,y:500,angle:0,fixed:true},{id:'load',kind:'weight',x:430,y:430,angle:0,fixed:false}],ropes:[],hinges:[],signals:[]};
  const engine=new PhysicsEngine(snapshot,{includeLevelGeometry:false});run(engine,2);
  expect(engine.partTransform('load')!.position.x).toBeGreaterThan(500);
 });
 test('a controlled fan stays off until its switch is pressed',()=>{
  const snapshot:MachineSnapshot={parts:[{id:'fan',kind:'pulley',x:300,y:400,angle:0,fixed:true},{id:'toggle',kind:'switch',x:180,y:500,angle:0,fixed:true},{id:'press',kind:'weight',x:180,y:420,angle:0,fixed:false},{id:'ball',kind:'ball',x:430,y:400,angle:0,fixed:false}],ropes:[],hinges:[],signals:[{id:'wire',sourcePartId:'toggle',targetPartId:'fan',action:'activate'}]};
  const engine=new PhysicsEngine(snapshot,{includeLevelGeometry:false});
  expect(engine.deviceActive('fan')).toBe(false);run(engine,2);expect(engine.deviceActive('toggle')).toBe(true);expect(engine.deviceActive('fan')).toBe(true);expect(engine.partTransform('ball')!.position.x).toBeGreaterThan(430);
 });
 test('a signalled conveyor remains idle before activation',()=>{
  const snapshot:MachineSnapshot={parts:[{id:'belt',kind:'conveyor',x:500,y:500,angle:0,fixed:true},{id:'toggle',kind:'switch',x:200,y:700,angle:0,fixed:true},{id:'load',kind:'weight',x:450,y:430,angle:0,fixed:false}],ropes:[],hinges:[],signals:[{id:'wire',sourcePartId:'toggle',targetPartId:'belt',action:'activate'}]};
  const engine=new PhysicsEngine(snapshot,{includeLevelGeometry:false});run(engine,.5);expect(engine.deviceActive('belt')).toBe(false);expect(engine.partTransform('load')!.position.x).toBeLessThan(480);
 });
});
