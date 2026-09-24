/* Preserve all source PDF geometry; replace only the four editable text regions. */
(function () {
'use strict';
const DEFAULTS={
 title:'Optical Mark Sheet',school:'Temasek Junior College (Science Department)',showSchool:false,
 instructions:'Use only 2B pencil for all entries on this sheet.\n\nShade the bubble completely.\n\nRub out errors thoroughly\n\nDo not make any stray mark on this sheet',
 indexInstructions:'First 2 characters are your class. Next 2 characters are your class index number.\n\nExample:\n\nJC students: write and shade 0501 for CG05 & index number 01.\n\nIP students: write and shade 1A01 for IP1A & index number 01.'
};
const FIELDS={
 school:{label:'School heading',font:'bold',x:70,y:780.84,width:455.32,size:14.04,min:9,single:true},
 title:{label:'Sheet title',font:'regular',x:70,y:758.64,width:455.32,size:14.04,min:9,single:true},
 instructions:{label:'Shading instructions',font:'narrow',x:453.91,y:721.9,width:99.1,bottom:640,size:9,min:7},
 indexInstructions:{label:'Index number instructions',font:'narrow',x:43.44,y:601.3,width:100.1,bottom:487,size:9,min:7}
};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const template=window.OMS_TEMPLATE,original=decode(template.pdf);
const segments=template.segments.map(([field,data])=>({field,data:decode(data)}));
const fonts=Object.fromEntries(Object.entries(template.fonts).map(([name,data])=>[name,decode(data)]));
function wrapText(text,font,size,width){
 const lines=[];
 for(const paragraph of text.replace(/\r/g,'').split('\n')){
  if(!paragraph.trim()){lines.push('');continue;}
  let line='';
  for(const word of paragraph.trim().split(/\s+/)){
   if(font.widthOfTextAtSize(word,size)>width)throw new Error('A word is too long to fit. Add a space or shorten it.');
   const next=line?line+' '+word:word;
   if(font.widthOfTextAtSize(next,size)<=width)line=next;else{lines.push(line);line=word;}
  }
  lines.push(line);
 }
 return lines;
}
function fitText(text,font,field){
 const supported=new Set(font.getCharacterSet());
 for(const character of text){if(character!=='\n'&&character!=='\r'&&!supported.has(character.codePointAt(0)))throw new Error('This font does not support “'+character+'”. Please use another character.');}
 for(let size=field.size;size>=field.min-0.001;size=Math.max(field.min,size-.25)){
  let lines;
  try{lines=field.single?[text.replace(/[\r\n]+/g,' ')]:wrapText(text,font,size,field.width);}catch(error){if(size===field.min)throw error;continue;}
  let y=field.y;const positioned=[];
  for(const line of lines){if(line){positioned.push({text:line,y});y-=size*1.147;}else y-=size*.67;}
  const fitsWidth=lines.every(line=>font.widthOfTextAtSize(line,size)<=field.width);
  if(fitsWidth&&(field.single||!positioned.length||positioned.at(-1).y-size*.25>=field.bottom))return{size,lines:positioned};
  if(size===field.min)break;
 }
 throw new Error('Too much text for this area. Shorten it or remove blank lines.');
}
async function buildPDF(values){
 const changed=new Set(Object.keys(FIELDS).filter(key=>values[key]!==DEFAULTS[key]));
 if(values.showSchool!==DEFAULTS.showSchool)changed.add('school');
 if(!changed.size)return{bytes:original.slice(),notes:[]};
 const {PDFDocument,PDFName,rgb}=PDFLib;
 const doc=await PDFDocument.load(original.slice());doc.registerFontkit(fontkit);
 const page=doc.getPages()[0],parts=segments.filter(part=>!changed.has(part.field));
 const content=new Uint8Array(parts.reduce((sum,part)=>sum+part.data.length,0));let offset=0;
 for(const part of parts){content.set(part.data,offset);offset+=part.data.length;}
 page.node.set(PDFName.of('Contents'),doc.context.register(doc.context.flateStream(content)));
 const embedded={},notes=[],errors=[];
 for(const key of changed){
  const field=FIELDS[key],text=values[key];
  if(!text.trim()||(key==='school'&&!values.showSchool))continue;
  const font=embedded[field.font]||(embedded[field.font]=await doc.embedFont(fonts[field.font],{subset:true}));
  try{
   const layout=fitText(text,font,field);
   for(const line of layout.lines){const x=field.single?field.x+(field.width-font.widthOfTextAtSize(line.text,layout.size))/2:field.x;page.drawText(line.text,{x,y:line.y,font,size:layout.size,color:rgb(0,0,0)});}
   if(layout.size<field.size)notes.push(field.label+': '+layout.size.toFixed(2)+' pt to fit.');
  }catch(error){errors.push(field.label+': '+error.message);}
 }
 if(errors.length){const error=new Error(errors.join('\n'));error.fields=errors;throw error;}
 doc.setTitle(values.title||'Optical Mark Sheet');
 doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PDFLib.PrintScaling.None);
 return{bytes:await doc.save(),notes};
}
// Exposed for regression checks and integrations; no DOM dependency in the builder.
window.OMSTemplateEditor={buildPDF,DEFAULTS,FIELDS,fitText,wrapText};
if(window.OMS_EDITOR_TEST)return;
const ids=Object.keys(DEFAULTS),elements=Object.fromEntries(ids.map(id=>[id,document.getElementById(id)]));
const status=document.getElementById('status'),download=document.getElementById('download'),feedback=document.getElementById('fieldFeedback'),canvas=document.getElementById('preview');
const storageKey='oms.templateEditor.v1';let revision=0,timer,latest=null,renderTask=null,pdfDocument=null,storageAvailable=true;
const workerURL=URL.createObjectURL(new Blob([decode(template.worker)],{type:'text/javascript'}));pdfjsLib.GlobalWorkerOptions.workerSrc=workerURL;
function readForm(){return Object.fromEntries(ids.map(id=>[id,id==='showSchool'?elements[id].checked:elements[id].value]));}
function setForm(values){for(const id of ids){if(id==='showSchool')elements[id].checked=Boolean(values[id]);else elements[id].value=values[id];}}
function save(values){try{localStorage.setItem(storageKey,JSON.stringify(values));}catch{storageAvailable=false;}}
async function refresh(myRevision){
 const values=readForm();
 try{
  const result=await buildPDF(values);if(myRevision!==revision)return;
  if(renderTask){renderTask.cancel();renderTask=null;}
  if(pdfDocument){await pdfDocument.destroy();pdfDocument=null;}
  const loaded=await pdfjsLib.getDocument({data:result.bytes.slice(),isEvalSupported:false}).promise;
  if(myRevision!==revision){await loaded.destroy();return;}
  pdfDocument=loaded;const page=await loaded.getPage(1);
  if(myRevision!==revision)return;
  const viewport=page.getViewport({scale:1.6}),staging=document.createElement('canvas');staging.width=Math.ceil(viewport.width);staging.height=Math.ceil(viewport.height);
  const task=page.render({canvasContext:staging.getContext('2d'),viewport});renderTask=task;await task.promise;
  if(myRevision!==revision)return;
  renderTask=null;canvas.width=staging.width;canvas.height=staging.height;canvas.getContext('2d').drawImage(staging,0,0);
  latest=result.bytes;download.disabled=false;feedback.replaceChildren();status.className='status';status.textContent=(storageAvailable?'Ready. Edits saved in this browser.':'Ready. Browser storage is unavailable; download to keep your sheet.')+(result.notes.length?' '+result.notes.join(' '):'');
  document.getElementById('previewNote').textContent='The preview shows the same PDF that will be downloaded.';
 }catch(error){
  if(myRevision!==revision)return;
  latest=null;download.disabled=true;status.className='status error';status.textContent=error.fields?'Please adjust the text to fit.':'Could not prepare the PDF: '+error.message;
  feedback.replaceChildren();for(const message of error.fields||[]){const li=document.createElement('li');li.textContent=message;feedback.appendChild(li);}
  document.getElementById('previewNote').textContent='Preview shows the last valid version. Fix the text above to update it.';
 }
}
function queueRefresh(){revision++;latest=null;download.disabled=true;if(renderTask)renderTask.cancel();clearTimeout(timer);save(readForm());status.className='status';status.textContent='Updating preview…';const current=revision;timer=setTimeout(()=>refresh(current),250);}
let initial={...DEFAULTS};try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&typeof saved==='object')for(const id of ids)if(typeof saved[id]===typeof DEFAULTS[id])initial[id]=saved[id];}catch{}
setForm(initial);for(const element of Object.values(elements))element.addEventListener('input',queueRefresh);
download.addEventListener('click',()=>{if(!latest)return;const url=URL.createObjectURL(new Blob([latest],{type:'application/pdf'})),link=document.createElement('a');link.href=url;link.download=(readForm().title.replace(/[^a-z0-9 _-]/gi,'').trim().slice(0,80)||'OMS template')+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);});
const resetDialog=document.getElementById('resetDialog');document.getElementById('reset').addEventListener('click',()=>resetDialog.showModal());resetDialog.addEventListener('close',()=>{if(resetDialog.returnValue==='restore'){setForm(DEFAULTS);queueRefresh();}});
refresh(revision);
})();
