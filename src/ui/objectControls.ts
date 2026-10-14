import { createBasicShape, defaultShapeSpec, maxCreativeObjects, shapeKinds, type BasicShape, type ShapeSpec, type ShapeKind } from '../geometry/basicShapes';
import { planes } from '../math/rotation4d';
import type { Vec4 } from '../math/vec4';

export interface CreativeObject { id: number; shape: BasicShape; visible: boolean }
export function createObjectControls(root: HTMLElement, onChange: (objects: readonly CreativeObject[])=>void) {
  const objects: CreativeObject[]=[];
  let serial=0, selected=0;
  const field=(name:string,label=name,value=0)=>`<label>${label}<input type="number" step="0.1" name="${name}" value="${value}"></label>`;
  root.innerHTML=`<h2>4D objects</h2><p>Static world geometry; shown in 4D mode. Cube: embedded 3D cube (wireframe, no 4D cells); Hypersphere: S³ surface samples. Curved shapes use wire/point samples, not solid occlusion.</p>
    <label>Object<select name="object"><option value="0">New object</option></select></label>
    <label>Shape<select name="kind">${shapeKinds.map(k=>`<option>${k}</option>`).join('')}</select></label>
    <fieldset><legend>World position</legend>${['x','y','z','w'].map((a,i)=>field(a,a,[0,.4,0,1][i])).join('')}</fieldset>
    <fieldset data-line><legend>Line local endpoint (relative to start)</legend>${['x','y','z','w'].map((a,i)=>field(`end-${a}`,a,[1,0,0,1][i])).join('')}</fieldset>
    ${field('radius','Radius / Cube half-size',.7)}${field('length','Spherinder w length',1.4)}
    <fieldset><legend>Object rotation (degree)</legend>${planes.map(p=>field(p)).join('')}</fieldset>
    <label>Show object<input type="checkbox" name="visible" checked></label>
    <button type="button" data-add>Add object</button><button type="button" data-remove disabled>Remove selected</button>
    <p role="status" data-error></p><p>Up to ${maxCreativeObjects} objects; fixed curved sample counts.</p>`;
  const select=root.querySelector<HTMLSelectElement>('[name=object]')!;
  const error=root.querySelector<HTMLElement>('[data-error]')!;
  const input=(name:string)=>root.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const kind=()=>root.querySelector<HTMLSelectElement>('[name=kind]')!.value as ShapeKind;
  const syncFields=()=> {
    const k=kind();
    root.querySelectorAll<HTMLInputElement>('[data-line] input').forEach(i=>i.disabled=k!=='Line Segment');
    input('radius').disabled=['Point','Line Segment'].includes(k);
    input('length').disabled=k!=='Spherinder';
    root.querySelector<HTMLButtonElement>('[data-remove]')!.disabled=!selected;
  };
  const read=(): ShapeSpec=> ({kind:kind(), position:['x','y','z','w'].map(a=>input(a).valueAsNumber) as unknown as Vec4,
    end:['x','y','z','w'].map(a=>input(`end-${a}`).valueAsNumber) as unknown as Vec4,
    radius:input('radius').valueAsNumber,length:input('length').valueAsNumber,
    angles:Object.fromEntries(planes.map(p=>[p,input(p).valueAsNumber*Math.PI/180])) as ShapeSpec['angles']});
  const load=(spec:ShapeSpec,visible=true)=> {
    root.querySelector<HTMLSelectElement>('[name=kind]')!.value=spec.kind;
    ['x','y','z','w'].forEach((a,i)=> {input(a).value=String(spec.position[i]);input(`end-${a}`).value=String(spec.end[i]);});
    input('radius').value=String(spec.radius);input('length').value=String(spec.length);
    planes.forEach(p=>input(p).value=String(spec.angles[p]*180/Math.PI));
    input('visible').checked=visible; syncFields();
  };
  const list=()=> {
    select.replaceChildren(new Option('New object','0'),...objects.map(o=>new Option(`${o.id}: ${o.shape.spec.kind}`,String(o.id))));
    select.value=String(selected); syncFields();
  };
  const edit=(event:Event)=> {
    if(event.target===select) {
      selected=Number(select.value);const object=objects.find(o=>o.id===selected);
      load(object?.shape.spec??defaultShapeSpec('Point'),object?.visible); error.textContent='';return;
    }
    syncFields();
    try {
      const shape=createBasicShape(read());const object=objects.find(o=>o.id===selected);
      if(object) {object.shape=shape;object.visible=input('visible').checked;list();onChange(objects);}
      error.textContent='';
    } catch(e) {error.textContent=String(e instanceof Error?e.message:e);}
  };
  const click=(event:Event)=> {
    const target=(event.target as HTMLElement).closest('button');
    if(target?.hasAttribute('data-add')) try {
      if(objects.length>=maxCreativeObjects) throw new RangeError('Object limit reached');
      objects.push({id:++serial,shape:createBasicShape(read()),visible:input('visible').checked});selected=serial;
      list();error.textContent='';onChange(objects);
    } catch(e) {error.textContent=String(e instanceof Error?e.message:e);}
    if(target?.hasAttribute('data-remove') && selected) {
      const i=objects.findIndex(o=>o.id===selected);if(i>=0) objects.splice(i,1);
      selected=0;list();onChange(objects);
    }
  };
  root.addEventListener('change',edit);root.addEventListener('click',click);syncFields();
  return {dispose(){root.removeEventListener('change',edit);root.removeEventListener('click',click);}};
}
