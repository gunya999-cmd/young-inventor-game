import type { Body, Fixture } from 'planck';
import type { MachineSnapshot, PartState, SignalLink } from '../model';
import type { PhysicsBodyData } from './partFactory';

export class SignalRuntime {
  private readonly activeSources = new Set<string>();
  private readonly activeDevices = new Set<string>();
  private readonly releasedLatches = new Set<string>();
  constructor(private readonly snapshot:MachineSnapshot,private readonly bodies:Map<string,Body>){}

  handleContact(a:Fixture,b:Fixture):void{
    const dataA=a.getUserData() as PhysicsBodyData|undefined;
    const dataB=b.getUserData() as PhysicsBodyData|undefined;
    const sourceFixture=dataA?.kind==='button-sensor'||dataA?.kind==='switch-sensor'?a:dataB?.kind==='button-sensor'||dataB?.kind==='switch-sensor'?b:null;
    const other=sourceFixture===a?b:sourceFixture===b?a:null;
    if(!sourceFixture||!other||other.getBody().getType()!=='dynamic')return;
    const id=(sourceFixture.getUserData() as PhysicsBodyData|undefined)?.partId;
    if(id)this.activateSource(id);
  }

  isActive(partId:string):boolean{return this.activeSources.has(partId)||this.activeDevices.has(partId)||this.releasedLatches.has(partId);}
  hasIncomingSignal(partId:string):boolean{return(this.snapshot.signals??[]).some(link=>link.targetPartId===partId);}

  private activateSource(sourceId:string):void{
    if(this.activeSources.has(sourceId))return;
    this.activeSources.add(sourceId);
    for(const link of(this.snapshot.signals??[]) as SignalLink[]){
      if(link.sourcePartId!==sourceId)continue;
      const target=this.snapshot.parts.find((part:PartState)=>part.id===link.targetPartId);
      if(link.action==='release'&&target?.kind==='latch')this.releaseLatch(target.id);
      if(link.action==='activate'&&target)this.activeDevices.add(target.id);
    }
  }

  private releaseLatch(latchId:string):void{
    if(this.releasedLatches.has(latchId))return;
    const body=this.bodies.get(latchId);if(!body)return;
    for(let fixture=body.getFixtureList();fixture;fixture=fixture.getNext())fixture.setSensor(true);
    this.releasedLatches.add(latchId);
    for(const candidate of this.bodies.values())if(candidate.getType()==='dynamic')candidate.setAwake(true);
  }
}
