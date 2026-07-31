import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY, LEVEL_07, normalizeLevel, type LevelSpec } from './level';
import { PARTS, type MachineSnapshot, type PartKind } from './model';

interface MutableGameApp { snapshot:MachineSnapshot; mode:string; setStatus(message:string):void; }
const kinds=Object.keys(PARTS) as PartKind[];
const number=(root:HTMLElement,id:string)=>Number(root.querySelector<HTMLInputElement>(`#${id}`)?.value);
const text=(root:HTMLElement,id:string)=>root.querySelector<HTMLInputElement|HTMLTextAreaElement>(`#${id}`)?.value??'';

export function buildLevelFromEditor(root:HTMLElement,snapshot:MachineSnapshot):LevelSpec|null{
 let inventory:Record<PartKind,number>;let platforms:LevelSpec['platforms'];
 try{inventory=JSON.parse(text(root,'level-inventory'));platforms=JSON.parse(text(root,'level-platforms'));}catch{return null;}
 const candidate:LevelSpec={
  id:text(root,'level-id'),number:number(root,'level-number'),title:text(root,'level-title'),subtitle:text(root,'level-subtitle'),gravity:number(root,'level-gravity'),
  platforms,receiver:{x:number(root,'receiver-x'),y:number(root,'receiver-y'),innerWidth:number(root,'receiver-width'),innerHeight:number(root,'receiver-height'),wallThickness:number(root,'receiver-wall'),floorThickness:number(root,'receiver-floor')},
  initialParts:snapshot.parts.map(part=>({...part,locked:true})),initialSignals:(snapshot.signals??[]).map(link=>({...link})),inventory,maxRopes:number(root,'level-ropes'),maxHinges:number(root,'level-hinges'),targetPartId:text(root,'level-target')
 };
 return normalizeLevel(candidate);
}

export function installLevelEditor(appInstance:unknown):void{
 const app=appInstance as MutableGameApp;
 const host=document.querySelector<HTMLElement>('.workspace')??document.body;
 if(document.querySelector('#level-editor-open'))return;
 const open=document.createElement('button');open.id='level-editor-open';open.className='tool-button';open.textContent='🧰 Редактор уровня';host.prepend(open);
 const overlay=document.createElement('div');overlay.id='level-editor-overlay';overlay.hidden=true;
 overlay.innerHTML=`<section id="level-editor-panel"><header><div><strong>Редактор уровня</strong><small>Стартовые объекты берутся с текущего поля</small></div><button id="level-close">×</button></header>
 <div class="level-grid">
  <label>ID<input id="level-id"></label><label>Номер<input id="level-number" type="number" min="1"></label>
  <label class="wide">Название<input id="level-title"></label><label class="wide">Задание<textarea id="level-subtitle"></textarea></label>
  <label>Гравитация<input id="level-gravity" type="number" step=".1"></label><label>Целевой объект<select id="level-target"></select></label>
  <label>Верёвки<input id="level-ropes" type="number" min="0" max="20"></label><label>Оси<input id="level-hinges" type="number" min="0" max="20"></label>
  <label>X приёмника<input id="receiver-x" type="number"></label><label>Y приёмника<input id="receiver-y" type="number"></label>
  <label>Ширина цели<input id="receiver-width" type="number"></label><label>Высота цели<input id="receiver-height" type="number"></label>
  <label>Толщина стен<input id="receiver-wall" type="number"></label><label>Толщина дна<input id="receiver-floor" type="number"></label>
  <label class="wide">Платформы JSON<textarea id="level-platforms" rows="6"></textarea></label>
  <label class="wide">Инвентарь JSON<textarea id="level-inventory" rows="6"></textarea></label>
 </div><footer><input id="level-import" type="file" accept="application/json" hidden><button id="level-import-button">Импорт</button><button id="level-export">Экспорт JSON</button><button id="level-reset">Вернуть штатный</button><button id="level-apply" class="primary">Сохранить и открыть</button></footer><p id="level-error"></p></section>`;
 document.body.appendChild(overlay);
 const style=document.createElement('style');style.textContent=`#level-editor-open{margin:8px 12px}#level-editor-overlay{position:fixed;inset:0;z-index:10000;background:rgba(4,10,14,.78);display:grid;place-items:center;padding:20px}#level-editor-overlay[hidden]{display:none}#level-editor-panel{width:min(860px,96vw);max-height:92vh;overflow:auto;background:#13232d;color:#eaf8ff;border:1px solid #456979;border-radius:16px;padding:18px;box-shadow:0 25px 70px #000}#level-editor-panel header,#level-editor-panel footer{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}#level-editor-panel header small{display:block;opacity:.65}.level-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.level-grid label{display:grid;gap:5px;font-size:12px}.level-grid .wide{grid-column:1/-1}#level-editor-panel input,#level-editor-panel textarea,#level-editor-panel select{box-sizing:border-box;width:100%;background:#0b1820;color:#fff;border:1px solid #385866;border-radius:8px;padding:9px}#level-editor-panel button{padding:9px 13px;border-radius:8px;border:1px solid #4b7181;background:#203b48;color:#fff}#level-editor-panel .primary{background:#167d9c}#level-error{color:#ffad8f;min-height:1em}`;document.head.appendChild(style);
 const fill=(level:LevelSpec)=>{for(const [id,value] of Object.entries({'level-id':level.id,'level-number':level.number,'level-title':level.title,'level-subtitle':level.subtitle,'level-gravity':level.gravity,'level-ropes':level.maxRopes,'level-hinges':level.maxHinges,'receiver-x':level.receiver.x,'receiver-y':level.receiver.y,'receiver-width':level.receiver.innerWidth,'receiver-height':level.receiver.innerHeight,'receiver-wall':level.receiver.wallThickness,'receiver-floor':level.receiver.floorThickness})) {const el=overlay.querySelector<HTMLInputElement|HTMLTextAreaElement>(`#${id}`);if(el)el.value=String(value);} overlay.querySelector<HTMLTextAreaElement>('#level-platforms')!.value=JSON.stringify(level.platforms,null,2);overlay.querySelector<HTMLTextAreaElement>('#level-inventory')!.value=JSON.stringify(level.inventory,null,2);const select=overlay.querySelector<HTMLSelectElement>('#level-target')!;select.innerHTML=app.snapshot.parts.map(p=>`<option value="${p.id}">${PARTS[p.kind].label} — ${p.id}</option>`).join('');select.value=level.targetPartId??app.snapshot.parts[0]?.id??'';};
 open.onclick=()=>{if(app.mode!=='build'){app.setStatus('Останови симуляцию перед редактированием уровня.');return;}fill(ACTIVE_LEVEL);overlay.hidden=false;};overlay.querySelector<HTMLButtonElement>('#level-close')!.onclick=()=>overlay.hidden=true;
 overlay.querySelector<HTMLButtonElement>('#level-apply')!.onclick=()=>{const level=buildLevelFromEditor(overlay,app.snapshot);if(!level){overlay.querySelector('#level-error')!.textContent='Проверь JSON, координаты и обязательные поля.';return;}localStorage.setItem(CUSTOM_LEVEL_STORAGE_KEY,JSON.stringify(level));location.reload();};
 overlay.querySelector<HTMLButtonElement>('#level-reset')!.onclick=()=>{localStorage.removeItem(CUSTOM_LEVEL_STORAGE_KEY);location.reload();};
 overlay.querySelector<HTMLButtonElement>('#level-export')!.onclick=()=>{const level=buildLevelFromEditor(overlay,app.snapshot);if(!level)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(level,null,2)],{type:'application/json'}));a.download=`${level.id}.json`;a.click();URL.revokeObjectURL(a.href);};
 const file=overlay.querySelector<HTMLInputElement>('#level-import')!;overlay.querySelector<HTMLButtonElement>('#level-import-button')!.onclick=()=>file.click();file.onchange=async()=>{const selected=file.files?.[0];if(!selected)return;try{const level=normalizeLevel(JSON.parse(await selected.text()));if(!level)throw new Error();fill(level);overlay.querySelector('#level-error')!.textContent='Файл загружен. Нажми «Сохранить и открыть».';}catch{overlay.querySelector('#level-error')!.textContent='Некорректный файл уровня.';}};
 void kinds;void LEVEL_07;
}
