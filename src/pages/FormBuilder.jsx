/**
 * FormBuilder.jsx — condensed
 * Fixes: "Hide title" toggle logic, dead spToken state removed.
 * Dynamic matrix: SurveyJS widget in form, HTML table saved to SP _Response column.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import { LayeredLightPanelless } from "survey-core/themes";
import "survey-core/survey-core.min.css";
import { QUESTION_TYPES, TYPE_GROUPS, createQuestion, buildSurveyJson, validateFields, updateField, removeField, duplicateField, reorderFields, getSpColumnKind } from "../utils/FormBuilderEngine";
import { DynamicMatrixSchemaEditor, registerDynamicMatrix, registerQuestionData } from "../utils/DynamicMatrix";
import logo from "../assets/logo.png";

registerDynamicMatrix();

const C = {
  purple:"#5B21B6",purpleLight:"#7C3AED",purplePale:"#EDE9FE",purpleMid:"#DDD6FE",
  purpleDark:"#3B0764",white:"#FFFFFF",offWhite:"#F8F7FF",border:"#E5E3F0",
  textPrimary:"#1E1B4B",textSecond:"#6B7280",textMuted:"#9CA3AF",
  green:"#059669",greenPale:"#D1FAE5",red:"#DC2626",redPale:"#FEE2E2",
  amber:"#D97706",amberPale:"#FEF3C7",
  shadow:"0 1px 3px rgba(91,33,182,0.08),0 4px 16px rgba(91,33,182,0.06)",
  shadowMd:"0 4px 24px rgba(91,33,182,0.12)",
};

const G=`@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.fb-field-dragging{opacity:.4}
.fb-preview-wrap .sd-root-modern{background:transparent!important}
.fb-preview-wrap .sd-container-modern{max-width:100%!important}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-thumb{background:${C.purpleMid};border-radius:10px}`;

// ── Atoms ─────────────────────────────────────────────────────────────────────
const Pill = ({children,color=C.purple,bg=C.purplePale}) =>
  <span style={{fontSize:10,fontWeight:700,color,background:bg,borderRadius:20,padding:"2px 8px",letterSpacing:"0.04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{children}</span>;

function IconBtn({icon,title,onClick,danger,disabled}) {
  return <button title={title} onClick={onClick} disabled={disabled}
    style={{width:26,height:26,border:"none",borderRadius:6,background:"transparent",cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:danger?C.red:C.textMuted,opacity:disabled?0.4:1,transition:"background 0.1s"}}
    onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=danger?C.redPale:C.purplePale;}}
    onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>{icon}</button>;
}

function Toggle({checked,onChange,label}) {
  return <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",userSelect:"none"}}>
    <div onClick={()=>onChange(!checked)} style={{width:36,height:20,borderRadius:10,flexShrink:0,background:checked?C.purple:C.border,position:"relative",transition:"background 0.2s",cursor:"pointer"}}>
      <div style={{position:"absolute",top:3,left:checked?19:3,width:14,height:14,borderRadius:"50%",background:C.white,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/>
    </div>
    {label&&<span style={{fontSize:12,color:C.textSecond}}>{label}</span>}
  </label>;
}

function Input({value,onChange,placeholder,type="text",style:extra,...rest}) {
  const [f,setF]=useState(false);
  return <input type={type} value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    style={{width:"100%",height:34,border:`1px solid ${f?C.purple:C.border}`,borderRadius:7,padding:"0 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:C.textPrimary,background:C.white,outline:"none",boxShadow:f?`0 0 0 3px ${C.purplePale}`:"none",transition:"border-color 0.15s,box-shadow 0.15s",...extra}}
    {...rest}/>;
}

function Textarea({value,onChange,placeholder,rows=3}) {
  const [f,setF]=useState(false);
  return <textarea value={value??""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    style={{width:"100%",border:`1px solid ${f?C.purple:C.border}`,borderRadius:7,padding:"8px 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:C.textPrimary,background:C.white,outline:"none",resize:"vertical",boxShadow:f?`0 0 0 3px ${C.purplePale}`:"none",transition:"border-color 0.15s,box-shadow 0.15s"}}/>;
}

function Select({value,onChange,options}) {
  return <select value={value??""} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",height:34,border:`1px solid ${C.border}`,borderRadius:7,padding:"0 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:C.textPrimary,background:C.white,outline:"none",cursor:"pointer"}}>
    {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
  </select>;
}

const PropLabel = ({children}) =>
  <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:5}}>{children}</div>;

function PropRow({label,children,span}) {
  return <div style={{marginBottom:12,gridColumn:span?"1 / -1":undefined}}>
    <PropLabel>{label}</PropLabel>{children}
  </div>;
}

// ── Palette ───────────────────────────────────────────────────────────────────
function Palette({onAdd}) {
  const [search,setSearch]=useState("");
  const [activeGroup,setActiveGroup]=useState("All");
  const filtered=useMemo(()=>{
    let list=QUESTION_TYPES;
    if(activeGroup!=="All") list=list.filter(t=>t.group===activeGroup);
    if(search.trim()){const q=search.toLowerCase();list=list.filter(t=>t.label.toLowerCase().includes(q)||t.description.toLowerCase().includes(q));}
    return list;
  },[search,activeGroup]);
  const onDragStart=(e,td)=>{e.dataTransfer.setData("palette_type",JSON.stringify(td));e.dataTransfer.effectAllowed="copy";};
  return <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"12px 12px 8px"}}>
      <div style={{position:"relative"}}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <circle cx="5.5" cy="5.5" r="4" stroke={C.textMuted} strokeWidth="1.3"/>
          <path d="M9 9l2.5 2.5" stroke={C.textMuted} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search fields…"
          style={{width:"100%",height:30,border:`1px solid ${C.border}`,borderRadius:7,paddingLeft:28,paddingRight:10,fontSize:11,fontFamily:"'DM Sans',sans-serif",color:C.textPrimary,background:C.offWhite,outline:"none"}}/>
      </div>
    </div>
    <div style={{display:"flex",gap:4,padding:"0 12px 10px",flexWrap:"wrap"}}>
      {["All",...TYPE_GROUPS].map(g=><button key={g} onClick={()=>setActiveGroup(g)}
        style={{padding:"3px 9px",borderRadius:20,border:"none",fontSize:10,fontWeight:600,cursor:"pointer",background:activeGroup===g?C.purple:C.offWhite,color:activeGroup===g?C.white:C.textMuted,fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>{g}</button>)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"0 10px 12px",display:"flex",flexDirection:"column",gap:4}}>
      {filtered.map((td,i)=><div key={td.variantKey||td.type+i} draggable onDragStart={e=>onDragStart(e,td)} onClick={()=>onAdd(td)}
        style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:9,border:`1px solid ${C.border}`,background:C.white,cursor:"grab",userSelect:"none",transition:"all 0.13s",animation:`slideIn 0.15s ease ${i*0.02}s both`}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.purpleMid;e.currentTarget.style.background=C.purplePale;e.currentTarget.style.transform="translateX(2px)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background=C.white;e.currentTarget.style.transform="none";}}>
        <span style={{fontSize:16,flexShrink:0,width:24,textAlign:"center"}}>{td.icon}</span>
        <div style={{minWidth:0}}>
          <div style={{fontSize:12,fontWeight:600,color:C.textPrimary,marginBottom:1}}>{td.label}</div>
          <div style={{fontSize:10,color:C.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{td.description}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:"auto",flexShrink:0,opacity:0.4}}>
          <path d="M4 2h4M4 6h4M4 10h4M2 2v0M2 6v0M2 10v0" stroke={C.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </div>)}
      {!filtered.length&&<div style={{textAlign:"center",padding:"24px 0",color:C.textMuted,fontSize:12}}>No field types match</div>}
    </div>
    <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.textMuted,textAlign:"center"}}>Click or drag to add a field</div>
  </div>;
}

// ── Canvas ────────────────────────────────────────────────────────────────────
function FieldCard({field,index,selected,onSelect,onRemove,onDuplicate,onMoveUp,onMoveDown,isFirst,isLast,errors,onDragStart,onDragOver,onDrop,dragging}) {
  const err=errors.filter(e=>e.id===field._id);
  const td=QUESTION_TYPES.find(t=>t.type===field.type&&(t.defaultProps?.inputType===field.inputType||!t.defaultProps?.inputType||!field.inputType))||QUESTION_TYPES[0];
  const spCol=getSpColumnKind(field);
  const shortcuts = selected ? "Del to remove, Ctrl+D to duplicate" : "";
  return <div draggable onDragStart={e=>onDragStart(e,index)} onDragOver={e=>onDragOver(e,index)} onDrop={e=>onDrop(e,index)}
    className={dragging?"fb-field-dragging":""} onClick={()=>onSelect(field._id)}
    title={shortcuts}
    style={{background:selected?C.purplePale:C.white,border:`1.5px solid ${selected?C.purple:err.length?C.red:C.border}`,borderRadius:11,padding:"12px 14px",cursor:"pointer",userSelect:"none",transition:"all 0.14s",boxShadow:selected?C.shadowMd:C.shadow,marginBottom:6,animation:"fadeUp 0.18s ease"}}>
    <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
      <div style={{paddingTop:2,color:C.textMuted,cursor:"grab",flexShrink:0}}>
        <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
          {[3,8,13].flatMap(y=>[3,9].map(x=><circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="currentColor"/>))}
        </svg>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontSize:14}}>{td.icon}</span>
          <span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>{field.title||"(no label)"}</span>
          {field.isRequired&&<Pill color={C.red} bg={C.redPale}>Required</Pill>}
          {field.readOnly&&<Pill color={C.textMuted} bg={C.offWhite}>Read-only</Pill>}
          {field.startWithNewLine===false&&<Pill color={C.amber} bg={C.amberPale}>Inline</Pill>}
          {field.titleLocation==="hidden"&&<Pill color={C.textMuted} bg={C.offWhite}>Title hidden</Pill>}
          {field.visibleIf&&<Pill color={C.green} bg={C.greenPale}>Conditional</Pill>}
          {field.enableIf&&<Pill color={C.purpleLight} bg={C.purplePale}>Dyn.enable</Pill>}
          {spCol&&<Pill color={C.textSecond} bg={C.offWhite}>{spCol.label}</Pill>}
          {field.type==="dynamicmatrix"&&<Pill color={C.amber} bg={C.amberPale}>→ Rich Text</Pill>}
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>{field.name}</span>
          <span style={{fontSize:10,color:C.textMuted}}>· {td.label}</span>
          {field.defaultValue!==undefined&&<span style={{fontSize:10,color:C.green}}>· default: {String(field.defaultValue).slice(0,20)}</span>}
        </div>
        {err.map((e,i)=><div key={i} style={{marginTop:4,fontSize:10,color:C.red,display:"flex",alignItems:"center",gap:4}}><span>⚠</span>{e.msg}</div>)}
      </div>
      <div style={{display:"flex",gap:2,flexShrink:0}} onClick={e=>e.stopPropagation()}>
        <IconBtn icon="↑" title="Move up" onClick={()=>onMoveUp(index)} disabled={isFirst}/>
        <IconBtn icon="↓" title="Move down" onClick={()=>onMoveDown(index)} disabled={isLast}/>
        <IconBtn icon="⧉" title="Duplicate (Ctrl+D)" onClick={()=>onDuplicate(field._id)}/>
        <IconBtn icon="✕" title="Remove (Del)" onClick={()=>onRemove(field._id)} danger/>
      </div>
    </div>
  </div>;
}

function Canvas({fields,selectedId,onSelect,onRemove,onDuplicate,onReorder,onAddFromPalette,errors}) {
  const dragIndexRef=useRef(null);
  const [dragOverIndex,setDragOverIndex]=useState(null);
  const [draggingIndex,setDraggingIndex]=useState(null);
  const onDragStart=(e,i)=>{dragIndexRef.current=i;setDraggingIndex(i);e.dataTransfer.effectAllowed="move";};
  const onDragOver=(e,i)=>{e.preventDefault();setDragOverIndex(i);};
  const onDrop=(e,i)=>{
    e.preventDefault();setDragOverIndex(null);setDraggingIndex(null);
    const pd=e.dataTransfer.getData("palette_type");
    if(pd){try{onAddFromPalette(JSON.parse(pd),i);}catch{}dragIndexRef.current=null;return;}
    if(dragIndexRef.current!==null&&dragIndexRef.current!==i)onReorder(dragIndexRef.current,i);
    dragIndexRef.current=null;
  };
  const onDragEnd=()=>{setDraggingIndex(null);setDragOverIndex(null);dragIndexRef.current=null;};
  return <div onDragOver={e=>e.preventDefault()}
    onDrop={e=>{const pd=e.dataTransfer.getData("palette_type");if(pd&&!fields.length)try{onAddFromPalette(JSON.parse(pd),0);}catch{}}}
    onDragEnd={onDragEnd} style={{flex:1,overflowY:"auto",padding:"16px 14px"}}>
    {!fields.length
      ? <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",minHeight:300,color:C.textMuted,textAlign:"center",border:`2px dashed ${C.border}`,borderRadius:14,padding:32,background:C.offWhite}}>
          <div style={{fontSize:40,marginBottom:14}}>📋</div>
          <div style={{fontSize:14,fontWeight:600,color:C.textPrimary,marginBottom:6}}>Your form is empty</div>
          <div style={{fontSize:12,lineHeight:1.7}}>Click a field type in the left panel,<br/>or drag one here to get started.</div>
        </div>
      : fields.map((field,i)=><React.Fragment key={field._id}>
          {dragOverIndex===i&&draggingIndex!==i&&<div style={{height:3,background:C.purple,borderRadius:3,marginBottom:4,animation:"pulse 1s infinite"}}/>}
          <FieldCard field={field} index={i} selected={selectedId===field._id}
            onSelect={onSelect} onRemove={onRemove} onDuplicate={onDuplicate}
            onMoveUp={()=>onReorder(i,i-1)} onMoveDown={()=>onReorder(i,i+1)}
            isFirst={i===0} isLast={i===fields.length-1} errors={errors}
            onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} dragging={draggingIndex===i}/>
        </React.Fragment>)}
  </div>;
}

// ── Field editors ─────────────────────────────────────────────────────────────
function ChoicesEditor({choices,onChange}) {
  const items=(Array.isArray(choices)?choices:[]).map(c=>typeof c==="string"?{value:c,text:c}:c);
  const update=(i,k,v)=>{const n=items.map((it,idx)=>idx===i?{...it,[k]:v,...(k==="value"&&!it._textCustomised?{text:v}:{})}:it);onChange(n.map(x=>x.value===x.text?x.value:x));};
  const add=()=>{const n=[...items,{value:`option${items.length+1}`,text:`Option ${items.length+1}`}];onChange(n.map(x=>x.value===x.text?x.value:x));};
  return <div>
    <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
      {items.map((it,i)=><div key={i} style={{display:"flex",gap:5,alignItems:"center"}}>
        <Input value={it.value} onChange={v=>update(i,"value",v)} placeholder="value" style={{flex:1,fontSize:11}}/>
        <Input value={it.text} onChange={v=>update(i,"text",v)} placeholder="label" style={{flex:1,fontSize:11}}/>
        <IconBtn icon="✕" title="Remove" onClick={()=>onChange(items.filter((_,idx)=>idx!==i).map(x=>x.value===x.text?x.value:x))} danger/>
      </div>)}
    </div>
    <button onClick={add} style={{width:"100%",height:28,border:`1px dashed ${C.border}`,borderRadius:7,background:"none",color:C.purple,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>＋ Add option</button>
  </div>;
}

function MatrixEditor({field,onChange}) {
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
    {[["Columns",field.columns||[],"columns"],["Rows",field.rows||[],"rows"]].map(([lbl,items,key])=><div key={key}>
      <PropLabel>{lbl}</PropLabel>
      <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:6}}>
        {items.map((c,i)=><div key={i} style={{display:"flex",gap:4}}>
          <Input value={typeof c==="string"?c:c.value} onChange={v=>onChange({[key]:items.map((x,idx)=>idx===i?v:x)})} style={{fontSize:11}}/>
          <IconBtn icon="✕" onClick={()=>onChange({[key]:items.filter((_,idx)=>idx!==i)})} danger/>
        </div>)}
      </div>
      <button onClick={()=>onChange({[key]:[...items,`${lbl.slice(0,-1)} ${items.length+1}`]})}
        style={{fontSize:10,color:C.purple,background:"none",border:`1px dashed ${C.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"'DM Sans'"}}>+ {lbl.slice(0,-1)}</button>
    </div>)}
  </div>;
}

function MultipleTextEditor({field,onChange}) {
  const items=field.items||[];
  return <div>
    <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>
      {items.map((it,i)=><div key={i} style={{display:"flex",gap:5,alignItems:"center"}}>
        <Input value={it.name} onChange={v=>onChange({items:items.map((x,idx)=>idx===i?{...x,name:v}:x)})} placeholder="name" style={{flex:1,fontSize:11}}/>
        <Input value={it.title} onChange={v=>onChange({items:items.map((x,idx)=>idx===i?{...x,title:v}:x)})} placeholder="label" style={{flex:1,fontSize:11}}/>
        <IconBtn icon="✕" onClick={()=>onChange({items:items.filter((_,idx)=>idx!==i)})} danger/>
      </div>)}
    </div>
    <button onClick={()=>onChange({items:[...items,{name:`field${items.length+1}`,title:`Field ${items.length+1}`}]})}
      style={{width:"100%",height:28,border:`1px dashed ${C.border}`,borderRadius:7,background:"none",color:C.purple,fontSize:11,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>＋ Add sub-field</button>
  </div>;
}

function VisibilityEditor({field,allFields,onChange}) {
  const [mode,setMode]=useState(field.visibleIf?"condition":"always");
  const others=allFields.filter(f=>f._id!==field._id&&f.name);
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      {["always","condition"].map(m=><button key={m} onClick={()=>{setMode(m);if(m==="always")onChange({visibleIf:undefined});}}
        style={{padding:"4px 12px",borderRadius:20,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:mode===m?C.purple:C.offWhite,color:mode===m?C.white:C.textMuted,fontFamily:"'DM Sans',sans-serif"}}>
        {m==="always"?"Always visible":"Conditional"}</button>)}
    </div>
    {mode==="condition"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:11,color:C.textMuted}}>Show this field when:</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
        <Select value={field._visIfField||""} onChange={v=>onChange({_visIfField:v,visibleIf:v?`{${v}} ${field._visIfOp||"="} '${field._visIfVal||""}'`:undefined})}
          options={[{value:"",label:"Select field…"},...others.map(f=>({value:f.name,label:f.title||f.name}))]}/>
        <Select value={field._visIfOp||"="} onChange={v=>onChange({_visIfOp:v,visibleIf:field._visIfField?`{${field._visIfField}} ${v} '${field._visIfVal||""}'`:undefined})}
          options={[{value:"=",label:"equals"},{value:"!=",label:"not equals"},{value:"contains",label:"contains"},{value:"notempty",label:"is not empty"},{value:"empty",label:"is empty"}]}/>
        <Input value={field._visIfVal||""} onChange={v=>onChange({_visIfVal:v,visibleIf:field._visIfField?`{${field._visIfField}} ${field._visIfOp||"="} '${v}'`:undefined})} placeholder="value"/>
      </div>
      {field.visibleIf&&<code style={{fontSize:10,color:C.purple,background:C.purplePale,borderRadius:6,padding:"4px 8px",display:"block",wordBreak:"break-all"}}>{field.visibleIf}</code>}
      <div style={{fontSize:10,color:C.textMuted}}>Or type raw SurveyJS expression:</div>
      <Textarea value={field.visibleIf||""} onChange={v=>onChange({visibleIf:v||undefined})} placeholder="{fieldName} = 'value'" rows={2}/>
    </div>}
  </div>;
}

function EnableIfEditor({field,allFields,onChange}) {
  const [mode,setMode]=useState(field.enableIf?"condition":"always");
  const others=allFields.filter(f=>f._id!==field._id&&f.name);
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      {["always","condition"].map(m=><button key={m} onClick={()=>{setMode(m);if(m==="always")onChange({enableIf:undefined});}}
        style={{padding:"4px 12px",borderRadius:20,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",background:mode===m?C.green:C.offWhite,color:mode===m?C.white:C.textMuted,fontFamily:"'DM Sans',sans-serif"}}>
        {m==="always"?"Always enabled":"Conditional"}</button>)}
    </div>
    {mode==="condition"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:11,color:C.textMuted}}>Enable this field when:</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:6,alignItems:"center"}}>
        <Select value={field._enabIfField||""} onChange={v=>onChange({_enabIfField:v,enableIf:v?`{${v}} ${field._enabIfOp||"="} '${field._enabIfVal||""}'`:undefined})}
          options={[{value:"",label:"Select field…"},...others.map(f=>({value:f.name,label:f.title||f.name}))]}/>
        <Select value={field._enabIfOp||"="} onChange={v=>onChange({_enabIfOp:v,enableIf:field._enabIfField?`{${field._enabIfField}} ${v} '${field._enabIfVal||""}'`:undefined})}
          options={[{value:"=",label:"equals"},{value:"!=",label:"not equals"},{value:"contains",label:"contains"},{value:"notempty",label:"is not empty"},{value:"empty",label:"is empty"}]}/>
        <Input value={field._enabIfVal||""} onChange={v=>onChange({_enabIfVal:v,enableIf:field._enabIfField?`{${field._enabIfField}} ${field._enabIfOp||"="} '${v}'`:undefined})} placeholder="value"/>
      </div>
      {field.enableIf&&<code style={{fontSize:10,color:C.green,background:C.greenPale,borderRadius:6,padding:"4px 8px",display:"block",wordBreak:"break-all"}}>{field.enableIf}</code>}
      <div style={{fontSize:10,color:C.textMuted}}>Or type raw SurveyJS expression:</div>
      <Textarea value={field.enableIf||""} onChange={v=>onChange({enableIf:v||undefined})} placeholder="{fieldName} = 'value'" rows={2}/>
    </div>}
  </div>;
}

function ValidationEditor({field,onChange}) {
  const vs=field.validators||[];
  return <div>
    {vs.map((v,i)=><div key={i} style={{background:C.offWhite,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <Pill>{v.type}</Pill>
        <IconBtn icon="✕" onClick={()=>onChange({validators:vs.filter((_,idx)=>idx!==i)})} danger/>
      </div>
      <Input value={v.text||""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,text:val}:x)})} placeholder="Error message (optional)"/>
      {v.type==="regex"&&<div style={{marginTop:6}}><Input value={v.regex||""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,regex:val}:x)})} placeholder="RegEx pattern"/></div>}
      {v.type==="numeric"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
        <Input value={v.minValue??""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,minValue:val}:x)})} placeholder="Min" type="number"/>
        <Input value={v.maxValue??""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,maxValue:val}:x)})} placeholder="Max" type="number"/>
      </div>}
      {v.type==="text"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
        <Input value={v.minLength??""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,minLength:val}:x)})} placeholder="Min length" type="number"/>
        <Input value={v.maxLength??""} onChange={val=>onChange({validators:vs.map((x,idx)=>idx===i?{...x,maxLength:val}:x)})} placeholder="Max length" type="number"/>
      </div>}
    </div>)}
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {["email","numeric","text","regex","expression"].map(type=><button key={type}
        onClick={()=>onChange({validators:[...vs,{type}]})}
        style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`,background:"none",color:C.textSecond,fontSize:10,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>+ {type}</button>)}
    </div>
  </div>;
}

function SpChoicesConfig({field,onChange,token}) {
  const [lists,setLists]=useState([]);
  const [columns,setColumns]=useState([]);
  const [preview,setPreview]=useState([]);
  const [loadingLists,setLoadingLists]=useState(false);
  const [loadingCols,setLoadingCols]=useState(false);
  const [loadingPreview,setLoadingPreview]=useState(false);
  const SP=useMemo(()=>(process.env.REACT_APP_SP_SITE_URL||"").replace(/\/$/,""),[process.env.REACT_APP_SP_SITE_URL]);
  const src=field.spChoicesSource||{};
  useEffect(()=>{if(!token)return;setLoadingLists(true);fetch(`${SP}/_api/web/lists?$filter=Hidden eq false and BaseTemplate eq 100&$select=Title&$orderby=Title asc&$top=200`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>setLists(d.value||[])).catch(()=>setLists([])).finally(()=>setLoadingLists(false));},[token,SP]);
  useEffect(()=>{if(!token||!src.list){setColumns([]);return;}setLoadingCols(true);fetch(`${SP}/_api/web/lists/getbytitle('${encodeURIComponent(src.list)}')/fields?$filter=Hidden eq false and ReadOnlyField eq false and (TypeAsString eq 'Choice' or TypeAsString eq 'MultiChoice')&$select=Title,InternalName,TypeAsString,Choices&$orderby=Title asc&$top=200`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>setColumns((d.value||[]).filter(c=>!["Attachments","ContentType","Edit","DocIcon","LinkTitleNoMenu","LinkTitle","ItemChildCount","FolderChildCount"].includes(c.InternalName)))).catch(()=>setColumns([])).finally(()=>setLoadingCols(false));},[token,SP,src.list]);
  const loadPreview=()=>{if(!token||!src.list||!src.column)return;setLoadingPreview(true);fetch(`${SP}/_api/web/lists/getbytitle('${encodeURIComponent(src.list)}')/fields/getbytitle('${encodeURIComponent(src.column)}')`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json;odata=nometadata"}}).then(r=>r.json()).then(d=>{const field=d;if(field.Choices&&Array.isArray(field.Choices)){setPreview(field.Choices);onChange({...field,choices:field.Choices,spChoicesSource:{...src,choicesLoaded:true}});}else{setPreview([]);}}).catch(()=>setPreview([])).finally(()=>setLoadingPreview(false));};
  return <div style={{background:C.purplePale,border:`1px solid ${C.purpleMid}`,borderRadius:8,padding:"11px 12px",marginTop:8}}>
    <div style={{fontSize:10,fontWeight:700,color:C.purple,textTransform:"uppercase",letterSpacing:".05em",marginBottom:10}}>SharePoint Choices Source</div>
    <div style={{marginBottom:8}}>
      <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>List</div>
      <select value={src.list||""} onChange={e=>onChange({spChoicesSource:{...src,list:e.target.value,column:""}})}
        style={{width:"100%",height:32,border:`1px solid ${C.border}`,borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"'DM Sans'",background:C.white}}>
        <option value="">{loadingLists?"Loading…":"Select a list…"}</option>
        {lists.map(l=><option key={l.Title} value={l.Title}>{l.Title}</option>)}
      </select>
    </div>
    {src.list&&<div style={{marginBottom:8}}>
      <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>Column (value)</div>
      <select value={src.column||""} onChange={e=>onChange({spChoicesSource:{...src,column:e.target.value}})}
        style={{width:"100%",height:32,border:`1px solid ${C.border}`,borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"'DM Sans'",background:C.white}}>
        <option value="">{loadingCols?"Loading…":"Select a column…"}</option>
        {columns.map(c=><option key={c.InternalName} value={c.InternalName}>{c.Title} ({c.TypeAsString})</option>)}
      </select>
    </div>}
    {src.list&&src.column&&<>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>Label column (optional)</div>
        <select value={src.labelColumn||""} onChange={e=>onChange({spChoicesSource:{...src,labelColumn:e.target.value}})}
          style={{width:"100%",height:32,border:`1px solid ${C.border}`,borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"'DM Sans'",background:C.white}}>
          <option value="">Same as value</option>
          {columns.map(c=><option key={c.InternalName} value={c.InternalName}>{c.Title}</option>)}
        </select>
      </div>
      <div style={{marginBottom:8}}><Toggle checked={!!src.multiSelect} onChange={v=>onChange({spChoicesSource:{...src,multiSelect:v},type:v?"checkbox":"dropdown"})} label="Allow multiple selections"/></div>
      <div style={{marginBottom:8}}>
        <div style={{fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4}}>OData filter (optional)</div>
        <input value={src.filter||""} onChange={e=>onChange({spChoicesSource:{...src,filter:e.target.value}})} placeholder="e.g. Status eq 'Active'"
          style={{width:"100%",height:30,border:`1px solid ${C.border}`,borderRadius:6,padding:"0 8px",fontSize:11,fontFamily:"'DM Sans'",background:C.white}}/>
      </div>
      <button onClick={loadPreview} style={{fontSize:11,color:C.purple,background:"none",border:`1px solid ${C.purpleMid}`,borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"'DM Sans'"}}>{loadingPreview?"Loading…":"Preview choices"}</button>
      {preview.length>0&&<div style={{marginTop:7,display:"flex",flexWrap:"wrap",gap:4}}>
        {preview.map((v,i)=><span key={i} style={{fontSize:10,background:C.white,border:`1px solid ${C.purpleMid}`,borderRadius:4,padding:"2px 7px",color:C.purple}}>{v}</span>)}
        {preview.length===10&&<span style={{fontSize:10,color:C.textMuted}}>…more</span>}
      </div>}
    </>}
  </div>;
}

// ── Property panel ────────────────────────────────────────────────────────────
function PropertyPanel({field,allFields,onChange,token,surveySettings,onSurveySettingsChange}) {
  const [tab,setTab]=useState("general");

  // Survey-level settings panel
  if(!field && surveySettings) return <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:C.purplePale}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <span style={{fontSize:16}}>⚙️</span>
        <span style={{fontSize:13,fontWeight:700,color:C.purple}}>Form Settings</span>
      </div>
      <div style={{fontSize:10,color:C.textMuted}}>SurveyJS form properties</div>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"14px"}}>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <PropRow label="Form title"><Input value={surveySettings.title||""} onChange={v=>onSurveySettingsChange({...surveySettings,title:v})} placeholder="Form title"/></PropRow>
        <PropRow label="Form description"><Textarea value={surveySettings.description||""} onChange={v=>onSurveySettingsChange({...surveySettings,description:v})} rows={2} placeholder="Optional description"/></PropRow>

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Text Formatting</div>
          <PropRow label="Question titles">
            <Select value={surveySettings.titleLocation||"default"} onChange={v=>onSurveySettingsChange({...surveySettings,titleLocation:v})} options={[{value:"default",label:"Default"},{value:"hidden",label:"Hidden"},{value:"top",label:"Top"},{value:"bottom",label:"Bottom"}]}/>
          </PropRow>
          <PropRow label="Text transform">
            <Select value={surveySettings.textTransform||"none"} onChange={v=>onSurveySettingsChange({...surveySettings,textTransform:v})} options={[{value:"none",label:"None"},{value:"uppercase",label:"ALL UPPERCASE"},{value:"capitalize",label:"First Letter Only"},{value:"lowercase",label:"all lowercase"}]}/>
          </PropRow>
          <PropRow label="Show question numbers">
            <Select value={surveySettings.showQuestionNumbers||"on"} onChange={v=>onSurveySettingsChange({...surveySettings,showQuestionNumbers:v})} options={[{value:"on",label:"On"},{value:"onPage",label:"Per page"},{value:"onpanel",label:"Per panel"},{value:"off",label:"Off"}]}/>
          </PropRow>
        </div>

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Behavior</div>
          <PropRow label="Error mode">
            <Select value={surveySettings.checkErrorsMode||"onValueChanged"} onChange={v=>onSurveySettingsChange({...surveySettings,checkErrorsMode:v})} options={[{value:"onValueChanged",label:"On value change"},{value:"onComplete",label:"On complete"},{value:"onNextPage",label:"On next page"}]}/>
          </PropRow>
          <PropRow label="Text update">
            <Select value={surveySettings.textUpdateMode||"onTyping"} onChange={v=>onSurveySettingsChange({...surveySettings,textUpdateMode:v})} options={[{value:"onTyping",label:"On typing"},{value:"onBlur",label:"On blur"}]}/>
          </PropRow>
          <Toggle checked={!!surveySettings.showProgressBar} onChange={v=>onSurveySettingsChange({...surveySettings,showProgressBar:v})} label="Show progress bar"/>
          <Toggle checked={!!surveySettings.showPageTitles} onChange={v=>onSurveySettingsChange({...surveySettings,showPageTitles:v})} label="Show page titles"/>
        </div>

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginTop:4}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Colors (Theme)</div>
          <PropRow label="Primary color"><Input value={surveySettings.primaryColor||"#5B21B6"} onChange={v=>onSurveySettingsChange({...surveySettings,primaryColor:v})} type="color"/></PropRow>
          <PropRow label="Background"><Input value={surveySettings.backgroundColor||"#FFFFFF"} onChange={v=>onSurveySettingsChange({...surveySettings,backgroundColor:v})} type="color"/></PropRow>
          <PropRow label="Text color"><Input value={surveySettings.textColor||"#1E1B4B"} onChange={v=>onSurveySettingsChange({...surveySettings,textColor:v})} type="color"/></PropRow>
        </div>
      </div>
    </div>
  </div>;

  const td=QUESTION_TYPES.find(t=>t.type===field.type&&(t.defaultProps?.inputType===field.inputType||!t.defaultProps?.inputType||!field.inputType))||QUESTION_TYPES[0];
  const hasChoices=["dropdown","radiogroup","checkbox"].includes(field.type);
  const tabs=[{id:"general",label:"General"},{id:"options",label:"Options"},{id:"visibility",label:"Show/Hide"},{id:"enable",label:"Enable/Disable"},{id:"validation",label:"Validation"}];

  return <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}`,background:C.purplePale}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
        <span style={{fontSize:16}}>{td.icon}</span>
        <span style={{fontSize:13,fontWeight:700,color:C.purple}}>{td.label}</span>
      </div>
      <div style={{fontSize:10,color:C.textMuted,fontFamily:"monospace"}}>{field.name}</div>
    </div>
    <div style={{padding:"8px 14px",borderBottom:`1px solid ${C.border}`}}>
      <select value={tab} onChange={e=>setTab(e.target.value)}
        style={{width:"100%",height:32,border:`1px solid ${C.border}`,borderRadius:6,padding:"0 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:C.textPrimary,background:C.white,cursor:"pointer"}}>
        {tabs.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"14px"}}>

      {tab==="general"&&<div style={{display:"flex",flexDirection:"column",gap:0}}>
        <PropRow label="Field name (SP column)" span>
          <Input value={field.name} onChange={v=>onChange({name:v.replace(/\s+/g,"_")})} placeholder="camelCaseName"/>
          <div style={{fontSize:10,color:C.textMuted,marginTop:4}}>No spaces — becomes the SharePoint column name</div>
        </PropRow>
        <PropRow label="Label" span><Input value={field.title} onChange={v=>onChange({title:v})} placeholder="Question label"/></PropRow>
        <PropRow label="Description / hint" span><Input value={field.description||""} onChange={v=>onChange({description:v})} placeholder="Optional helper text"/></PropRow>

        {/* Default value - supported by most field types */}
        {!["html","dynamicmatrix","file"].includes(field.type)&&
          <PropRow label="Default value" span>
            {field.type==="boolean"
              ? <Select value={field.defaultValue?.toString()||""} onChange={v=>onChange({defaultValue:v==="true"?true:v==="false"?false:undefined})} options={[{value:"",label:"(none)"},{value:"true",label:field.labelTrue||"Yes"},{value:"false",label:field.labelFalse||"No"}]}/>
              : field.type==="dropdown"||field.type==="radiogroup"
                ? <Select value={field.defaultValue||""} onChange={v=>onChange({defaultValue:v||undefined})} options={[{value:"",label:"(none)"},...(field.choices||[]).map(c=>{const val=typeof c==="string"?c:c.value;return{value:val,label:typeof c==="string"?c:c.text||c.value}})]}/>
                : <Input value={field.defaultValue||""} onChange={v=>onChange({defaultValue:v||undefined})} placeholder="Default value" type={field.inputType==="number"?"number":"text"}/>
            }
          </PropRow>}

        {/* Required error message */}
        {field.type!=="html"&&field.isRequired&&
          <PropRow label="Required error text" span>
            <Input value={field.requiredErrorText||""} onChange={v=>onChange({requiredErrorText:v||undefined})} placeholder="Custom error message when empty"/>
          </PropRow>}

        {(field.type==="text"||field.type==="comment"||field.type==="dropdown")&&
          <PropRow label="Placeholder" span><Input value={field.placeholder||""} onChange={v=>onChange({placeholder:v})} placeholder="Placeholder text…"/></PropRow>}
        {field.type==="html"&&<PropRow label="HTML content" span><Textarea value={field.html||""} onChange={v=>onChange({html:v})} rows={5} placeholder="<p>Your content</p>"/></PropRow>}
        {field.type==="expression"&&<>
          <PropRow label="Expression" span><Textarea value={field.expression||""} onChange={v=>onChange({expression:v})} rows={2} placeholder="{field1} + {field2}"/></PropRow>
          <PropRow label="Display style"><Select value={field.displayStyle||"decimal"} onChange={v=>onChange({displayStyle:v})} options={[{value:"decimal",label:"Decimal"},{value:"currency",label:"Currency"},{value:"percent",label:"Percent"},{value:"date",label:"Date"}]}/></PropRow>
          {field.displayStyle==="currency"&&<PropRow label="Currency"><Input value={field.currency||"MYR"} onChange={v=>onChange({currency:v})} placeholder="MYR"/></PropRow>}
        </>}
        {field.type==="text"&&<PropRow label="Input type"><Select value={field.inputType||"text"} onChange={v=>onChange({inputType:v})} options={[{value:"text",label:"Text"},{value:"email",label:"Email"},{value:"number",label:"Number"},{value:"date",label:"Date"},{value:"datetime-local",label:"Date & Time"},{value:"tel",label:"Phone"},{value:"url",label:"URL"},{value:"password",label:"Password"}]}/></PropRow>}
        {field.type==="comment"&&<PropRow label="Rows"><Input value={field.rows||4} onChange={v=>onChange({rows:parseInt(v)||4})} type="number"/></PropRow>}
        {field.type==="rating"&&<>
          <PropRow label="Min value"><Input value={field.rateMin??1} onChange={v=>onChange({rateMin:parseInt(v)})} type="number"/></PropRow>
          <PropRow label="Max value"><Input value={field.rateMax??5} onChange={v=>onChange({rateMax:parseInt(v)})} type="number"/></PropRow>
          <PropRow label="Min label"><Input value={field.minRateDescription||""} onChange={v=>onChange({minRateDescription:v})} placeholder="e.g. Poor"/></PropRow>
          <PropRow label="Max label"><Input value={field.maxRateDescription||""} onChange={v=>onChange({maxRateDescription:v})} placeholder="e.g. Excellent"/></PropRow>
        </>}
        {field.type==="boolean"&&<>
          <PropRow label="True label"><Input value={field.labelTrue||"Yes"} onChange={v=>onChange({labelTrue:v})}/></PropRow>
          <PropRow label="False label"><Input value={field.labelFalse||"No"} onChange={v=>onChange({labelFalse:v})}/></PropRow>
        </>}
        {field.type==="signaturepad"&&<>
          <PropRow label="Width (px)"><Input value={field.signatureWidth||400} onChange={v=>onChange({signatureWidth:parseInt(v)})} type="number"/></PropRow>
          <PropRow label="Height (px)"><Input value={field.signatureHeight||200} onChange={v=>onChange({signatureHeight:parseInt(v)})} type="number"/></PropRow>
          <PropRow label="Pen color"><Input value={field.penColor||"#000000"} onChange={v=>onChange({penColor:v})} type="color"/></PropRow>
        </>}
        {field.type==="dynamicmatrix"&&<div style={{background:C.amberPale,border:"1px solid #FDE68A",borderRadius:8,padding:"9px 12px",marginTop:8,fontSize:11,color:C.amber,lineHeight:1.6}}>
          ℹ️ Renders as a SurveyJS dynamic matrix in the form. On submit, responses are saved as an HTML table in the <strong>{field.name}_Response</strong> (Enhanced Rich Text) column in SharePoint.
        </div>}

        {/* Input mask for text fields */}
        {field.type==="text"&&<PropRow label="Input mask (optional)">
          <Select value={field.mask||""} onChange={v=>onChange({mask:v||undefined})} options={[{value:"",label:"None"},{value:"(000) 000-0000",label:"Phone (US)"},{value:"0000-0000-0000-0000",label:"Credit card"},{value:"+00 00 000 0000",label:"Intl phone"},{value:"##/##/####",label:"Date (MM/DD/YYYY)"}]}/>
          <div style={{fontSize:10,color:C.textMuted,marginTop:3}}>Predefined mask or type custom pattern</div>
        </PropRow>}

        <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
          {field.type!=="html"&&<Toggle checked={!!field.isRequired} onChange={v=>onChange({isRequired:v})} label="Required field"/>}
          <Toggle checked={!field.startWithNewLine} onChange={v=>onChange({startWithNewLine:!v})} label="Inline (same row as previous)"/>
          <Toggle checked={!!field.readOnly} onChange={v=>onChange({readOnly:v})} label="Read-only"/>
          <Toggle checked={field.titleLocation==="hidden"} onChange={v=>onChange({titleLocation:v?"hidden":"default"})} label="Hide title"/>
        </div>
      </div>}

      {tab==="options"&&<div>
        {hasChoices&&<>
          {!field.spChoicesSource&&<>
            <PropRow label="Choices" span><ChoicesEditor choices={field.choices} onChange={choices=>onChange({choices})}/></PropRow>
            <PropRow label="Columns (side by side)"><Select value={field.colCount??1} onChange={v=>onChange({colCount:parseInt(v)})} options={[0,1,2,3,4].map(n=>({value:n,label:n===0?"Auto":`${n} column${n>1?"s":""}`}))}/></PropRow>
            {field.type!=="checkbox"&&<PropRow label="Has 'Other' option"><Toggle checked={!!field.hasOther} onChange={v=>onChange({hasOther:v})}/></PropRow>}
            <PropRow label="Has 'None' option"><Toggle checked={!!field.hasNone} onChange={v=>onChange({hasNone:v})}/></PropRow>
          </>}
          <PropRow label="Load choices from SharePoint" span>
            <Toggle checked={!!field.spChoicesSource} onChange={v=>onChange({spChoicesSource:v?{list:"",column:"",multiSelect:false}:undefined})} label="Use SharePoint list as source"/>
          </PropRow>
          {field.spChoicesSource&&<SpChoicesConfig field={field} onChange={onChange} token={token}/>}
        </>}
        {field.type==="matrix"&&<MatrixEditor field={field} onChange={onChange}/>}
        {field.type==="multipletext"&&<MultipleTextEditor field={field} onChange={onChange}/>}
        {field.type==="dynamicmatrix"&&<DynamicMatrixSchemaEditor field={field} onChange={onChange} token={token}/>}
        {field.type==="file"&&<>
          <PropRow label="Allow multiple files"><Toggle checked={!!field.allowMultiple} onChange={v=>onChange({allowMultiple:v})}/></PropRow>
          <PropRow label="Accept (file types)"><Input value={field.acceptedTypes||""} onChange={v=>onChange({acceptedTypes:v})} placeholder=".pdf,.docx,.jpg"/></PropRow>
          <PropRow label="Max file size (KB)"><Input value={field.maxSize||""} onChange={v=>onChange({maxSize:parseInt(v)||undefined})} type="number" placeholder="e.g. 5120"/></PropRow>
        </>}
        {!hasChoices&&!["matrix","multipletext","file","dynamicmatrix"].includes(field.type)&&
          <div style={{textAlign:"center",color:C.textMuted,fontSize:12,padding:"24px 0"}}>No options for this field type.</div>}
      </div>}

{tab==="visibility"&&<VisibilityEditor field={field} allFields={allFields} onChange={onChange}/>}
       {tab==="enable"&&<EnableIfEditor field={field} allFields={allFields} onChange={onChange}/>}
       {tab==="validation"&&<ValidationEditor field={field} onChange={onChange}/>}
    </div>
  </div>;
}

// ── JSON preview ──────────────────────────────────────────────────────────────
function JsonPreview({json,collapsed,onToggle}) {
  const [copied,setCopied]=useState(false);
  const text=JSON.stringify(json,null,2);
  const copy=()=>navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  return <div style={{borderTop:`1px solid ${C.border}`,background:C.purpleDark,height:collapsed?38:220,display:"flex",flexDirection:"column",overflow:"hidden",transition:"height 0.3s"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",height:38,flexShrink:0,cursor:"pointer"}} onClick={onToggle}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:10,fontWeight:700,color:C.purpleMid,textTransform:"uppercase",letterSpacing:"0.06em"}}>SurveyJS JSON</span>
        <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{JSON.stringify(json).length} chars</span>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {!collapsed&&<button onClick={e=>{e.stopPropagation();copy();}} style={{fontSize:10,color:copied?"#6EE7B7":C.purpleMid,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:6,padding:"3px 10px",cursor:"pointer",fontFamily:"'DM Sans'"}}>{copied?"Copied!":"Copy JSON"}</button>}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{transform:collapsed?"rotate(0deg)":"rotate(180deg)",transition:"transform 0.2s"}}>
          <path d="M3 5l4 4 4-4" stroke={C.purpleMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
    {!collapsed&&<pre style={{flex:1,overflowY:"auto",margin:0,padding:"0 14px 14px",fontSize:11,fontFamily:"monospace",color:"rgba(255,255,255,0.75)",lineHeight:1.7}}>{text}</pre>}
  </div>;
}

// ── Live preview modal ────────────────────────────────────────────────────────
function LivePreviewModal({json,onClose,surveySettings,showBanner,meta}) {
  const model=useMemo(()=>{
    try{
      registerQuestionData(json);
      const m=new Model(json);
      // Apply survey settings - apply theme first, then override colors
      if(surveySettings){
        // Apply base theme
        m.applyTheme(LayeredLightPanelless);
        // Override with custom colors via CSS variables
        if(surveySettings.primaryColor){
          m.cssVariables={"--sv-primary-color":surveySettings.primaryColor};
        }
        if(surveySettings.backgroundColor){
          m.cssVariables={"--sv-background-color":surveySettings.backgroundColor};
        }
        if(surveySettings.textColor){
          m.cssVariables={"--sv-text-color":surveySettings.textColor};
        }
        // Apply text transform via onAfterRenderSurvey
        if(surveySettings.textTransform&&surveySettings.textTransform!=="none"){
          const transform={uppercase:"uppercase",capitalize:"capitalize",lowercase:"lowercase"}[surveySettings.textTransform];
          if(transform){
            m.onAfterRenderSurvey.add((survey)=>{
              if(survey?.container)survey.container.style.textTransform=transform;
            });
          }
        }
      } else {
        m.applyTheme(LayeredLightPanelless);
      }
      return m;
    }catch(e){console.error("Preview model error:",e);return null;}
  },[json,surveySettings]);

  if(!model)return null;

  const formTitle=json?.title||"Form Preview";
  const formId=surveySettings?.title?.includes("PMW")?surveySettings.title:"PMW-HR-001";
  const isoStandards=meta?.isoStandards||"ISO 9001 · ISO 14001 · ISO 45001";

  return <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
    style={{position:"fixed",inset:0,zIndex:3000,background:"rgba(30,27,75,0.6)",backdropFilter:"blur(3px)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"40px 20px",overflowY:"auto"}}>
    <div style={{background:C.white,borderRadius:16,width:"100%",maxWidth:760,boxShadow:"0 20px 60px rgba(91,33,182,0.25)",border:`1px solid ${C.border}`,animation:"fadeUp 0.2s ease",overflow:"hidden"}}>
      <div style={{background:`linear-gradient(135deg,${C.purpleDark},${C.purple})`,padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.55)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Live Form Preview</div>
          <div style={{fontSize:14,color:C.white,fontFamily:"'DM Serif Display',serif"}}>How users will see this form</div>
        </div>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:C.white,width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>

      {/* Banner / Header — shown if enabled */}
      {showBanner&&<div style={{borderBottom:`1px solid ${C.border}`}}>
        <div style={{background:`linear-gradient(135deg,${C.purpleDark},${C.purple})`,padding:"16px 22px"}}>
          <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>{isoStandards}</div>
          <div style={{fontFamily:"'DM Serif Display',serif",fontSize:17,color:"#fff"}}>{formTitle}</div>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <tbody>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{width:140,borderRight:`1px solid ${C.border}`,background:C.offWhite,padding:"9px 14px",fontWeight:600,fontSize:10,color:C.textSecond,textTransform:"uppercase",letterSpacing:".04em",verticalAlign:"middle"}}><img src={logo} alt="logo" style={{maxHeight:36,objectFit:"contain"}}/></td>
              <td style={{padding:"12px 16px",fontWeight:700,fontSize:13,color:C.textPrimary}}>PMW INTERNATIONAL BERHAD</td>
            </tr>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              <td style={{width:140,borderRight:`1px solid ${C.border}`,background:C.offWhite,padding:"9px 14px",fontWeight:600,fontSize:10,color:C.textSecond,textTransform:"uppercase",letterSpacing:".04em"}}>Form Title</td>
              <td style={{padding:"9px 14px",color:C.textPrimary,fontSize:13}}>{formTitle}</td>
            </tr>
            <tr>
              <td style={{width:140,borderRight:`1px solid ${C.border}`,background:C.offWhite,padding:"9px 14px",fontWeight:600,fontSize:10,color:C.textSecond,textTransform:"uppercase",letterSpacing:".04em"}}>Doc No.</td>
              <td style={{padding:"9px 14px",color:C.textPrimary,fontSize:13,fontFamily:"monospace"}}>{formId}</td>
            </tr>
          </tbody>
        </table>
      </div>}

      <div className="fb-preview-wrap" style={{padding:"20px 24px",maxHeight:"70vh",overflowY:"auto"}}><Survey model={model}/></div>
      <div style={{padding:"10px 20px",borderTop:`1px solid ${C.border}`,fontSize:11,color:C.textMuted,textAlign:"center",background:C.offWhite}}>Preview only — submissions are not saved</div>
    </div>
  </div>;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function FormBuilder({initialJson,onChange,onPublish,height="calc(100vh - 56px)",token,showBanner=true,meta={}}) {
  const [fields,setFields]=useState(()=>{
    if(!initialJson)return[];
    try{return(initialJson.pages?.[0]?.elements||[]).map((el,i)=>({...el,_id:`q_preload_${i}`}));}
    catch{return[];}
  });
  const [selectedId,setSelectedId]=useState(null);
  const [jsonCollapsed,setJsonCollapsed]=useState(true);
  const [showPreview,setShowPreview]=useState(false);
  const [errors,setErrors]=useState([]);

  // Survey-level settings
  const [surveySettings,setSurveySettings]=useState(()=>{
    if(!initialJson)return{title:"",description:"",titleLocation:"default",textTransform:"none",showQuestionNumbers:"on",checkErrorsMode:"onValueChanged",textUpdateMode:"onTyping",showProgressBar:false,showPageTitles:false,primaryColor:"#5B21B6",backgroundColor:"#FFFFFF",textColor:"#1E1B4B"};
    return{
      title:initialJson.title||"",
      description:initialJson.description||"",
      titleLocation:initialJson.titleLocation||"default",
      textTransform:initialJson.textTransform||"none",
      showQuestionNumbers:initialJson.showQuestionNumbers||"on",
      checkErrorsMode:initialJson.checkErrorsMode||"onValueChanged",
      textUpdateMode:initialJson.textUpdateMode||"onTyping",
      showProgressBar:!!initialJson.showProgressBar,
      showPageTitles:!!initialJson.showPageTitles,
      primaryColor:initialJson.primaryColor||"#5B21B6",
      backgroundColor:initialJson.backgroundColor||"#FFFFFF",
      textColor:initialJson.textColor||"#1E1B4B",
    };
  });

  const selectedField=fields.find(f=>f._id===selectedId)||null;
  const surveyJson=useMemo(()=>buildSurveyJson(fields,surveySettings),[fields,surveySettings]);
  useEffect(()=>{if(onChange)onChange(surveyJson);},[surveyJson,onChange]);

  const addField=useCallback((td,atIndex)=>{
    const q=createQuestion(td);
    setFields(fs=>{const n=[...fs];if(atIndex!==undefined&&atIndex>=0)n.splice(atIndex,0,q);else n.push(q);return n;});
    setSelectedId(q._id);
  },[]);

  const handleChange=useCallback((id,patch)=>setFields(fs=>updateField(fs,id,patch)),[]);
  const handleRemove=useCallback((id)=>{setFields(fs=>removeField(fs,id));setSelectedId(c=>c===id?null:c);},[]);

  const handleDuplicate=useCallback((id)=>{
    setFields(fs=>{
      const next=duplicateField(fs,id);
      const orig=fs.find(x=>x._id===id);
      const copy=next.find(f=>f.name===(orig?.name+"_copy"));
      if(copy)setSelectedId(copy._id);
      return next;
    });
  },[]);

  const handleReorder=useCallback((from,to)=>setFields(fs=>reorderFields(fs,from,to)),[]);

  const handlePublishClick=useCallback(()=>{
    const errs=validateFields(fields);setErrors(errs);
    if(errs.length>0){alert(`Please fix ${errs.length} error(s):\n\n${errs.map(e=>`• ${e.msg}`).join("\n")}`);return;}
    onPublish?.(surveyJson);
  },[fields,surveyJson,onPublish]);

  // Keyboard shortcuts
  useEffect(()=>{
    const handler=e=>{
      if(!selectedId)return;
      // Don't trigger if user is typing in an input
      const tag=e.target.tagName;
      if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT")return;
      if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();handleRemove(selectedId);}
      if(e.key==="d"&&(e.ctrlKey||e.metaKey)){e.preventDefault();handleDuplicate(selectedId);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedId,handleRemove,handleDuplicate]);

  return <div style={{fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column",height,background:C.offWhite,overflow:"hidden"}}>
    <style>{G}</style>

    {/* Toolbar */}
    <div style={{height:46,background:C.white,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 14px",flexShrink:0,gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <Pill>{fields.length} field{fields.length!==1?"s":""}</Pill>
        {errors.length>0&&<Pill color={C.red} bg={C.redPale}>⚠ {errors.length} error{errors.length!==1?"s":""}</Pill>}
      </div>
      <div style={{display:"flex",gap:7,alignItems:"center"}}>
        <button onClick={()=>{const e=validateFields(fields);setErrors(e);if(!e.length)setShowPreview(true);else alert(`Fix ${e.length} error(s) first.`);}}
          style={{display:"flex",alignItems:"center",gap:6,height:30,border:`1px solid ${C.border}`,borderRadius:7,background:C.white,color:C.textSecond,fontSize:12,cursor:"pointer",padding:"0 12px",fontFamily:"'DM Sans',sans-serif"}}>👁 Live Preview</button>
        <button onClick={()=>setJsonCollapsed(c=>!c)}
          style={{display:"flex",alignItems:"center",gap:6,height:30,border:`1px solid ${C.border}`,borderRadius:7,background:jsonCollapsed?C.white:C.purplePale,color:jsonCollapsed?C.textSecond:C.purple,fontSize:12,cursor:"pointer",padding:"0 12px",fontFamily:"'DM Sans',sans-serif"}}>{"</>"} JSON</button>
        {onPublish&&<button onClick={handlePublishClick}
          style={{display:"flex",alignItems:"center",gap:6,height:30,border:"none",borderRadius:7,background:`linear-gradient(135deg,${C.purple},${C.purpleLight})`,color:C.white,fontSize:12,fontWeight:600,cursor:"pointer",padding:"0 16px",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 2px 8px rgba(91,33,182,0.25)"}}>🚀 Publish</button>}
      </div>
    </div>

    {/* 3-panel layout */}
    <div style={{flex:1,display:"grid",gridTemplateColumns:"220px 1fr 260px",overflow:"hidden"}}>
      <div style={{borderRight:`1px solid ${C.border}`,background:C.white,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 12px 6px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Field Types</div>
        </div>
        <Palette onAdd={td=>addField(td)}/>
      </div>
      <div style={{background:C.offWhite,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"8px 14px 6px",borderBottom:`1px solid ${C.border}`,background:C.white,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Form Canvas</div>
          <div style={{fontSize:10,color:C.textMuted}}>Drag to reorder</div>
        </div>
        <Canvas fields={fields} selectedId={selectedId} onSelect={setSelectedId} onRemove={handleRemove} onDuplicate={handleDuplicate} onReorder={handleReorder} onAddFromPalette={addField} errors={errors}/>
      </div>
      <div style={{borderLeft:`1px solid ${C.border}`,background:C.white,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"10px 14px 6px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:10,fontWeight:700,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>Properties</div>
        </div>
        <PropertyPanel field={selectedField} allFields={fields} onChange={patch=>selectedField&&handleChange(selectedField._id,patch)} token={token} surveySettings={surveySettings} onSurveySettingsChange={setSurveySettings}/>
      </div>
    </div>

    <JsonPreview json={surveyJson} collapsed={jsonCollapsed} onToggle={()=>setJsonCollapsed(c=>!c)}/>
    {showPreview&&<LivePreviewModal json={surveyJson} onClose={()=>setShowPreview(false)} surveySettings={surveySettings} showBanner={showBanner} meta={meta}/>}
  </div>;
}