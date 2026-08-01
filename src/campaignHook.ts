import { ACTIVE_LEVEL } from './level';
import type { MachineSnapshot } from './model';

interface CampaignAppBridge {
  complete:()=>void;
  elapsed:number;
  runStartSnapshot:MachineSnapshot;
}

export function installCampaignCompletionHook(appInstance:unknown):void{
 const app=appInstance as CampaignAppBridge;
 const original=app.complete.bind(app);
 app.complete=()=>{
  const wasVisible=document.querySelector('#result-card')?.classList.contains('visible')??false;
  original();
  const isVisible=document.querySelector('#result-card')?.classList.contains('visible')??false;
  if(wasVisible||!isVisible)return;
  const usedParts=app.runStartSnapshot.parts.filter(part=>!part.locked).length;
  window.dispatchEvent(new CustomEvent('tim-level-complete',{detail:{elapsed:app.elapsed,usedParts,levelId:ACTIVE_LEVEL.id}}));
 };
}
