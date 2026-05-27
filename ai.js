/* =========================
   AI.JS — FIXED VERSION
   Main fix: robust JSON parsing
   that actually applies changes
========================= */

const SERVER_URL = "";

/* ===== FIREBASE ===== */
let firebaseDB = null;
function getFirebaseConfig(){ try{return JSON.parse(localStorage.getItem("vscode_firebase")||"null");}catch{return null;} }

async function initFirebase(){
  const cfg=getFirebaseConfig();
  if(!cfg||!cfg.apiKey) return false;
  if(firebaseDB) return true;
  try{
    const {initializeApp,getApps}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    const {getFirestore,collection,addDoc,getDocs,query,orderBy,limit}=await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    const app=getApps().length?getApps()[0]:initializeApp(cfg);
    firebaseDB=getFirestore(app);
    window._fb={collection,addDoc,getDocs,query,orderBy,limit};
    return true;
  }catch(e){console.warn("Firebase:",e.message);return false;}
}

async function saveConversationToCloud(sessionId,messages){
  if(!await initFirebase())return;
  try{const{collection,addDoc}=window._fb;await addDoc(collection(firebaseDB,"conversations"),{sessionId,messages,timestamp:Date.now()});}
  catch(e){console.warn("Cloud save:",e.message);}
}

async function loadLastConversationFromCloud(){
  if(!await initFirebase())return null;
  try{
    const{collection,getDocs,query,orderBy,limit}=window._fb;
    const q=query(collection(firebaseDB,"conversations"),orderBy("timestamp","desc"),limit(1));
    const snap=await getDocs(q);
    return snap.empty?null:snap.docs[0].data();
  }catch(e){console.warn("Cloud load:",e.message);return null;}
}

/* ===== SYSTEM PROMPT ===== */
const SYSTEM_PROMPT=`You are an expert full-stack web developer AI inside a VS Code clone.

You MUST return ONLY a valid JSON object. No text before or after. No markdown. No code blocks. No backticks. Just the raw JSON:

{"reply":"your message here","changes":[{"file":"filename.html","code":"complete file code here"}]}

CRITICAL RULES:
- Start your response with { and end with }
- NEVER wrap in markdown or backticks
- Always return complete file contents
- If navbar links to pages, CREATE all those pages in changes array
- Make CSS beautiful, modern, responsive
- JavaScript must be fully functional
- For login pages use localStorage for auth
- NEVER leave placeholder text
- Create all linked pages automatically`;

/* ===== MAIN CALL ===== */
async function callAI({provider,model,prompt,currentFile,currentCode,files,history}){
  if(SERVER_URL){
    try{
      const res=await fetch(SERVER_URL+"/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider,model,prompt,currentFile,currentCode,files,history}),signal:AbortSignal.timeout(8000)});
      if(res.ok){const d=await res.json();if(d&&!d.error)return d;}
    }catch{console.warn("Server unreachable");}
  }
  return await callDirect({provider,model,prompt,currentFile,currentCode,files,history});
}

/* ===== DIRECT API ===== */
async function callDirect({provider,model,prompt,currentFile,currentCode,files,history}){
  const keys=getStoredKeys();
  const customs=getCustomProviders();
  const custom=customs.find(c=>c.id===provider);

  const filesSummary=Object.keys(files).filter(f=>!f.endsWith("/.gitkeep"))
    .map(f=>`[${f}]:\n${(files[f]||"").slice(0,2000)}`).join("\n---\n").slice(0,12000);

  const userMsg=`USER REQUEST: ${prompt}

CURRENT FILE: ${currentFile}
CURRENT FILE CODE:
${(currentCode||"").slice(0,3000)}

ALL PROJECT FILES:
${filesSummary}

IMPORTANT: If you create links to other pages in navigation, CREATE THOSE PAGES in the changes array too.
Return ONLY raw JSON. No markdown. No backticks.`;

  if(custom) return await callCustomProvider(custom,model,userMsg,history);

  let endpoint="",headers={},body={};

  if(provider==="gemini"){
    if(!keys.gemini) return{reply:"No Gemini key — tap ⚙ Settings",changes:[]};
    endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini}`;
    headers={"Content-Type":"application/json"};
    const geminiPrompt=`${SYSTEM_PROMPT}

ABSOLUTE RULE: Your entire response must be ONLY the JSON object. Start with { and end with }. Nothing else. No "Here is the JSON", no explanation, no markdown. Just the raw JSON.

${userMsg}`;
    body={
      contents:[{parts:[{text:geminiPrompt}]}],
      generationConfig:{temperature:0.3,maxOutputTokens:8192,responseMimeType:"application/json"}
    };
  } else if(provider==="groq"){
    if(!keys.groq) return{reply:"No Groq key — tap ⚙ Settings",changes:[]};
    endpoint="https://api.groq.com/openai/v1/chat/completions";
    headers={"Content-Type":"application/json","Authorization":`Bearer ${keys.groq}`};
    body={model,temperature:0.4,max_tokens:8192,response_format:{type:"json_object"},
      messages:[{role:"system",content:SYSTEM_PROMPT},...buildHistory(history),{role:"user",content:userMsg}]};
  } else if(provider==="deepseek"){
    if(!keys.deepseek) return{reply:"No DeepSeek key — tap ⚙ Settings",changes:[]};
    endpoint="https://api.deepseek.com/v1/chat/completions";
    headers={"Content-Type":"application/json","Authorization":`Bearer ${keys.deepseek}`};
    body={model,temperature:0.4,max_tokens:8192,
      messages:[{role:"system",content:SYSTEM_PROMPT},...buildHistory(history),{role:"user",content:userMsg}]};
  } else if(provider==="huggingface"){
    if(!keys.huggingface) return{reply:"No HuggingFace key — tap ⚙ Settings",changes:[]};
    endpoint=`https://api-inference.huggingface.co/models/${model}`;
    headers={"Authorization":`Bearer ${keys.huggingface}`,"Content-Type":"application/json"};
    body={inputs:SYSTEM_PROMPT+"\n\nReturn only JSON.\n\n"+userMsg,parameters:{max_new_tokens:2000,temperature:0.4,return_full_text:false}};
  } else {
    if(!keys.openrouter) return{reply:"No OpenRouter key — tap ⚙ Settings",changes:[]};
    endpoint="https://openrouter.ai/api/v1/chat/completions";
    headers={"Content-Type":"application/json","Authorization":`Bearer ${keys.openrouter}`,"HTTP-Referer":"https://vscodegodmode.app","X-Title":"VS CODE GOD MODE"};
    body={model,temperature:0.4,max_tokens:8192,
      messages:[{role:"system",content:SYSTEM_PROMPT},...buildHistory(history),{role:"user",content:userMsg}]};
  }

  try{
    const resp=await fetch(endpoint,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
    if(!resp.ok){const e=await resp.text();return{reply:`${provider} error ${resp.status}: ${e.slice(0,200)}`,changes:[]};}
    const data=await resp.json();
    return safeParseAIResponse(provider,data);
  }catch(e){
    if(e.name==="TimeoutError"||e.message.includes("timeout")||e.message.includes("signal"))
      return{reply:"⏱ Request timed out. Try a shorter prompt or a faster model like gemini-2.0-flash or llama-3.1-8b-instant",changes:[]};
    return{reply:"Network error: "+e.message,changes:[]};
  }
}

/* ===== CUSTOM PROVIDER ===== */
async function callCustomProvider(provider,model,userMsg,history){
  if(!provider.endpoint) return{reply:`No endpoint for "${provider.name}"`,changes:[]};
  const headers={"Content-Type":"application/json"};
  if(provider.apiKey) headers["Authorization"]=`Bearer ${provider.apiKey}`;
  if(provider.customHeaders){try{Object.assign(headers,JSON.parse(provider.customHeaders));}catch{}}
  const body={model:model||provider.defaultModel||"gpt-3.5-turbo",temperature:0.4,max_tokens:8192,
    messages:[{role:"system",content:SYSTEM_PROMPT},...buildHistory(history),{role:"user",content:userMsg}]};
  try{
    const resp=await fetch(provider.endpoint,{method:"POST",headers,body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
    if(!resp.ok){const e=await resp.text();return{reply:`${provider.name} error ${resp.status}: ${e.slice(0,200)}`,changes:[]};}
    return safeParseAIResponse("openai_compat",await resp.json());
  }catch(e){return{reply:`${provider.name}: ${e.message}`,changes:[]};}
}

/* ===== SAFE JSON PARSER — BULLETPROOF ===== */
function safeParseAIResponse(provider, data){
  if(!data) return{reply:"No response from AI",changes:[]};
  if(data.error) return{reply:data.error.message||JSON.stringify(data.error),changes:[]};

  // Extract raw text from provider response
  let text="";
  if(provider==="gemini"){
    if(data?.promptFeedback?.blockReason) return{reply:"Blocked: "+data.promptFeedback.blockReason,changes:[]};
    text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
  } else if(provider==="huggingface"){
    text=Array.isArray(data)?(data[0]?.generated_text||""):(data?.generated_text||"");
  } else {
    text=data?.choices?.[0]?.message?.content||"";
  }

  if(!text||!text.trim()) return{reply:"AI returned empty response. Try again.",changes:[]};

  return extractJSON(text);
}

function extractJSON(text){
  // Step 1: strip markdown code fences
  text=text.replace(/^```json\s*/im,"").replace(/^```\s*/im,"").replace(/\s*```\s*$/m,"").trim();

  // Step 2: direct parse
  try{ return sanitizeResult(JSON.parse(text)); }catch{}

  // Step 3: find outermost { }
  const s=text.indexOf("{"), e=text.lastIndexOf("}");
  if(s!==-1&&e>s){
    const chunk=text.slice(s,e+1);
    try{ return sanitizeResult(JSON.parse(chunk)); }catch{}
    // Step 4: try to fix the chunk
    try{ return sanitizeResult(JSON.parse(fixJSON(chunk))); }catch{}
  }

  // Step 5: if reply field itself looks like JSON (Gemini wrapping bug)
  // Try to find "reply" and "changes" manually
  const replyMatch=text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
  const changesMatch=text.match(/"changes"\s*:\s*(\[[\s\S]*\])/);
  if(replyMatch||changesMatch){
    const reply=replyMatch?replyMatch[1].replace(/\\n/g,"\n").replace(/\\"/g,'"'):"Done";
    let changes=[];
    if(changesMatch){
      try{ changes=JSON.parse(changesMatch[1]); }catch{
        // changes array is malformed — try to extract file/code pairs
        changes=extractFileChanges(text);
      }
    }
    return{reply,changes:Array.isArray(changes)?changes.filter(c=>c&&c.file&&c.code!==undefined):[]};
  }

  // Step 6: maybe it's valid but reply IS the JSON string (model returned JSON as the reply value)
  if(text.includes('"changes"')&&text.includes('"file"')&&text.includes('"code"')){
    const changes=extractFileChanges(text);
    if(changes.length>0) return{reply:"Done — "+changes.length+" file(s) updated",changes};
  }

  return{reply:"⚠ Could not parse AI response. Try a different model or simplify your request.",changes:[]};
}

function fixJSON(str){
  // Fix unescaped newlines and tabs inside JSON strings
  let inString=false, escaped=false, result="";
  for(let i=0;i<str.length;i++){
    const ch=str[i];
    if(escaped){result+=ch;escaped=false;continue;}
    if(ch==="\\"){result+=ch;escaped=true;continue;}
    if(ch==='"'){inString=!inString;result+=ch;continue;}
    if(inString){
      if(ch==="\n"){result+="\\n";continue;}
      if(ch==="\r"){result+="\\r";continue;}
      if(ch==="\t"){result+="\\t";continue;}
    }
    result+=ch;
  }
  return result;
}

function extractFileChanges(text){
  // Last-resort extraction: find all "file":"..." "code":"..." pairs
  const changes=[];
  const fileRx=/"file"\s*:\s*"([^"]+)"/g;
  const codeRx=/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/gs;
  const files=[...text.matchAll(fileRx)].map(m=>m[1]);
  const codes=[...text.matchAll(codeRx)].map(m=>m[1].replace(/\\n/g,"\n").replace(/\\t/g,"\t").replace(/\\"/g,'"').replace(/\\\\/g,"\\"));
  for(let i=0;i<Math.min(files.length,codes.length);i++){
    changes.push({file:files[i],code:codes[i]});
  }
  return changes;
}

function sanitizeResult(parsed){
  if(!parsed||typeof parsed!=="object") return{reply:"Invalid AI response",changes:[]};
  // Handle case where reply field itself is a JSON string (double-encoded)
  let reply=parsed.reply||parsed.message||parsed.text||"Done ✓";
  if(typeof reply==="string"&&reply.trim().startsWith("{")){
    try{
      const inner=JSON.parse(reply);
      if(inner.reply||inner.changes) return sanitizeResult(inner);
    }catch{}
  }
  const changes=Array.isArray(parsed.changes)
    ?parsed.changes.filter(c=>c&&c.file&&c.code!==undefined)
    :[];
  return{reply:String(reply),changes};
}

function buildHistory(h=[]){return h.slice(-6).map(x=>({role:x.role,content:String(x.content).slice(0,500)}));}

/* ===== STORAGE ===== */
function getStoredKeys(){try{return JSON.parse(localStorage.getItem("vscode_apikeys")||"{}");}catch{return{};}}
function saveStoredKeys(k){try{localStorage.setItem("vscode_apikeys",JSON.stringify(k));}catch{}}
function getCustomProviders(){try{return JSON.parse(localStorage.getItem("vscode_custom_providers")||"[]");}catch{return[];}}
function saveCustomProviders(p){try{localStorage.setItem("vscode_custom_providers",JSON.stringify(p));}catch{}}
function getCustomModels(){try{return JSON.parse(localStorage.getItem("vscode_custom_models")||"{}");}catch{return{};}}
function saveCustomModels(m){try{localStorage.setItem("vscode_custom_models",JSON.stringify(m));}catch{}}
function addCustomModel(provider,modelName){if(!modelName?.trim())return;const cm=getCustomModels();if(!cm[provider])cm[provider]=[];if(!cm[provider].includes(modelName.trim()))cm[provider].push(modelName.trim());saveCustomModels(cm);}
function removeCustomModel(provider,modelName){const cm=getCustomModels();if(cm[provider])cm[provider]=cm[provider].filter(m=>m!==modelName);saveCustomModels(cm);}

function loadCustomProvidersIntoDropdown(){
  const select=document.getElementById("providerSelect");
  Array.from(select.options).forEach(o=>{if(o.dataset.custom)o.remove();});
  getCustomProviders().forEach(p=>{const o=document.createElement("option");o.value=p.id;o.innerText="⚡ "+p.name;o.dataset.custom="true";select.appendChild(o);});
}

/* ===== SETTINGS ===== */
function openSettings(tab="keys"){
  const k=getStoredKeys();
  document.getElementById("settingsGemini").value=k.gemini||"";
  document.getElementById("settingsGroq").value=k.groq||"";
  document.getElementById("settingsDeepseek").value=k.deepseek||"";
  document.getElementById("settingsOpenrouter").value=k.openrouter||"";
  document.getElementById("settingsHuggingface").value=k.huggingface||"";
  document.getElementById("settingsUnsplash").value=k.unsplash||"";
  const fb=getFirebaseConfig();
  if(fb){
    const fi=document.getElementById("fbApiKey");if(fi)fi.value=fb.apiKey||"";
    const fp=document.getElementById("fbProjectId");if(fp)fp.value=fb.projectId||"";
    const fa=document.getElementById("fbAppId");if(fa)fa.value=fb.appId||"";
  }
  renderCustomProvidersList();
  renderCustomModelsList();
  switchSettingsTab(tab);
  document.getElementById("settingsPanel").classList.remove("hidden");
}

function saveSettings(){
  saveStoredKeys({gemini:document.getElementById("settingsGemini").value.trim(),groq:document.getElementById("settingsGroq").value.trim(),deepseek:document.getElementById("settingsDeepseek").value.trim(),openrouter:document.getElementById("settingsOpenrouter").value.trim(),huggingface:document.getElementById("settingsHuggingface").value.trim(),unsplash:document.getElementById("settingsUnsplash").value.trim()});
  const fbKey=document.getElementById("fbApiKey")?.value.trim();
  const fbProj=document.getElementById("fbProjectId")?.value.trim();
  const fbApp=document.getElementById("fbAppId")?.value.trim();
  if(fbKey&&fbProj){localStorage.setItem("vscode_firebase",JSON.stringify({apiKey:fbKey,projectId:fbProj,appId:fbApp,authDomain:`${fbProj}.firebaseapp.com`,storageBucket:`${fbProj}.appspot.com`,messagingSenderId:"000000000000"}));firebaseDB=null;}
  document.getElementById("settingsPanel").classList.add("hidden");
  showToast("Settings saved ✓","success");
}

function switchSettingsTab(tab){
  document.querySelectorAll(".settings-tab-btn").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  document.querySelectorAll(".settings-tab-content").forEach(c=>c.classList.toggle("hidden",c.dataset.tab!==tab));
}

function renderCustomModelsList(){
  const container=document.getElementById("customModelsList");if(!container)return;
  const cm=getCustomModels();
  const provider=document.getElementById("cmProviderSelect")?.value||"gemini";
  const list=cm[provider]||[];
  container.innerHTML="";
  if(!list.length){container.innerHTML=`<div class="no-custom">No custom models for ${provider} yet.</div>`;return;}
  list.forEach(m=>{const div=document.createElement("div");div.className="custom-provider-item";div.innerHTML=`<span class="cp-name">🤖 ${m}</span><button class="cp-del-btn" onclick="removeCustomModel('${provider}','${m}');renderCustomModelsList();updateModels();">✕</button>`;container.appendChild(div);});
}

function renderCustomProvidersList(){
  const list=document.getElementById("customProvidersList");if(!list)return;
  const customs=getCustomProviders();list.innerHTML="";
  if(!customs.length){list.innerHTML=`<div class="no-custom">No custom providers yet.</div>`;return;}
  customs.forEach((p,i)=>{const div=document.createElement("div");div.className="custom-provider-item";div.innerHTML=`<div class="cp-info"><span class="cp-name">⚡ ${p.name}</span><span class="cp-endpoint">${p.endpoint}</span></div><div class="cp-actions"><button class="cp-edit-btn" onclick="editCustomProvider(${i})">✏</button><button class="cp-del-btn" onclick="deleteCustomProvider(${i})">🗑</button></div>`;list.appendChild(div);});
}

function addCustomProvider(){
  const name=document.getElementById("cpName").value.trim();
  const endpoint=document.getElementById("cpEndpoint").value.trim();
  const apiKey=document.getElementById("cpApiKey").value.trim();
  const model=document.getElementById("cpModel").value.trim();
  const customH=document.getElementById("cpCustomHeaders").value.trim();
  if(!name||!endpoint){showToast("Name and endpoint required","error");return;}
  const customs=getCustomProviders();
  const id="custom_"+Date.now();
  customs.push({id,name,endpoint,apiKey,defaultModel:model,customHeaders:customH});
  saveCustomProviders(customs);
  if(window.models)window.models[id]=model?[model]:["default"];
  ["cpName","cpEndpoint","cpApiKey","cpModel","cpCustomHeaders"].forEach(id=>document.getElementById(id).value="");
  renderCustomProvidersList();loadCustomProvidersIntoDropdown();
  showToast(`"${name}" added ✓`,"success");
}

function editCustomProvider(i){
  const customs=getCustomProviders();const p=customs[i];
  document.getElementById("cpName").value=p.name;document.getElementById("cpEndpoint").value=p.endpoint;
  document.getElementById("cpApiKey").value=p.apiKey||"";document.getElementById("cpModel").value=p.defaultModel||"";
  document.getElementById("cpCustomHeaders").value=p.customHeaders||"";
  customs.splice(i,1);saveCustomProviders(customs);renderCustomProvidersList();loadCustomProvidersIntoDropdown();
  showToast("Edit then click Add","info");
}

function deleteCustomProvider(i){
  const customs=getCustomProviders();if(!confirm(`Delete "${customs[i].name}"?`))return;
  customs.splice(i,1);saveCustomProviders(customs);renderCustomProvidersList();loadCustomProvidersIntoDropdown();showToast("Deleted","info");
}

function getUnsplashKey(){return getStoredKeys().unsplash||"";}