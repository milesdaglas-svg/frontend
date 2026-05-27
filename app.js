/* =========================
   APP.JS — FULL FINAL VERSION
========================= */
let editor1, editor2;
let isSyncing   = false;
let currentFile = "index.html";
let splitFile   = "about.html";
let splitActive = false;
let aiChatHistory = [];
let currentSessionId = "session_"+Date.now();

let files = {
  "index.html":`<!DOCTYPE html>\n<html>\n<head>\n<title>VS Code GOD MODE</title>\n<link rel="stylesheet" href="style.css">\n</head>\n<body>\n<h1>⚡ VS Code Ultra Pro Max</h1>\n<a href="about.html">About</a>\n<script src="script.js"><\/script>\n</body>\n</html>`,
  "about.html":`<!DOCTYPE html>\n<html>\n<head><title>About</title></head>\n<body>\n<h1>ABOUT PAGE</h1>\n<a href="index.html">Home</a>\n</body>\n</html>`,
  "style.css":`body{\nbackground:#111;\ncolor:white;\nfont-family:Arial;\npadding:40px;\n}`,
  "script.js":`console.log("VS Code God Mode");`
};
let openFolders=new Set();

/* ========== STORAGE ========== */
function saveToStorage(){
  try{localStorage.setItem("vscode_files",JSON.stringify(files));localStorage.setItem("vscode_currentFile",currentFile);localStorage.setItem("vscode_openFolders",JSON.stringify([...openFolders]));}catch{}
}
function loadFromStorage(){
  try{
    const s=localStorage.getItem("vscode_files");
    if(s){const p=JSON.parse(s);if(Object.keys(p).length>0){files=p;const c=localStorage.getItem("vscode_currentFile");currentFile=(c&&files[c])?c:Object.keys(files)[0];const of=localStorage.getItem("vscode_openFolders");if(of)openFolders=new Set(JSON.parse(of));return true;}}
  }catch{}return false;
}
setInterval(saveToStorage,3000);

/* ========== TOAST ========== */
function showToast(msg,type="info"){
  const t=document.getElementById("toast");t.innerText=msg;t.className="toast show "+type;
  clearTimeout(t._timer);t._timer=setTimeout(()=>{t.className="toast";},2500);
}

/* ========== FILE ICONS ========== */
function getFileIcon(name){
  const n=name.toLowerCase();
  if(n===".env"||n.startsWith(".env."))return'<span class="fi">⚙</span>';
  if(n==="package.json")return'<span class="fi">📦</span>';
  if(n==="package-lock.json"||n.endsWith(".lock"))return'<span class="fi">🔒</span>';
  if(n==="dockerfile")return'<span class="fi">🐳</span>';
  if(n===".gitignore"||n===".git")return'<span class="fi">🌿</span>';
  if(n==="readme.md")return'<span class="fi">📖</span>';
  const ext=n.split(".").pop();
  const m={html:"🌐",htm:"🌐",css:"🎨",scss:"🎨",sass:"🎨",less:"🎨",js:"⚡",mjs:"⚡",ts:"🔷",tsx:"🔷",jsx:"⚛",json:"{}",md:"📝",mdx:"📝",py:"🐍",php:"🐘",rb:"💎",java:"☕",cpp:"⚙",c:"⚙",h:"⚙",cs:"#⃣",go:"🐹",rs:"🦀",swift:"🍎",kt:"🎯",sh:"🖥",sql:"🗃",xml:"📄",svg:"🖼",png:"🖼",jpg:"🖼",jpeg:"🖼",gif:"🖼",webp:"🖼",ico:"🖼",pdf:"📕",zip:"🗜",mp3:"🎵",mp4:"🎬",yaml:"📐",yml:"📐",toml:"📐",ini:"📐",vue:"💚",svelte:"🔥"};
  return`<span class="fi">${m[ext]||"📄"}</span>`;
}
function getFolderIcon(name,open){
  const m={src:"📂",public:"🌐",assets:"🖼",images:"🖼",components:"⚛",pages:"📄",styles:"🎨",node_modules:"📦",dist:"🚀",build:"🏗",".git":"🌿",tests:"🧪",docs:"📖"};
  return`<span class="fi">${m[name.toLowerCase()]||(open?"📂":"📁")}</span>`;
}
function getLang(f){
  const e=f.split(".").pop().toLowerCase();
  const m={html:"html",htm:"html",css:"css",scss:"css",js:"javascript",mjs:"javascript",ts:"typescript",tsx:"typescript",jsx:"javascript",json:"json",md:"markdown",py:"python",php:"php",rb:"ruby",java:"java",cpp:"cpp",c:"c",cs:"csharp",go:"go",rs:"rust",sql:"sql",xml:"xml",yaml:"yaml",yml:"yaml",sh:"shell",vue:"html",svelte:"html"};
  return m[e]||"plaintext";
}

/* ========== TREE ========== */
function buildTree(){
  const tree={};
  Object.keys(files).forEach(path=>{
    const parts=path.split("/");let node=tree;
    parts.forEach((part,i)=>{if(i===parts.length-1)node[part]={_file:path};else{if(!node[part])node[part]={};node=node[part];}});
  });
  return tree;
}
function renderFiles(){
  const list=document.getElementById("fileList");list.innerHTML="";
  renderTreeNode(buildTree(),list,"");
}
function renderTreeNode(node,container,prefix){
  const keys=Object.keys(node).sort((a,b)=>{const af=node[a]._file!==undefined,bf=node[b]._file!==undefined;if(af&&!bf)return 1;if(!af&&bf)return -1;return a.localeCompare(b);});
  keys.forEach(key=>{
    const val=node[key],path=prefix?prefix+"/"+key:key;
    if(val._file!==undefined){
      if(val._file.endsWith("/.gitkeep"))return;
      const div=document.createElement("div");
      div.className="file-item"+(val._file===currentFile?" active":"")+(splitActive&&val._file===splitFile?" split-active":"");
      div.style.paddingLeft=(prefix.split("/").filter(Boolean).length*14+8)+"px";
      div.innerHTML=`${getFileIcon(key)}<span class="file-name" title="${val._file}">${key}</span><span class="file-actions"><span class="file-split" title="Split">⬒</span><span class="file-delete" title="Delete">✕</span></span>`;
      div.querySelector(".file-name").onclick=()=>openFile(val._file);
      div.querySelector(".file-name").ondblclick=()=>renameFile(val._file);
      div.querySelector(".file-split").onclick=(e)=>{e.stopPropagation();openInSplitFromSidebar(val._file);};
      div.querySelector(".file-delete").onclick=(e)=>{e.stopPropagation();deleteFile(val._file);};
      container.appendChild(div);
    } else {
      const isOpen=openFolders.has(path);
      const fd=document.createElement("div");fd.className="folder-item";
      fd.style.paddingLeft=(prefix.split("/").filter(Boolean).length*14+6)+"px";
      fd.innerHTML=`<span class="folder-arrow">${isOpen?"▾":"▸"}</span>${getFolderIcon(key,isOpen)}<span class="folder-name">${key}</span><span class="folder-actions"><span class="folder-new-file" title="New file">+F</span><span class="folder-new-folder" title="New folder">+D</span><span class="folder-delete" title="Delete">✕</span></span>`;
      const sub=document.createElement("div");sub.className="folder-children";sub.style.display=isOpen?"block":"none";
      fd.querySelector(".folder-name").onclick=fd.querySelector(".folder-arrow").onclick=()=>toggleFolder(path,fd,val,sub);
      fd.querySelector(".folder-new-file").onclick=(e)=>{e.stopPropagation();newFileInFolder(path);};
      fd.querySelector(".folder-new-folder").onclick=(e)=>{e.stopPropagation();newFolderInFolder(path);};
      fd.querySelector(".folder-delete").onclick=(e)=>{e.stopPropagation();deleteFolder(path);};
      container.appendChild(fd);container.appendChild(sub);
      if(isOpen)renderTreeNode(val,sub,path);
    }
  });
}
function toggleFolder(path,fd,node,sub){
  const isOpen=openFolders.has(path);
  if(isOpen){openFolders.delete(path);sub.style.display="none";fd.querySelector(".folder-arrow").innerText="▸";}
  else{openFolders.add(path);sub.style.display="block";sub.innerHTML="";renderTreeNode(node,sub,path);fd.querySelector(".folder-arrow").innerText="▾";}
  saveToStorage();
}

/* ========== FILE OPS ========== */
function openFile(file){
  if(files[file]===undefined)return;
  currentFile=file;
  isSyncing=true;
  editor1.setValue(files[file]);monaco.editor.setModelLanguage(editor1.getModel(),getLang(file));
  if(!splitActive){editor2.setValue(files[file]);monaco.editor.setModelLanguage(editor2.getModel(),getLang(file));}
  isSyncing=false;
  if(file.endsWith(".html"))updatePreview(file);
  renderFiles();renderTabs();addRecent(file);updateSplitHeader();saveToStorage();
  if(window.innerWidth<=768){document.getElementById("sidebar").classList.remove("open");document.getElementById("sidebarOverlay").classList.remove("active");}
}
function newFileInFolder(folderPath){
  const name=prompt("File name:");if(!name?.trim())return;
  const full=folderPath+"/"+name.trim();
  if(files[full]!==undefined){showToast("Already exists!","error");return;}
  const n=name.trim();
  if(n.endsWith(".html"))files[full]=`<!DOCTYPE html>\n<html>\n<head>\n<title>${n}</title>\n</head>\n<body>\n\n</body>\n</html>`;
  else if(n.endsWith(".css"))files[full]=`/* ${n} */\n`;
  else if(n.endsWith(".js"))files[full]=`// ${n}\n`;
  else files[full]="";
  openFolders.add(folderPath);renderFiles();renderTabs();openFile(full);showToast("Created "+full,"success");
}
function newFolderInFolder(parentPath){
  const name=prompt("Folder name:");if(!name?.trim())return;
  const full=parentPath+"/"+name.trim();
  files[full+"/.gitkeep"]="";openFolders.add(parentPath);openFolders.add(full);renderFiles();showToast("Created "+name.trim(),"success");
}
function deleteFolder(folderPath){
  const del=Object.keys(files).filter(f=>f.startsWith(folderPath+"/"));
  if(!del.length){showToast("Folder empty","info");return;}
  if(!confirm(`Delete "${folderPath}" and ${del.length} file(s)?`))return;
  del.forEach(f=>delete files[f]);openFolders.delete(folderPath);
  if(del.includes(currentFile))openFile(Object.keys(files).find(f=>!f.endsWith("/.gitkeep"))||"");
  renderFiles();renderTabs();saveToStorage();showToast("Deleted","info");
}
function renameFile(file){
  const parts=file.split("/"),old=parts.pop();
  const n=prompt("Rename to:",old)?.trim();if(!n||n===old)return;
  const newPath=parts.length?parts.join("/")+"/"+n:n;
  if(files[newPath]!==undefined){showToast("Already exists!","error");return;}
  files[newPath]=files[file];delete files[file];
  if(currentFile===file)currentFile=newPath;if(splitFile===file)splitFile=newPath;
  renderFiles();renderTabs();openFile(currentFile);showToast("Renamed to "+n,"success");
}
function deleteFile(file){
  if(Object.keys(files).filter(f=>!f.endsWith("/.gitkeep")).length<=1){showToast("Can't delete last file.","error");return;}
  if(!confirm(`Delete "${file}"?`))return;
  delete files[file];
  if(currentFile===file)openFile(Object.keys(files).find(f=>!f.endsWith("/.gitkeep"))||"");
  if(splitFile===file){splitActive=false;updateSplitHeader();}
  renderFiles();renderTabs();saveToStorage();
}

/* ========== SPLIT ========== */
function openFileInSplit(file){
  if(files[file]===undefined)return;splitFile=file;splitActive=true;
  isSyncing=true;editor2.setValue(files[file]);monaco.editor.setModelLanguage(editor2.getModel(),getLang(file));isSyncing=false;
  updateSplitHeader();renderFiles();showToast("Split: "+file,"info");
}
function closeSplit(){
  document.getElementById("editor2Wrap").classList.add("hidden");document.getElementById("splitResizer").classList.add("hidden");
  splitActive=false;updateSplitHeader();renderFiles();showToast("Split closed","info");
}
function updateSplitHeader(){
  const h=document.getElementById("splitHeader");if(!h)return;
  if(splitActive){h.innerHTML=`<span>${splitFile}</span><span class="split-close-btn" onclick="closeSplit()">✕</span>`;h.style.display="flex";}
  else h.style.display="none";
}
function openInSplitFromSidebar(file){document.getElementById("editor2Wrap").classList.remove("hidden");document.getElementById("splitResizer").classList.remove("hidden");openFileInSplit(file);}

/* ========== TABS ========== */
function renderTabs(){
  const tabs=document.getElementById("tabs");tabs.innerHTML="";
  Object.keys(files).filter(f=>!f.endsWith("/.gitkeep")).forEach(file=>{
    const tab=document.createElement("div");tab.className="tab"+(file===currentFile?" active":"");
    const name=file.split("/").pop();
    tab.innerHTML=`<span class="tab-label">${getFileIcon(name)} ${name}</span><span class="tab-close">✕</span>`;
    tab.querySelector(".tab-label").onclick=()=>openFile(file);
    tab.querySelector(".tab-close").onclick=(e)=>{e.stopPropagation();deleteFile(file);};
    tabs.appendChild(tab);
  });
}

/* ========== RECENT ========== */
let recentFiles=[];
function addRecent(file){recentFiles=recentFiles.filter(f=>f!==file);recentFiles.unshift(file);if(recentFiles.length>8)recentFiles.pop();renderRecent();}
function renderRecent(){
  const box=document.getElementById("recentProjects");if(!box)return;
  box.innerHTML=`<div class="recent-title">📂 Recent</div>`;
  recentFiles.forEach(file=>{const name=file.split("/").pop();const div=document.createElement("div");div.className="recent-item";div.innerHTML=`${getFileIcon(name)} ${name}`;div.title=file;div.onclick=()=>openFile(file);box.appendChild(div);});
}

/* ========== MONACO ========== */
require.config({paths:{vs:"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min/vs"}});
require(["vs/editor/editor.main"],()=>{
  const shared={theme:"vs-dark",automaticLayout:true,fontSize:14,minimap:{enabled:false},wordWrap:"on",scrollBeyondLastLine:false,tabSize:2,lineNumbers:"on",renderLineHighlight:"all",cursorBlinking:"smooth",smoothScrolling:true,suggestOnTriggerCharacters:true,quickSuggestions:true};
  loadFromStorage();
  editor1=monaco.editor.create(document.getElementById("editor1"),{...shared,language:getLang(currentFile),value:files[currentFile]});
  editor2=monaco.editor.create(document.getElementById("editor2"),{...shared,language:getLang(currentFile),value:files[currentFile]});
  editor1.onDidChangeModelContent(()=>{
    if(isSyncing)return;files[currentFile]=editor1.getValue();
    if(!splitActive){isSyncing=true;editor2.setValue(editor1.getValue());isSyncing=false;}
    if(currentFile.endsWith(".html"))updatePreview(currentFile);
  });
  editor2.onDidChangeModelContent(()=>{
    if(isSyncing)return;
    if(splitActive){files[splitFile]=editor2.getValue();if(splitFile.endsWith(".html"))updatePreview(splitFile);}
    else{files[currentFile]=editor2.getValue();isSyncing=true;editor1.setValue(editor2.getValue());isSyncing=false;if(currentFile.endsWith(".html"))updatePreview(currentFile);}
  });
  renderFiles();renderTabs();updatePreview(currentFile);updateSplitHeader();
  setTimeout(()=>Object.keys(files).filter(f=>!f.endsWith("/.gitkeep")).forEach(f=>addRecent(f)),300);
  editor1.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,saveCurrentFile);
  editor2.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyCode.KeyS,saveCurrentFile);
  editor1.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.KeyF,()=>editor1.trigger("","editor.action.formatDocument",{}));
  editor2.addCommand(monaco.KeyMod.CtrlCmd|monaco.KeyMod.Shift|monaco.KeyCode.KeyF,()=>editor2.trigger("","editor.action.formatDocument",{}));
  // load cloud conversation on start
  loadCloudConversation();
});

/* ========== PREVIEW with scrollbar ========== */
function updatePreview(page=currentFile){
  const iframe=document.getElementById("previewFrame");
  let html=files[page]||"";if(!page.endsWith(".html"))return;
  let css="";Object.keys(files).forEach(f=>{if(f.endsWith(".css"))css+=`<style>${files[f]}</style>`;});
  let js="";Object.keys(files).forEach(f=>{if(f.endsWith(".js")&&!f.includes("sw.js"))js+=`<script>${files[f]}<\/script>`;});
  // inject scrollbar styling
  const scrollCSS=`<style>::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:#f1f1f1}::-webkit-scrollbar-thumb{background:#888;border-radius:4px}::-webkit-scrollbar-thumb:hover{background:#555}body{overflow:auto!important}</style>`;
  html=html.includes("</head>")?html.replace("</head>",css+scrollCSS+"</head>"):css+scrollCSS+html;
  html=html.includes("</body>")?html.replace("</body>",js+"</body>"):html+js;
  html+=`<script>
    (function(){
      var _c={log:console.log.bind(console),error:console.error.bind(console),warn:console.warn.bind(console)};
      ['log','error','warn'].forEach(function(t){console[t]=function(){_c[t].apply(console,arguments);var msg=Array.prototype.slice.call(arguments).map(function(x){return typeof x==='object'?JSON.stringify(x):String(x);}).join(' ');try{parent.postMessage({type:'console',level:t,msg:msg},'*');}catch(e){}};});
      window.onerror=function(m,s,l,c,e){try{parent.postMessage({type:'console',level:'error',msg:m+' (line '+l+')'},'*');}catch(ex){}return false;};
      window.addEventListener('unhandledrejection',function(e){try{parent.postMessage({type:'console',level:'error',msg:'Promise: '+(e.reason?.message||e.reason)},'*');}catch(ex){}});
    })();
    document.addEventListener("click",function(e){var link=e.target.closest("a");if(!link)return;var href=link.getAttribute("href");if(href&&(href.endsWith(".html")||href.startsWith("#"))){if(href.startsWith("#"))return;e.preventDefault();try{parent.postMessage({type:"navigate",page:href},"*");}catch(ex){}}});
  <\/script>`;
  iframe.srcdoc=html;
}
window.addEventListener("message",(e)=>{
  if(e.data.type==="navigate"&&files[e.data.page])openFile(e.data.page);
  if(e.data.type==="console")logConsole(e.data.level,e.data.msg);
});

/* ========== CONSOLE ========== */
const consoleHistory=[];
function logConsole(level,msg){
  consoleHistory.push({level,msg,time:new Date().toLocaleTimeString()});
  renderConsoleLines();
  const b=document.getElementById("consoleBadge");
  if(b){b.innerText=(parseInt(b.innerText)||0)+1;b.style.display="inline";}
  if(level==="error")document.getElementById("consolePanel").classList.remove("hidden");
}
function renderConsoleLines(){
  const panel=document.getElementById("consoleOutput");if(!panel)return;
  panel.innerHTML="";
  consoleHistory.forEach(({level,msg,time})=>{
    const line=document.createElement("div");line.className="console-line console-"+level;
    line.innerHTML=`<span class="console-time">${time}</span><span class="console-icon">${level==="error"?"✖":level==="warn"?"⚠":"›"}</span><span class="console-msg">${String(msg).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</span>`;
    panel.appendChild(line);
  });
  panel.scrollTop=panel.scrollHeight;
}
function escapeHtml(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
document.getElementById("clearConsoleBtn").onclick=()=>{consoleHistory.length=0;renderConsoleLines();const b=document.getElementById("consoleBadge");if(b){b.innerText="0";b.style.display="none";}};
document.getElementById("consoleToggleBtn").onclick=()=>{const p=document.getElementById("consolePanel");p.classList.toggle("hidden");if(!p.classList.contains("hidden"))renderConsoleLines();};

/* ========== FIREBASE CLOUD MEMORY ========== */
async function saveCloudConversation(){
  if(!aiChatHistory.length)return;
  try{
    await saveConversationToCloud(currentSessionId,aiChatHistory);
    showToast("💾 Conversation saved to cloud","success");
  }catch(e){showToast("Cloud save failed: "+e.message,"error");}
}

async function loadCloudConversation(){
  try{
    const data=await loadLastConversationFromCloud();
    if(!data||!data.messages?.length)return;
    const resume=confirm(`☁ Found your last AI conversation (${data.messages.length} messages from ${new Date(data.timestamp).toLocaleDateString()}). Resume it?`);
    if(!resume)return;
    aiChatHistory=data.messages;
    currentSessionId=data.sessionId||currentSessionId;
    // re-render chat
    const chat=document.getElementById("aiChat");chat.innerHTML="";
    aiChatHistory.forEach(m=>addMessage(m.content,m.role==="user"?"user":"ai"));
    showToast("☁ Conversation resumed!","success");
  }catch{}
}

/* ========== AI MODELS + CUSTOM MODELS ========== */
window.models={
  gemini:["gemini-2.5-flash","gemini-2.0-flash","gemini-1.5-flash"],
  groq:["llama-3.3-70b-versatile","llama-3.1-8b-instant","mixtral-8x7b-32768","gemma2-9b-it"],
  deepseek:["deepseek-chat","deepseek-coder"],
  openrouter:["meta-llama/llama-3.3-70b-instruct","mistralai/mistral-7b-instruct","google/gemma-3-12b-it:free","deepseek/deepseek-r1:free","openai/gpt-4o-mini"],
  huggingface:["HuggingFaceH4/zephyr-7b-beta","Qwen/Qwen2.5-Coder-32B-Instruct","mistralai/Mistral-7B-Instruct-v0.3"]
};
const providerSelect=document.getElementById("providerSelect");
const modelSelect=document.getElementById("modelSelect");

function updateModels(){
  const p=providerSelect.value;
  const cm=typeof getCustomModels==="function"?getCustomModels():{};
  const base=window.models[p]||[];
  const custom=cm[p]||[];
  modelSelect.innerHTML="";
  [...base,...custom].forEach(m=>{const o=document.createElement("option");o.value=m;o.innerText=m;modelSelect.appendChild(o);});
  // add + model button hint
  const customProv=typeof getCustomProviders==="function"?getCustomProviders().find(c=>c.id===p):null;
  if(customProv?.defaultModel&&!base.includes(customProv.defaultModel)&&!custom.includes(customProv.defaultModel)){
    const o=document.createElement("option");o.value=customProv.defaultModel;o.innerText=customProv.defaultModel;modelSelect.appendChild(o);
  }
}
providerSelect.onchange=updateModels;updateModels();

function addMessage(text,sender){
  const chat=document.getElementById("aiChat");
  const msg=document.createElement("div");msg.className=sender==="user"?"message user-message":"message ai-message";
  msg.innerText=text;chat.appendChild(msg);chat.scrollTop=chat.scrollHeight;return msg;
}

/* ========== AI SEND ========== */
document.getElementById("aiSend").onclick=async()=>{
  const input=document.getElementById("aiInput");
  const prompt=input.value.trim();if(!prompt)return;
  const provider=providerSelect.value,model=modelSelect.value;
  const sendBtn=document.getElementById("aiSend");
  addMessage(prompt,"user");aiChatHistory.push({role:"user",content:prompt});
  input.value="";sendBtn.disabled=true;sendBtn.innerText="⏳";
  const thinking=addMessage(`🤖 ${provider}/${model}...`,"ai");
  try{
    let data=await callAI({provider,model,prompt,currentFile,currentCode:editor1.getValue(),files,history:aiChatHistory.slice(-12)});

    // SAFETY NET: if reply looks like raw JSON, re-parse it
    if(data.reply&&typeof data.reply==="string"){
      const r=data.reply.trim();
      if((r.startsWith("{")&&r.includes('"changes"'))||(r.startsWith("{")&&r.includes('"reply"'))){
        try{
          const reparsed=typeof extractJSON==="function"?extractJSON(r):JSON.parse(r);
          if(reparsed&&(reparsed.changes?.length>0||reparsed.reply)){
            data=reparsed;
          }
        }catch{}
      }
    }

    thinking.remove();

    if(data.changes&&data.changes.length>0){
      let updatedFiles=0;
      data.changes.forEach(c=>{
        if(c.file&&c.code!==undefined){
          files[c.file]=c.code;
          // auto-open parent folders
          const parts=c.file.split("/");
          for(let i=1;i<parts.length;i++) openFolders.add(parts.slice(0,i).join("/"));
          updatedFiles++;
        }
      });
      renderFiles();renderTabs();
      // open the first changed file
      const firstChanged=data.changes.find(c=>c.file&&files[c.file]!==undefined);
      if(firstChanged) openFile(firstChanged.file);
      else openFile(currentFile);
      showToast(`✅ ${updatedFiles} file(s) updated`,"success");
    }

    const reply=data.reply||"Done ✓";
    // Don't show raw JSON as reply
    const displayReply=reply.trim().startsWith("{")&&reply.includes('"changes"')
      ? "✅ Done! Files have been updated."
      : reply;
    addMessage(displayReply,"ai");
    aiChatHistory.push({role:"assistant",content:displayReply});
    if(aiChatHistory.length%5===0) saveCloudConversation();

  }catch(err){thinking.remove();addMessage("❌ "+err.message,"ai");showToast(err.message,"error");}
  finally{sendBtn.disabled=false;sendBtn.innerText="Send";}
};

document.getElementById("aiInput").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")document.getElementById("aiSend").click();});
document.getElementById("clearChatBtn").onclick=()=>{document.getElementById("aiChat").innerHTML="";aiChatHistory=[];showToast("Chat cleared","info");};
document.getElementById("saveConversationBtn").onclick=saveCloudConversation;
document.querySelectorAll(".prompt-btn").forEach(btn=>{btn.onclick=()=>{document.getElementById("aiInput").value=btn.dataset.prompt;document.getElementById("aiInput").focus();};});

/* ========== IMAGE SEARCH ========== */
async function searchImages(query){
  const key=typeof getUnsplashKey==="function"?getUnsplashKey():"";
  try{if(key){const res=await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=9&client_id=${key}`);const data=await res.json();return(data.results||[]).map(img=>({thumb:img.urls.small,full:img.urls.regular,alt:img.alt_description||query,credit:img.user.name}));}}catch{}
  return Array.from({length:9},(_,i)=>({thumb:`https://picsum.photos/seed/${encodeURIComponent(query)}${i}/200/150`,full:`https://picsum.photos/seed/${encodeURIComponent(query)}${i}/800/600`,alt:query+" "+(i+1),credit:"Picsum"}));
}
document.getElementById("imageSearchBtn").onclick=()=>document.getElementById("imagePanel").classList.toggle("hidden");
document.getElementById("closeImgPanel").onclick=()=>document.getElementById("imagePanel").classList.add("hidden");
document.getElementById("imgSearchGo").onclick=async()=>{
  const q=document.getElementById("imgSearchInput").value.trim();if(!q)return;
  const grid=document.getElementById("imgGrid");grid.innerHTML=`<div class="img-loading">🔍 Searching...</div>`;
  const results=await searchImages(q);grid.innerHTML="";
  results.forEach(img=>{const div=document.createElement("div");div.className="img-item";div.innerHTML=`<img src="${img.thumb}" alt="${img.alt}" loading="lazy">`;div.querySelector("img").onclick=()=>insertImage(img.full,img.alt);grid.appendChild(div);});
};
document.getElementById("imgSearchInput").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("imgSearchGo").click();});
function insertImage(url,alt){
  const tag=`<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;">`;
  if(editor1){const pos=editor1.getPosition();editor1.executeEdits("",[{range:new monaco.Range(pos.lineNumber,pos.column,pos.lineNumber,pos.column),text:tag}]);}
  showToast("Image inserted ✓","success");document.getElementById("imagePanel").classList.add("hidden");
}

/* ========== THEME / FONT / FORMAT ========== */
const themes=["vs-dark","vs","hc-black"];let currentTheme=0;
document.getElementById("themeBtn").onclick=()=>{
  currentTheme=(currentTheme+1)%themes.length;
  monaco.editor.setTheme(themes[currentTheme]);
  const names={vs:"☀ Light","vs-dark":"🌙 Dark","hc-black":"🔳 High Contrast"};
  showToast(names[themes[currentTheme]]+" theme","info");
  // show on mobile too
  document.body.dataset.theme=themes[currentTheme];
};
let fontSize=14;
document.getElementById("fontPlusBtn").onclick=()=>{fontSize=Math.min(28,fontSize+1);editor1.updateOptions({fontSize});editor2.updateOptions({fontSize});showToast("Font: "+fontSize+"px","info");};
document.getElementById("fontMinusBtn").onclick=()=>{fontSize=Math.max(10,fontSize-1);editor1.updateOptions({fontSize});editor2.updateOptions({fontSize});showToast("Font: "+fontSize+"px","info");};
document.getElementById("formatBtn").onclick=()=>{editor1.trigger("","editor.action.formatDocument",{});showToast("Formatted ✓","success");};

// Mobile font/theme buttons
document.getElementById("mobileFontPlus")?.addEventListener("click",()=>document.getElementById("fontPlusBtn").click());
document.getElementById("mobileFontMinus")?.addEventListener("click",()=>document.getElementById("fontMinusBtn").click());
document.getElementById("mobileTheme")?.addEventListener("click",()=>document.getElementById("themeBtn").click());

/* ========== COLLAPSE ========== */
document.getElementById("collapseSidebarBtn").onclick=()=>document.getElementById("sidebar").classList.toggle("collapsed");
document.getElementById("collapsePreviewBtn").onclick=()=>document.getElementById("preview").classList.toggle("collapsed");
document.getElementById("collapseAiBtn").onclick=()=>{document.getElementById("aiPanel").classList.add("collapsed");document.getElementById("aiResizer").classList.add("hidden");};

/* ========== TOPBAR ========== */
document.getElementById("runBtn").onclick=()=>{updatePreview(currentFile);showToast("Preview refreshed","info");};

document.getElementById("newFileBtn").onclick=()=>{
  const name=prompt("File name (e.g. src/app.js):");if(!name?.trim())return;
  const n=name.trim();if(files[n]!==undefined){showToast("Already exists!","error");return;}
  if(n.endsWith(".html"))files[n]=`<!DOCTYPE html>\n<html>\n<head>\n<title>${n.split("/").pop()}</title>\n</head>\n<body>\n\n</body>\n</html>`;
  else if(n.endsWith(".css"))files[n]=`/* ${n.split("/").pop()} */\n`;
  else if(n.endsWith(".js"))files[n]=`// ${n.split("/").pop()}\n`;
  else files[n]="";
  const parts=n.split("/");for(let i=1;i<parts.length;i++)openFolders.add(parts.slice(0,i).join("/"));
  renderFiles();renderTabs();openFile(n);showToast("Created "+n,"success");
};

document.getElementById("newFolderBtn").onclick=()=>{
  const name=prompt("Folder name:");if(!name?.trim())return;
  const n=name.trim();files[n+"/.gitkeep"]="";
  const parts=n.split("/");for(let i=1;i<=parts.length;i++)openFolders.add(parts.slice(0,i).join("/"));
  renderFiles();showToast("Created folder "+n,"success");
};

function saveCurrentFile(){
  const blob=new Blob([editor1.getValue()],{type:"text/plain"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=currentFile.split("/").pop();a.click();URL.revokeObjectURL(a.href);
  showToast("Saved "+currentFile.split("/").pop(),"success");
}
document.getElementById("saveBtn").onclick=saveCurrentFile;

/* ZIP DOWNLOAD */
document.getElementById("downloadAllBtn").onclick=async()=>{
  showToast("Building ZIP...","info");
  try{
    if(!window.JSZip){await new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";s.onload=res;s.onerror=rej;document.head.appendChild(s);});}
    const folderName=prompt("Project folder name:","my-project")||"my-project";
    const zip=new JSZip();const root=zip.folder(folderName);
    Object.keys(files).forEach(path=>{if(path.endsWith("/.gitkeep"))return;root.file(path,files[path]);});
    const blob=await zip.generateAsync({type:"blob"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=folderName+".zip";a.click();URL.revokeObjectURL(a.href);
    showToast("Downloaded "+folderName+".zip ✓","success");
  }catch(err){showToast("ZIP error: "+err.message,"error");}
};

document.getElementById("openFolderBtn").onclick=()=>document.getElementById("folderInput").click();
document.getElementById("folderInput").addEventListener("change",async e=>{
  let count=0;
  for(const file of e.target.files){
    try{const path=file.webkitRelativePath||file.name;files[path]=await file.text();count++;const parts=path.split("/");for(let i=1;i<parts.length;i++)openFolders.add(parts.slice(0,i).join("/"));}catch{}
  }
  renderFiles();renderTabs();
  const first=e.target.files[0]?.webkitRelativePath||e.target.files[0]?.name;
  if(first&&files[first])openFile(first);showToast("Loaded "+count+" files","success");
});

document.getElementById("splitBtn").onclick=()=>{
  const wrap=document.getElementById("editor2Wrap"),sres=document.getElementById("splitResizer");
  if(wrap.classList.contains("hidden")){wrap.classList.remove("hidden");sres.classList.remove("hidden");const next=Object.keys(files).find(f=>f!==currentFile&&!f.endsWith("/.gitkeep"))||currentFile;openFileInSplit(next);}
  else closeSplit();
};
document.getElementById("togglePreviewBtn").onclick=()=>document.getElementById("preview").classList.toggle("collapsed");
document.getElementById("toggleAiBtn").onclick=()=>{const p=document.getElementById("aiPanel"),r=document.getElementById("aiResizer");const col=p.classList.toggle("collapsed");r.classList.toggle("hidden",col);};
document.getElementById("closeAiBtn").onclick=()=>{document.getElementById("aiPanel").classList.add("collapsed");document.getElementById("aiResizer").classList.add("hidden");};
document.getElementById("sidebarToggleBtn").onclick=()=>{document.getElementById("sidebar").classList.toggle("open");document.getElementById("sidebarOverlay").classList.toggle("active");};
document.getElementById("sidebarOverlay").onclick=()=>{document.getElementById("sidebar").classList.remove("open");document.getElementById("sidebarOverlay").classList.remove("active");};

/* ========== RESIZERS ========== */
function makeResizable(resizerId,targetId,direction,minW=40){
  const resizer=document.getElementById(resizerId),target=document.getElementById(targetId);
  if(!resizer||!target)return;
  let startX=0,startW=0;
  resizer.addEventListener("mousedown",e=>{startX=e.clientX;startW=parseInt(window.getComputedStyle(target).width,10);document.documentElement.addEventListener("mousemove",onMove);document.documentElement.addEventListener("mouseup",onUp);e.preventDefault();});
  resizer.addEventListener("dblclick",()=>{target.classList.toggle("collapsed");showToast(target.classList.contains("collapsed")?"Collapsed":"Expanded","info");});
  function onMove(e){const dx=e.clientX-startX;target.style.width=Math.max(minW,direction==="right"?startW+dx:startW-dx)+"px";target.classList.remove("collapsed");}
  function onUp(){document.documentElement.removeEventListener("mousemove",onMove);document.documentElement.removeEventListener("mouseup",onUp);}
}
function makeSplitResizable(){
  const resizer=document.getElementById("splitResizer"),left=document.getElementById("editor1"),right=document.getElementById("editor2Wrap");
  if(!resizer)return;let startX=0,leftW=0,rightW=0;
  resizer.addEventListener("mousedown",e=>{startX=e.clientX;leftW=left.getBoundingClientRect().width;rightW=right.getBoundingClientRect().width;document.documentElement.addEventListener("mousemove",onMove);document.documentElement.addEventListener("mouseup",onUp);e.preventDefault();});
  function onMove(e){const dx=e.clientX-startX;left.style.flex="none";right.style.flex="none";left.style.width=Math.max(80,leftW+dx)+"px";right.style.width=Math.max(80,rightW-dx)+"px";}
  function onUp(){document.documentElement.removeEventListener("mousemove",onMove);document.documentElement.removeEventListener("mouseup",onUp);}
}
makeResizable("sidebarResizer","sidebar","right",40);
makeResizable("previewResizer","preview","left",80);
makeResizable("aiResizer","aiPanel","left",80);
makeSplitResizable();