const K={sessions:"examflow_sessions_v2",results:"examflow_results_v2",goal:"examflow_goal_v2",plans:"examflow_plans_v2",settings:"examflow_settings_v2",exams:"examflow_exams_v1",recent:"examflow_recent_quizzes_v1",study:"examflow_study_activity_v1",plannerDates:"examflow_planner_dates_v1",todos:"examflow_todos_v1",promptLibrary:"examflow_prompt_library_v1",flashcards:"examflow_flashcards_v1",reviewQueue:"examflow_review_queue_v1"};
const sampleQuestions=[
{text:"Which algorithm guarantees shortest paths from a source when edge weights are non-negative?",options:["DFS","Dijkstra's algorithm"],answer:"B",marks:2,negativeMarks:.5},
{text:"What is the average-case lookup complexity of a good hash table?",options:["$O(1)$","$O(\\log n)$"],answer:"A"},
{text:"Which data structure naturally implements BFS?",options:["Queue","Stack"],answer:"A"}
];
let questions=[],answers=[],reviews=new Set(),checkedQuestions=new Set(),current=0,seconds=5*60,quizDurationMinutes=5,mode="exam",sessionId=null,examName="No quiz loaded",sections=[];
let examFinished=false;
let examId=null;
let timerState={examSeconds:5*60,practiceSeconds:5*60,running:false};
let matchOrders={};
let settings=loadSettings();
QuizStorage.ready.then(()=>{
  try{
    settings=loadSettings();
    renderSessions();
    renderDashboard();
    renderPlans();
    renderHome();
    renderTodos();
    renderPlannerCalendar();
    renderPlannerTodos();
    applySettings();
    Flashcards.refresh();
    PlanReviewQueue.render();
  }catch(e){toast("Could not initialize saved data: "+e.message)}
});

function get(k,d){try{const raw=QuizStorage.getItem(k);return raw===null?d:JSON.parse(raw)}catch(e){return d}}
function put(k,v){
  try{QuizStorage.setItem(k,JSON.stringify(v))}
  catch(e){toast("Could not save: "+e.message);throw e}
}
function removeStored(k){QuizStorage.removeItem(k)}
async function savePersistentBackup(){
  try{await QuizStorage.flush();return true}catch(e){return false}
}
function id(){return Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8)}

function cloneData(value){try{return JSON.parse(JSON.stringify(value))}catch(e){return value}}
function saveExamRecord(record){
  if(!record?.id)return;
  const exams=get(K.exams,[]),next={...record,questions:cloneData(record.questions||[]),updatedAt:new Date().toISOString()};
  const old=exams.find(x=>x.id===record.id);
  if(old)Object.assign(old,next);else exams.unshift(next);
  put(K.exams,exams);
}
function registerRecentQuiz(record,metadata={}){
  if(!record?.id)return;
  const recent=get(K.recent,[]),now=new Date().toISOString();
  const old=recent.find(x=>x.id===record.id);
  const next={id:record.id,name:metadata.name||record.name||"Untitled quiz",lastOpenedAt:now,createdAt:old?.createdAt||now,plannedDate:metadata.plannedDate||old?.plannedDate||"",plannedTime:metadata.plannedTime||old?.plannedTime||"",source:metadata.source||old?.source||"quiz"};
  if(old)Object.assign(old,next);else recent.unshift(next);
  recent.sort((a,b)=>String(b.lastOpenedAt||"").localeCompare(String(a.lastOpenedAt||"")));
  put(K.recent,recent);
}
function getExamRecord(idValue){return get(K.exams,[]).find(x=>x.id===idValue)||null}
function registerActiveExam(metadata={}){
  if(!examId)examId=id();
  saveExamRecord({id:examId,name:examName,questions,sections,durationMinutes:quizDurationMinutes});
  registerRecentQuiz({id:examId,name:examName},{...metadata,name:metadata.name||examName});
}
function renderRecentQuizzes(){
  const el=document.getElementById("recentQuizzesList");if(!el)return;
  const recent=get(K.recent,[]),exams=get(K.exams,[]);
  el.innerHTML=renderStackedRows(recent,item=>{
    const exam=exams.find(x=>x.id===item.id),count=exam?.questions?.length||0;
    return `<div class="resultrow recent-quiz-row"><div class="resultmain"><strong>${esc(item.name)}</strong><small>${count} question${count===1?"":"s"}${item.plannedDate?` · Planned ${esc(item.plannedDate)}`:""} · Opened ${new Date(item.lastOpenedAt).toLocaleString()}</small></div><button class="btn" onclick="openRecentQuiz('${item.id}')">Open</button></div>`;
  },"Open a quiz to build your recent list.");
}
function openRecentQuiz(idValue){
  // Resume only unfinished work. A completed session should start a fresh attempt
  // instead of reopening the locked exam canvas.
  const session=get(K.sessions,[]).find(x=>x.examId===idValue&&!x.examFinished);
  if(session){restoreSession(session.id);return}
  const exam=getExamRecord(idValue);if(!exam)return;
  examId=exam.id;examName=exam.name;questions=cloneData(exam.questions||[]);sections=cloneData(exam.sections||[]);answers=Array(questions.length).fill(null);reviews=new Set();checkedQuestions=new Set();matchOrders={};current=0;seconds=(exam.durationMinutes||settings.defaultDuration||5)*60;quizDurationMinutes=seconds/60;timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;examFinished=false;registerRecentQuiz(exam);showView("exam");render();saveSession();
}

function renderTodos() {
  const container = document.getElementById("todoListContainer");
  if(!container) return;
  const todos = get("examflow_todos_v1", []);
  const completed=todos.filter(todo=>todo.done).length;
  const summary=document.getElementById("todoSummary");
  if(summary)summary.textContent=`${todos.length} task${todos.length===1?"":"s"}${completed?` · ${completed} done`:""}`;
  if(!todos.length) {
    container.innerHTML = "<div class='todo-empty'><strong>Nothing on your list yet</strong><span>Add a small study goal to get started.</span></div>";
    return;
  }
  container.innerHTML = todos.map((todo,index)=>{
    const deadline=todo.deadline?new Date(`${todo.deadline}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric"}):"";
    return `<article class="todo-item${todo.done?" is-done":""}">
      <label class="todo-item-label"><input type="checkbox" ${todo.done?"checked":""} onchange="toggleTodo(${index})"><span class="todo-checkmark" aria-hidden="true"></span><span class="todo-item-copy"><strong>${esc(todo.text)}</strong>${deadline?`<small>Due ${esc(deadline)}</small>`:""}</span></label>
      <button class="todo-delete" type="button" aria-label="Delete ${esc(todo.text)}" onclick="deleteTodo(${index})">×</button>
    </article>`;
  }).join("");
}

function addTodo() {
  const input = document.getElementById("todoInput");
  const deadlineInput = document.getElementById("todoDeadline");
  if(!input || !input.value.trim()) return;
  const todos = get("examflow_todos_v1", []);
  todos.push({ text: input.value.trim(), deadline: deadlineInput ? deadlineInput.value : "", done: false });
  put("examflow_todos_v1", todos);
  input.value = "";
  if(deadlineInput) deadlineInput.value = "";
  renderTodos();
  renderPlannerTodos();
  renderStudySuggestions();
}

function toggleTodo(i) {
  const todos = get("examflow_todos_v1", []);
  if(todos[i]) {
    todos[i].done = !todos[i].done;
    put("examflow_todos_v1", todos);
    renderTodos();
    renderPlannerTodos();
    renderStudySuggestions();
  }
}

function deleteTodo(i) {
  const todos = get("examflow_todos_v1", []);
  if(todos[i]) {
    todos.splice(i, 1);
    put("examflow_todos_v1", todos);
    renderTodos();
    renderPlannerTodos();
    renderStudySuggestions();
  }
}

let plannerCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let plannerSelectedDate="";
function plannerDateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
function getPlannerDates(){
  const dates=get(K.plannerDates,{});
  return dates&&typeof dates==="object"&&!Array.isArray(dates)?dates:{};
}
function selectPlannerDate(value){
  if(!value)return;
  const editor=document.getElementById("plannerDateEditor");
  if(editor)editor.open=true;
  plannerSelectedDate=value;
  const date=new Date(`${value}T00:00:00`);
  plannerCalendarMonth=new Date(date.getFullYear(),date.getMonth(),1);
  const input=document.getElementById("plannerDateInput");if(input)input.value=value;
  const label=document.getElementById("plannerDateLabel");if(label)label.value=getPlannerDates()[value]?.label||"";
  renderPlannerCalendar();
}
function renderPlannerCalendar(){
  const root=document.getElementById("plannerCalendar");if(!root)return;
  if(Number.isNaN(plannerCalendarMonth.getTime()))plannerCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const year=plannerCalendarMonth.getFullYear(),month=plannerCalendarMonth.getMonth();
  const title=document.getElementById("plannerCalendarTitle");
  if(title)title.textContent=plannerCalendarMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const dates=getPlannerDates(),first=new Date(year,month,1),days=new Date(year,month+1,0).getDate();
  const html=["<div class='calendar-weekdays'><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class='calendar-days'>"];
  const offset=(first.getDay()+6)%7;
  for(let i=0;i<offset;i++)html.push("<span class='calendar-day is-empty'></span>");
  const today=plannerDateKey(new Date()),exam=getSavedExamDeadline();
  for(let day=1;day<=days;day++){
    const value=plannerDateKey(new Date(year,month,day)),item=dates[value],classes=["calendar-day"];
    if(value===today)classes.push("today");
    if(value===plannerSelectedDate)classes.push("selected");
    if(value===exam)classes.push("exam");
    if(item?.type==="important")classes.push("important");
    html.push(`<button type="button" class="${classes.join(" ")}" onclick="selectPlannerDate('${value}')" aria-label="${esc(new Date(year,month,day).toLocaleDateString(undefined,{dateStyle:"full"}))}${item?.label?`: ${esc(item.label)}`:""}" title="${esc(item?.label||"Select date")}"><span>${day}</span>${item||value===exam?"<i></i>":""}</button>`);
  }
  html.push("</div>");
  root.innerHTML=html.join("");
  if(!plannerSelectedDate){const input=document.getElementById("plannerDateInput");if(input)input.value=""}
}
function shiftPlannerCalendar(delta){
  plannerCalendarMonth=new Date(plannerCalendarMonth.getFullYear(),plannerCalendarMonth.getMonth()+delta,1);
  renderPlannerCalendar();
}
function savePlannerDate(type){
  const value=document.getElementById("plannerDateInput")?.value||plannerSelectedDate;
  if(!value){toast("Select a calendar date first");return}
  const label=document.getElementById("plannerDateLabel")?.value.trim()||(type==="exam"?"Final exam":"Important study date");
  if(type==="exam")put("examflow_exam_deadline",value);
  else{const dates=getPlannerDates();dates[value]={type:"important",label};put(K.plannerDates,dates)}
  plannerSelectedDate=value;renderPlannerCalendar();renderExamDeadline();renderStudySuggestions();toast(type==="exam"?"Exam date saved ✓":"Important date saved ✓");
}
function removePlannerDate(){
  const value=document.getElementById("plannerDateInput")?.value||plannerSelectedDate;
  if(!value)return;
  const dates=getPlannerDates();delete dates[value];put(K.plannerDates,dates);
  if(getSavedExamDeadline()===value)removeStored("examflow_exam_deadline");
  renderPlannerCalendar();renderExamDeadline();renderStudySuggestions();toast("Calendar date removed");
}
function renderPlannerTodos(){
  const container=document.getElementById("plannerTodoList");if(!container)return;
  const todos=get(K.todos,[]);
  container.innerHTML=todos.length?todos.map((todo,index)=>`<div class="planner-todo-row${todo.done?" done":""}"><label><input type="checkbox" ${todo.done?"checked":""} onchange="toggleTodo(${index});renderPlannerTodos()"><span>${esc(todo.text)}</span></label>${todo.deadline?`<small>${esc(todo.deadline)}</small>`:""}<button type="button" onclick="deleteTodo(${index});renderPlannerTodos()" aria-label="Delete ${esc(todo.text)}">×</button></div>`).join(""):"<div class='empty'>No study tasks yet.</div>";
}
function addPlannerTodo(){
  const input=document.getElementById("plannerTodoInput"),deadline=document.getElementById("plannerTodoDeadline");
  if(!input?.value.trim())return;
  const todos=get(K.todos,[]);todos.push({text:input.value.trim(),deadline:deadline?.value||"",done:false});put(K.todos,todos);
  input.value="";if(deadline)deadline.value="";renderPlannerTodos();renderTodos();renderStudySuggestions();
}
function openPlanComposer(){
  const dialog=document.getElementById("planComposer");if(!dialog)return;
  document.getElementById("planJsonStatus").textContent=window.KeyboardShortcuts?.mac?"Cmd+Enter to save":"Ctrl+Enter to save";
  const date=document.getElementById("planDate");
  if(date&&!date.value){const suggested=new Date();suggested.setDate(suggested.getDate()+7);date.value=plannerDateKey(suggested)}
  if(!dialog.open)dialog.showModal();
  document.getElementById("planName")?.focus();
}
function closePlanComposer(){document.getElementById("planComposer")?.close()}
function clearPlanComposer(){["planName","planDate","planTime","planNotes","planJson"].forEach(key=>{const el=document.getElementById(key);if(el)el.value=""})}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function protectBrowserStorage(){
 await QuizStorage.requestPersistence();
 await QuizStorage.updatePanel();
}
async function retryPersistentBackup(){
 QuizStorage.retry();
 await QuizStorage.updatePanel();
}
async function updatePersistentStorageInfo(){
 return QuizStorage.updatePanel();
}

function loadSettings(){
 const s=Object.assign({theme:"light",defaultMode:"exam",fontFamily:"DM Sans",questionTextSize:"standard",colorScheme:"classic",soundEnabled:true,examCardWidth:"balanced",instantFeedback:false,defaultDuration:5,defaultMarks:1,defaultNegative:0},get(K.settings,{}));
 const fonts=["System Default","Serif Elegant","Modern Rounded","Monospace","Source Serif","Libre Baskerville","Lora","DM Sans","Nunito Sans","Inter","Roboto","Open Sans","Manrope","Merriweather","IBM Plex Mono","JetBrains Mono","Fira Code"];
 if(!fonts.includes(s.fontFamily))s.fontFamily="DM Sans";
 if(!["exam","practice"].includes(s.defaultMode))s.defaultMode="exam";
 if(!["small","standard","large","extra-large"].includes(s.questionTextSize))s.questionTextSize="standard";
 s.defaultDuration=[5,10,15,20,30,45,60].includes(Number(s.defaultDuration))?Number(s.defaultDuration):5;
 return s;
}
function saveSettings(){
  const feedbackToggle=document.getElementById("instantFeedback");
  if(feedbackToggle)settings.instantFeedback=feedbackToggle.checked;
  const duration=document.getElementById("defaultDuration");
  if(duration)settings.defaultDuration=[5,10,15,20,30,45,60].includes(Number(duration.value))?Number(duration.value):5;
  const fs=document.getElementById("fontSelect");if(fs)settings.fontFamily=fs.value;
  const cs=document.querySelector('input[name="colorScheme"]:checked');if(cs)settings.colorScheme=cs.value;
  const cw=document.getElementById("examCardWidthSelect");if(cw)settings.examCardWidth=cw.value;
  const textSize=document.getElementById("questionTextSizeSelect");if(textSize)settings.questionTextSize=textSize.value;
  put(K.settings,settings);applySettings();
}
function applySettings(){
 settings.defaultDuration=[5,10,15,20,30,45,60].includes(Number(settings.defaultDuration))?Number(settings.defaultDuration):5;
 document.body.classList.toggle("dark",settings.theme==="dark");updateTheme();
 const d=document.getElementById("defaultDuration");if(d)d.value=String(settings.defaultDuration);
 const fs=document.getElementById("fontSelect");if(fs)fs.value=settings.fontFamily||"DM Sans";
 const textSizes=["small","standard","large","extra-large"];
 const textSize=textSizes.includes(settings.questionTextSize)?settings.questionTextSize:"standard";
 settings.questionTextSize=textSize;
 document.body.classList.remove(...textSizes.map(x=>`question-text-${x}`));
 document.body.classList.add(`question-text-${textSize}`);
 const textSizeSelect=document.getElementById("questionTextSizeSelect");if(textSizeSelect)textSizeSelect.value=textSize;
 const schemes=["classic","ocean","forest","sunset","slate"];
 document.body.classList.remove(...schemes.map(x=>`scheme-${x}`));
 const scheme=schemes.includes(settings.colorScheme)?settings.colorScheme:"classic";
 settings.colorScheme=scheme;
 document.body.classList.add(`scheme-${scheme}`);
 document.querySelectorAll('input[name="colorScheme"]').forEach(input=>input.checked=input.value===scheme);
 const widths=["compact","balanced","spacious"];
 const width=widths.includes(settings.examCardWidth)?settings.examCardWidth:"balanced";
 settings.examCardWidth=width;
 document.body.classList.remove(...widths.map(x=>`exam-card-${x}`));
 document.body.classList.add(`exam-card-${width}`);
 const cw=document.getElementById("examCardWidthSelect");if(cw)cw.value=width;
 const soundOn=settings.soundEnabled!==false;
 const soundToggle=document.getElementById("soundOnBtn"),soundMute=document.getElementById("soundOffBtn");
 if(soundToggle)soundToggle.classList.toggle("active",soundOn);
 if(soundMute)soundMute.classList.toggle("active",!soundOn);
 let fstr = "'DM Sans', 'Segoe UI', Arial, sans-serif";
 if(settings.fontFamily==="System Default") fstr = "'DM Sans', 'Segoe UI', Arial, sans-serif";
 if(settings.fontFamily==="Serif Elegant") fstr = "'Latin Modern Roman', 'Computer Modern', 'STIX Two Text', 'Times New Roman', serif";
 if(settings.fontFamily==="Modern Rounded") fstr = "'Nunito', 'Quicksand', 'Arial Rounded MT Bold', sans-serif";
 if(settings.fontFamily==="Monospace") fstr = "'Cascadia Code', 'SFMono-Regular', Consolas, monospace";
 if(settings.fontFamily==="Source Serif") fstr = "'Source Serif 4', Georgia, serif";
 if(settings.fontFamily==="Libre Baskerville") fstr = "'Libre Baskerville', Georgia, serif";
 if(settings.fontFamily==="Lora") fstr = "'Lora', Georgia, serif";
 if(settings.fontFamily==="DM Sans") fstr = "'DM Sans', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Nunito Sans") fstr = "'Nunito Sans', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Inter") fstr = "'Inter', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Roboto") fstr = "'Roboto', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Open Sans") fstr = "'Open Sans', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Manrope") fstr = "'Manrope', 'Segoe UI', sans-serif";
 if(settings.fontFamily==="Merriweather") fstr = "'Merriweather', Georgia, serif";
 if(settings.fontFamily==="IBM Plex Mono") fstr = "'IBM Plex Mono', Consolas, monospace";
 if(settings.fontFamily==="JetBrains Mono") fstr = "'JetBrains Mono', Consolas, monospace";
 if(settings.fontFamily==="Fira Code") fstr = "'Fira Code', Consolas, monospace";
 document.body.style.setProperty('--exam-font', fstr);
 updateModeUI()
}
function setTheme(x){settings.theme=x;put(K.settings,settings);applySettings()}
function setColorScheme(value){if(!["classic","ocean","forest","sunset","slate"].includes(value))return;settings.colorScheme=value;put(K.settings,settings);applySettings()}
function setSoundEnabled(enabled){settings.soundEnabled=!!enabled;put(K.settings,settings);applySettings();toast(enabled?"Interface sounds on":"Interface sounds muted")}
function setDefaultMode(x){settings.defaultMode=x==="practice"?"practice":"exam";put(K.settings,settings);updateModeUI()}
function updateTheme(){
 const light=document.getElementById("lightBtn"),dark=document.getElementById("darkBtn");
 if(light)light.classList.toggle("active",settings.theme==="light");
 if(dark)dark.classList.toggle("active",settings.theme==="dark");
}
function updateTimerUI(){
 const examEl=document.getElementById("timer");
 const active=mode==="practice"?timerState.practiceSeconds:timerState.examSeconds;
 if(examEl)examEl.textContent=formatGlobalTime(timerState.examSeconds);
 const examCtl=document.getElementById("examTimerControl");
 if(examCtl)examCtl.style.display=mode==="exam"?"flex":"none";
}
function formatGlobalTime(sec){
 sec=Math.max(0,Math.floor(Number(sec)||0));
 return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
}
function startGlobalTimer(){
 timerState.running=true;
 updateTimerUI();
}
function pauseGlobalTimer(){
 timerState.running=false;
 updateTimerUI();
}
function updateModeUI(){
 document.body.classList.toggle("practice-active",mode==="practice");
 document.getElementById("examMode").classList.toggle("active",mode==="exam");
 document.getElementById("practiceMode").classList.toggle("active",mode==="practice");
 document.getElementById("examMode").setAttribute("aria-pressed",String(mode==="exam"));
 document.getElementById("practiceMode").setAttribute("aria-pressed",String(mode==="practice"));
 const defaultExam=document.getElementById("defaultExam"),defaultPractice=document.getElementById("defaultPractice");
 if(defaultExam)defaultExam.classList.toggle("active",settings.defaultMode==="exam");
 if(defaultPractice)defaultPractice.classList.toggle("active",settings.defaultMode==="practice");
 if(document.getElementById("modeBadge"))document.getElementById("modeBadge").textContent=mode==="exam"?"EXAM MODE":"PRACTICE MODE";
 updateTimerUI();
}
function setMode(x){
 mode=x==="practice"?"practice":"exam";
 if(mode==="practice"){
   if(!Number.isFinite(timerState.practiceSeconds)||timerState.practiceSeconds<=0)timerState.practiceSeconds=5*60;
 }else{
   const maxExam=Math.min(10,Math.max(1,quizDurationMinutes||settings.defaultDuration||5))*60;
   if(!Number.isFinite(timerState.examSeconds)||timerState.examSeconds<=0)timerState.examSeconds=maxExam;
 }
 timerState.running=true;
 updateModeUI();
 updateTimerUI();
 render();
 saveSessionSoon();
}

function normalizeImageSource(value){
 if(typeof value==="string")return value.trim();
 if(value&&typeof value==="object")return String(value.src??value.url??value.data??"").trim();
 return "";
}
function normalize(q,defaults={}){
 const text=q.question??q.text??"";
 const type=String(q.type??q.questionType??"mcq").toLowerCase().replace(/[\s-]+/g,"_");
 const explanation=q.explanation??q.reason??q.solution??q.rationale??"";
 const hint=q.hint??"";
 const marks=Number(q.marks??q.points??defaults.marks??settings.defaultMarks??1);
 const negativeMarks=Number(q.negativeMarks??q.negative??defaults.negativeMarks??settings.defaultNegative??0);
 const section=q.section??q.category??q.topic??defaults.name??"General";
 const image=normalizeImageSource(q.image??q.picture);

 if(typeof text!=="string")throw Error("Each question needs question/text.");

 const allowed=["mcq","single_choice","true_false","fill_blank","fill_in_the_blank","match","matching","drag_drop","drag_and_drop","image","image_choice","ordering"];
 if(!allowed.includes(type))throw Error(`Unsupported question type: ${type}`);

 if(type==="fill_blank"||type==="fill_in_the_blank"){
   const accepted=q.acceptedAnswers??q.accepted??q.answers??q.answer;
   const vals=Array.isArray(accepted)?accepted.map(String):[String(accepted??"")];
   if(!vals[0])throw Error("Fill-in-the-blank needs answer/acceptedAnswers.");
   return {type:"fill_blank",text,options:[],answer:vals[0],acceptedAnswers:vals,explanation,hint,marks,negativeMarks,section,image};
 }

 if(type==="match"||type==="matching"||type==="drag_drop"||type==="drag_and_drop"){
   const pairs=q.pairs??q.matches??q.matching;
   if(!Array.isArray(pairs)||!pairs.length)throw Error("Matching questions need a pairs array.");
   const normalizedPairs=pairs.map((p,i)=>{
     if(typeof p==="object")return {left:String(p.left??p.question??p.prompt??""),right:String(p.right??p.answer??p.match??"")};
     if(Array.isArray(p))return {left:String(p[0]??""),right:String(p[1]??"")};
     throw Error(`Invalid matching pair ${i+1}.`);
   });
   if(normalizedPairs.some(p=>!p.left||!p.right))throw Error("Every matching pair needs left and right values.");
   return {type:type.includes("drag")?"drag_drop":"match",text,options:[],answer:normalizedPairs.map(p=>p.right),pairs:normalizedPairs,explanation,hint,marks,negativeMarks,section,image};
 }

 if(type==="ordering"){
   const items=q.items??q.options??q.choices;
   const raw=q.answer??q.correct;
   if(!Array.isArray(items)||items.length<2)throw Error("Ordering questions need an items array.");
   const order=Array.isArray(raw)?raw.map(String):[];
   if(order.length!==items.length)throw Error("Ordering answer must contain every item in order.");
   return {type:"ordering",text,options:items.map(String),answer:order,explanation,hint,marks,negativeMarks,section,image};
 }

 const options=q.options??q.choices;
 if(type==="true_false"){
   const opts=["True","False"];
   const raw=q.answer??q.correct;
   const answer=String(raw).toLowerCase().startsWith("t")?"A":"B";
   return {type:"true_false",text,options:opts,answer,explanation,hint,marks,negativeMarks,section,image};
 }
 if(!Array.isArray(options)||options.length<2)throw Error("Each choice question needs at least 2 options/choices.");
 const raw=q.answer??q.correct;
 let answer=null;
 if(typeof raw==="number"&&raw>=0&&raw<options.length)answer=String.fromCharCode(65+raw);
 else if(typeof raw==="string"){
   const s=raw.trim(),letter=s.match(/^([A-Z])$/i);
   if(letter){let n=letter[1].toUpperCase().charCodeAt(0)-65;if(n<options.length)answer=letter[1].toUpperCase()}
   if(!answer){let i=options.findIndex(x=>String(x).trim()===s);if(i>=0)answer=String.fromCharCode(65+i)}
 }
 if(!answer)throw Error("Could not resolve answer for: "+text.slice(0,55));
 return {type:type==="image_choice"?"image_choice":type==="image"?"image":"mcq",text,options:options.map(String),answer,explanation,hint,marks,negativeMarks,section,image};
}

function parseQuizInput(raw){
  let text=String(raw??"").trim();
  if(!text)throw Error("Paste quiz JSON first.");

  // Accept ```json ... ```, ``` ... ```, or plain pasted JSON.
  text=text.replace(/^\uFEFF/,"").trim();
  text=text.replace(/^```(?:json|JSON|javascript|js)?\s*/,"").replace(/\s*```$/,"").trim();

  // If explanatory text was copied around the JSON, isolate the first complete
  // object/array. This is deliberately conservative and only runs if direct
  // JSON.parse fails.
  const direct=()=>{
    try{return JSON.parse(text)}catch(e){return null}
  };
  let parsed=direct();
  if(parsed!==null)return parsed;

  let candidate=text;
  const firstObj=text.indexOf("{"),firstArr=text.indexOf("[");
  let start=-1;
  if(firstObj<0)start=firstArr;
  else if(firstArr<0)start=firstObj;
  else start=Math.min(firstObj,firstArr);
  if(start>0)candidate=text.slice(start);

  // Remove JS-style comments outside strings and trailing commas.
  candidate=candidate
    .replace(/\/\*[\s\S]*?\*\//g,"")
    .replace(/(^|[^:\\])\/\/[^\r\n]*/g,"$1")
    .replace(/,\s*([}\]])/g,"$1");

  // Common copy/paste issue: smart quotes.
  candidate=candidate
    .replace(/[\u201C\u201D]/g,'"')
    .replace(/[\u2018\u2019]/g,"'");

  try{return JSON.parse(candidate)}catch(e){}

  // Allow unquoted object keys: {question:"...", options:[...]}.
  candidate=candidate.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g,"$1\"$2\"$3");

  // Allow simple single-quoted JSON strings when the content contains no
  // unescaped apostrophe. This is only a fallback after real JSON failed.
  candidate=candidate.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g,(m,s)=>{
    return '"'+s.replace(/"/g,'\\"')+'"';
  });

  try{return JSON.parse(candidate)}catch(e){
    // Final recovery: if surrounding plain text remains, isolate the last
    // closing brace/bracket and retry.
    const end=Math.max(candidate.lastIndexOf("}"),candidate.lastIndexOf("]"));
    if(end>=0){
      const clipped=candidate.slice(0,end+1);
      try{return JSON.parse(clipped)}catch(_){}
    }
    throw Error("Quiz JSON could not be repaired. Paste the JSON, optionally inside ```json ... ```, and the quiz will try to recover common formatting errors.");
  }
}

function parseQuiz(data){
 let qs=[],secs=[],name="Imported CBQ",duration=Number(settings.defaultDuration||5);
 if(Array.isArray(data)){
   qs=data.map(q=>normalize(q));
 }else if(data&&Array.isArray(data.sections)){
   name=data.name||name;
   data.sections.forEach(s=>{
     if(!Array.isArray(s.questions))throw Error("A section is missing its questions array.");
     s.questions.forEach(q=>qs.push(normalize(q,s)));
     if(s.timeMinutes!=null)duration+=Number(s.timeMinutes||0);
     secs.push({name:s.name||"General",timeMinutes:s.timeMinutes,marks:s.marks,negativeMarks:s.negativeMarks});
   });
   if(data.timeMinutes!=null)duration=Number(data.timeMinutes);
 }else throw Error("Use a flat JSON array or an object containing sections.");
 if(Array.isArray(data)&&data.timeMinutes!=null)duration=Number(data.timeMinutes);
 if(!qs.length)throw Error("No questions found.");
 return {name,questions:qs,sections:secs,durationMinutes:Math.min(10,Math.max(1,duration))};
}
function openImporter(){document.getElementById("importer").classList.add("show");document.getElementById("jsonInput").value="";document.getElementById("jsonStatus").textContent="";setTimeout(()=>document.getElementById("jsonInput").focus(),40)}
function closeImporter(){document.getElementById("importer").classList.remove("show")}
function readFile(e){let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>document.getElementById("jsonInput").value=r.result;r.readAsText(f)}
function loadQuiz(){
 try{
   const parsed=parseQuiz(parseQuizInput(document.getElementById("jsonInput").value));
   questions=prepareShuffledQuiz(parsed.questions);sections=parsed.sections;examName=parsed.name;examId=id();
   answers=Array(questions.length).fill(null);reviews=new Set();checkedQuestions=new Set();matchOrders={};current=0;
   quizDurationMinutes=Math.min(10,Math.max(1,parsed.durationMinutes||settings.defaultDuration||5));seconds=quizDurationMinutes*60;timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;sessionId=null;examFinished=false;
   if(document.getElementById("examTitle"))document.getElementById("examTitle").textContent=examName;document.getElementById("headerQuizName").textContent=examName;
   if(document.getElementById("examMeta"))document.getElementById("examMeta").textContent=`${questions.length} questions · ${quizDurationMinutes} min · scoring from JSON/settings`;
   registerActiveExam();closeImporter();showView("exam");render();saveSession();toast(`Loaded ${questions.length} questions ✓`);
 }catch(e){document.getElementById("jsonStatus").className="status err";document.getElementById("jsonStatus").textContent="✕ "+e.message}
}


function protectQuizCodeAndMath(root){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const parent=node.parentElement;
    if(!parent||parent.closest("pre,code,.katex,.katex-display"))return;
    const text=node.nodeValue;
    if(!text||!text.trim())return;

    let out=text;
    // Fenced code: ```language\n...\n```
    out=out.replace(/```([A-Za-z0-9_+-]*)[ \t]*\n?([\s\S]*?)```/g,
      (_,lang,code)=>`<pre class="quiz-code-block"><code>${esc(code)}</code></pre>`);
    // Inline code: `...`
    out=out.replace(/`([^`\n]+)`/g,
      (_,code)=>`<code class="quiz-inline-code">${esc(code)}</code>`);

    if(out!==text){
      const holder=document.createElement("span");
      holder.innerHTML=out;
      const frag=document.createDocumentFragment();
      while(holder.firstChild)frag.appendChild(holder.firstChild);
      node.parentNode.replaceChild(frag,node);
    }
  });
}
function formatExplanationText(text){
  if(text==null)return "";
  return String(text).trim();
}
function renderQuizInlineMarkdown(text){
 const tokens=[];
 const hold=html=>`\uE000${tokens.push(html)-1}\uE001`;
 const protectedText=String(text).replace(/(`[^`\n]+`|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$)/g,match=>{
   if(match[0]==="`")return hold(`<code class="quiz-inline-code">${esc(match.slice(1,-1))}</code>`);
   return hold(esc(match));
 });
 let html=esc(protectedText)
   .replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>")
   .replace(/(^|[^\w])__([^_\n]+)__(?!\w)/g,"$1<strong>$2</strong>")
   .replace(/~~([^~\n]+)~~/g,"<del>$1</del>")
   .replace(/\*([^*\n]+)\*/g,"<em>$1</em>")
   .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g,"$1<em>$2</em>");
 return html.replace(/\uE000(\d+)\uE001/g,(_,index)=>tokens[Number(index)]);
}
function quizMarkdownHtml(text){
 const lines=String(text??"").replace(/\r\n?/g,"\n").replace(/\\n/g,"\n").split("\n"),blocks=[];
 let paragraph=[],i=0;
 const flush=()=>{if(paragraph.length){blocks.push(`<p>${paragraph.map(renderQuizInlineMarkdown).join("<br>")}</p>`);paragraph=[]}};
 while(i<lines.length){
   const line=lines[i],trimmed=line.trim();
   if(!trimmed){flush();i++;continue}
   if(/^```/.test(trimmed)){
     flush();const code=[];i++;
     while(i<lines.length&&!/^```/.test(lines[i].trim()))code.push(lines[i++]);
     if(i<lines.length)i++;
     blocks.push(`<pre class="quiz-code-block"><code>${esc(code.join("\n"))}</code></pre>`);continue;
   }
   const heading=trimmed.match(/^(#{1,3})\s+(.+)$/);
   if(heading){flush();blocks.push(`<h${heading[1].length+2}>${renderQuizInlineMarkdown(heading[2])}</h${heading[1].length+2}>`);i++;continue}
   const item=trimmed.match(/^([-*+]|\d+[.)])\s+(.+)$/);
   if(item){
     flush();const ordered=/^\d/.test(item[1]),items=[];
     while(i<lines.length){
       const match=lines[i].trim().match(/^([-*+]|\d+[.)])\s+(.+)$/);
       if(!match||/^\d/.test(match[1])!==ordered)break;
       items.push(`<li>${renderQuizInlineMarkdown(match[2])}</li>`);i++;
     }
     blocks.push(`<${ordered?"ol":"ul"}>${items.join("")}</${ordered?"ol":"ul"}>`);continue;
   }
   paragraph.push(line);i++;
 }
 flush();return blocks.join("");
}
function setQuizRichText(element,text){
 if(!element)return;
 element.classList.add("quiz-rich-text");
 element.innerHTML=quizMarkdownHtml(text);
}
function setQuizExplanation(element,text){
 if(!element)return;
 element.setAttribute("role","region");
 element.setAttribute("aria-labelledby","explanationHeading");
 element.innerHTML='<div class="explanation-heading"><span aria-hidden="true">💡</span><h3 id="explanationHeading">Explanation</h3></div>';
 const content=document.createElement("div");
 content.className="explanation-content";
 setQuizRichText(content,formatExplanationText(text));
 element.appendChild(content);
 renderAllQuizMath(element);
}
function renderAllQuizMath(root=document){
  if(!root||typeof renderMathInElement!=="function")return;
  protectQuizCodeAndMath(root);
  const cfg={
    delimiters:[
      {left:"$$",right:"$$",display:true},
      {left:"\\[",right:"\\]",display:true},
      {left:"$",right:"$",display:false},
      {left:"\\(",right:"\\)",display:false}
    ],
    throwOnError:false,strict:false,trust:false
  };
  try{renderMathInElement(root,cfg)}catch(e){}
}

function renderMath(){
  renderAllQuizMath(document.getElementById("examView")||document);
}

const examflowMathObserver=new MutationObserver(mutations=>{
  for(const m of mutations){
    if(m.addedNodes&&m.addedNodes.length){
      m.addedNodes.forEach(n=>{if(n.nodeType===1)renderAllQuizMath(n)});
    }
  }
});
document.addEventListener("DOMContentLoaded",()=>{
  const root=document.getElementById("examView")||document.body;
  examflowMathObserver.observe(root,{childList:true,subtree:true});
});

const __examflowRenderWithMath=render;
render=function(){
  __examflowRenderWithMath();
  renderAllQuizMath(document.getElementById("examView")||document);
};

function renderQuestionImage(q){
 const old=document.getElementById("questionImage");
 if(old)old.remove();
 if(!q.image)return;
 const img=document.createElement("img");
 img.id="questionImage";img.src=q.image;img.alt="Question image";
 img.addEventListener("error",()=>{img.replaceWith(Object.assign(document.createElement("div"),{id:"questionImage",className:"question-image-error",textContent:"Image could not be loaded. Check that the URL or embedded data is valid."}))},{once:true});
 img.style.cssText="display:block;max-width:100%;max-height:360px;object-fit:contain;margin:10px auto 18px;border-radius:10px;border:1px solid var(--line);";
 const qt=document.getElementById("questionText");
 qt.parentNode.insertBefore(img,qt.nextSibling);
}
function renderSpecialQuestion(q,opts){
 opts.innerHTML="";
 if(q.type==="fill_blank"){
   const wrap=document.createElement("div");
   wrap.className="special-answer";
   const input=document.createElement("input");
   input.className="fill-answer";input.placeholder="Type your answer…";input.autocomplete="off";
   input.value=answers[current]||"";
   input.oninput=()=>{answers[current]=input.value;checkedQuestions.delete(current);saveSessionSoon()};
   wrap.appendChild(input);opts.appendChild(wrap);
 }else if(q.type==="match"||q.type==="drag_drop"){
   const chosen=answers[current]||[];
   const rights=q.pairs.map(p=>p.right);
   if(!matchOrders[current]){
     const indexed=rights.map((right,i)=>({right,i}));
     // Fisher-Yates once per question; the resulting order is retained.
     for(let i=indexed.length-1;i>0;i--){
       const j=Math.floor(Math.random()*(i+1));
       [indexed[i],indexed[j]]=[indexed[j],indexed[i]];
     }
     matchOrders[current]=indexed.map(x=>x.right);
     saveSessionSoon();
   }
   const shuffled=matchOrders[current];
   const grid=document.createElement("div");grid.className="matching-grid";
   q.pairs.forEach((pair,i)=>{
     const row=document.createElement("div");row.className="match-row";
     const left=document.createElement("div");left.className="match-left";
     setQuizRichText(left,pair.left);

     const wrap=document.createElement("div");wrap.className="match-choice";
     const selected=chosen[i]||"";
     const trigger=document.createElement("button");
     trigger.type="button";trigger.className="match-trigger";
     trigger.innerHTML=selected?`<span class="match-selected">${esc(selected)}</span><span class="match-chevron">⌄</span>`:`<span class="match-placeholder">Choose match…</span><span class="match-chevron">⌄</span>`;

     const menu=document.createElement("div");menu.className="match-menu";
     menu.innerHTML=shuffled.map((x,k)=>`<button type="button" class="match-menu-item${String(x)===String(selected)?" selected":""}" data-value="${esc(x)}"><span>${String.fromCharCode(65+k)}</span><span class="match-menu-text">${esc(x)}</span></button>`).join("");
     menu.querySelectorAll(".match-menu-item").forEach(item=>{
       item.onclick=()=>{
         const value=item.getAttribute("data-value")||"";
         const a=Array.isArray(answers[current])?[...answers[current]]:Array(q.pairs.length).fill("");
         a[i]=value;answers[current]=a;checkedQuestions.delete(current);saveSessionSoon();render();
       };
     });
     trigger.onclick=e=>{
       e.stopPropagation();
       document.querySelectorAll(".match-choice.open").forEach(x=>{if(x!==wrap)x.classList.remove("open")});
       wrap.classList.toggle("open");
     };
     wrap.append(trigger,menu);

     if(checkedQuestions.has(current)){
       const ok=String(chosen[i]??"").trim().toLowerCase()===String(pair.right??"").trim().toLowerCase();
       row.classList.add(ok?"match-correct":"match-wrong");
       const label=document.createElement("div");label.className="match-result-label";label.textContent=ok?"✓ Correct":"✕ Incorrect";
       row.append(left,wrap,label);
     }else row.append(left,wrap);
     grid.appendChild(row);
   });
   opts.appendChild(grid);
   renderAllQuizMath(grid);
   if(q.type==="drag_drop"){
     const hint=document.createElement("div");hint.className="drag-hint";hint.textContent="↕ Match each item using the selectors.";opts.appendChild(hint);
   }
   if(mode==="practice"){
     const check=document.createElement("button");
     check.type="button";check.className="btn primary match-check-btn";
     check.textContent="✓ Check matches";
     check.onclick=()=>{if(!answerIsPresent(answers[current],q)){toast("Complete every match first");return}checkedQuestions.add(current);render();saveSessionSoon()};
     opts.appendChild(check);
   }
 }else if(q.type==="ordering"){
   const currentOrder=Array.isArray(answers[current])&&answers[current].length?answers[current]:[...q.options];
   const list=document.createElement("div");list.className="ordering-list";
   currentOrder.forEach((item,i)=>{
     const b=document.createElement("button");b.type="button";b.className="order-item";b.draggable=true;b.textContent=`${i+1}. ${item}`;
     b.ondragstart=e=>e.dataTransfer.setData("text/plain",String(i));
     b.ondragover=e=>e.preventDefault();
     b.ondrop=e=>{const from=Number(e.dataTransfer.getData("text/plain"));const arr=[...currentOrder];const [m]=arr.splice(from,1);arr.splice(i,0,m);answers[current]=arr;checkedQuestions.delete(current);render();saveSessionSoon()};
     list.appendChild(b);
   });
   opts.appendChild(list);
 }else{
   q.options.forEach((text,i)=>{
     const letter=String.fromCharCode(65+i),b=document.createElement("button");
     b.type="button";b.className="option"+(answers[current]===letter?" selected":"");
     const marker=document.createElement("span");marker.className="letter";marker.textContent=letter;
     const optionText=document.createElement("span");optionText.className="option-text quiz-rich-text";
     optionText.innerHTML=String(text).split(/\r?\n/).map(renderQuizInlineMarkdown).join("<br>");
     b.append(marker,optionText);
     b.onclick=()=>choose(letter);opts.appendChild(b);
   });
 }
}
function isQuestionCorrect(q,ans){
 if(q.type==="fill_blank"){
   return q.acceptedAnswers.some(x=>String(x).trim().toLowerCase()===String(ans??"").trim().toLowerCase());
 }
 if(q.type==="match"||q.type==="drag_drop"){
   if(!Array.isArray(ans)||ans.length!==q.pairs.length)return false;
   return q.pairs.every((pair,i)=>{
     const selected=String(ans[i]??"").trim().toLowerCase();
     const expected=String(pair.right??"").trim().toLowerCase();
     return selected!=="" && selected===expected;
   });
 }
 if(q.type==="ordering"){
   return Array.isArray(ans)&&ans.length===q.answer.length&&q.answer.every((x,i)=>String(ans[i])===String(x));
 }
 return ans===q.answer;
}
function answerIsPresent(ans,q){
 if(ans==null)return false;
 if(q.type==="fill_blank")return String(ans).trim()!=="";
 if(q.type==="match"||q.type==="drag_drop")return Array.isArray(ans)&&ans.length===q.pairs.length&&ans.every(x=>String(x??"").trim()!=="");
 if(q.type==="ordering")return Array.isArray(ans)&&ans.length===q.answer.length&&ans.every(x=>String(x).trim()!=="");
 return !!ans;
}
function getSessionAnsweredCount(session){
 const questions=Array.isArray(session.questions)?session.questions:[];
 const answers=Array.isArray(session.answers)?session.answers:[];
 return questions.reduce((count,question,index)=>count+(answerIsPresent(answers[index],question)?1:0),0);
}

/* Fast keyboard workflow */
let examflowKeyboardShortcuts={busy:false};
function isTypingTarget(el){
  if(!el)return false;
  const tag=(el.tagName||"").toLowerCase();
  return tag==="input"||tag==="textarea"||tag==="select"||el.isContentEditable;
}
async function examflowCtrlEnter(){
  const importer=document.getElementById("importer");
  const homeInput=document.getElementById("homeJson");
  if(!importer?.classList.contains("show") && document.getElementById("homeView")?.classList.contains("active") && homeInput?.value.trim()){
    startHomeQuiz();
    return;
  }
  const input=document.getElementById("jsonInput");
  if(importer?.classList.contains("show") && input){
    // Ctrl+Enter starts the JSON already pasted into the importer.
    if(examflowKeyboardShortcuts.busy)return;
    examflowKeyboardShortcuts.busy=true;
    try{
      const before=input.value.trim();
      if(!before){
        try{await pasteFromClipboard("jsonInput","jsonStatus","importPasteBtn")}catch(e){}
      }
      if(input.value.trim())loadQuiz();else toast("Paste quiz JSON first");
    }finally{examflowKeyboardShortcuts.busy=false}
    return;
  }
  if(document.getElementById("homeView")?.classList.contains("active")){
    openImporter();
    setTimeout(()=>examflowCtrlEnter(),60);
  }
}
function examflowToggleThemeFast(){
  setTheme(settings.theme==="dark"?"light":"dark");
  toast(settings.theme==="dark"?"Dark mode ✓":"Light mode ✓");
}
function examflowSelectOptionByNumber(n){
  if(!questions.length||!document.getElementById("examView")?.classList.contains("active"))return;
  const q=questions[current];
  if(!Array.isArray(q.options)||n<1||n>q.options.length)return;
  if(q.type==="fill_blank"||q.type==="match"||q.type==="drag_drop"||q.type==="ordering")return;
  choose(String.fromCharCode(64+n));
}
function examflowKeyboardHandler(e){
  const key=e.key, shortcutKey=window.KeyboardShortcuts?.optionKey(e)||key, lower=shortcutKey.toLowerCase(), typing=isTypingTarget(e.target);
  if(window.CBQReviewPreview?.handleKey(e))return;
  if(window.Flashcards?.handleKey(e))return;

  if(e.key==="Escape"){
    if(typeof closeImporter==="function")closeImporter();
    if(typeof closeSubmit==="function")closeSubmit();
    if(typeof closeSessions==="function")closeSessions();
    if(typeof closeCBQModal === "function") closeCBQModal();
    const drawer=document.getElementById("examProgressDrawer");
    const paletteWasOpen=drawer?.classList.contains("open");
    if(paletteWasOpen)toggleQuestionProgress();
    else if(document.activeElement) document.activeElement.blur();
    return;
  }

  // Confirm submission from the open dialog without affecting answer checking.
  if(e.key==="Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && document.getElementById("submitModal")?.classList.contains("show")){
    e.preventDefault();
    finishTest();
    return;
  }

  if((e.ctrlKey||e.metaKey)&&e.key==="Enter"&&document.getElementById("planComposer")?.open){
    e.preventDefault();
    savePlan();
    return;
  }

  // Ctrl/Cmd+Enter is the single intentional exception to the browser guard.
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter" && (document.getElementById("importer")?.classList.contains("show") || document.getElementById("homeView")?.classList.contains("active"))){
    e.preventDefault();
    examflowCtrlEnter();
    return;
  }

  // Never capture browser-reserved Ctrl/Cmd shortcuts such as Save or Open.
  if(e.ctrlKey||e.metaKey)return;

  // Never hijack normal text editing.
  if(typing)return;

  // Alt+number navigation stays separate from quiz answer keys and browser tabs.
  if(e.altKey && !e.shiftKey && /^[1-3]$/.test(shortcutKey)){
    e.preventDefault();
    const page=["home","exam","planner"][Number(shortcutKey)-1];
    if(page)showView(page);
    return;
  }
  if(e.altKey && !e.shiftKey && shortcutKey==="4"){e.preventDefault();showView("settings");return}
  if(e.altKey && !e.shiftKey && shortcutKey==="5"){e.preventDefault();showView("flashcards");return}
  if(e.altKey && lower==="m"){e.preventDefault();toggleMobileNav();return}
  if(e.altKey && lower==="i"){e.preventDefault();openImporter();return}
  if(e.altKey && lower==="x"){e.preventDefault();exportData();return}
  if(e.altKey && lower==="f"){
    e.preventDefault();showView("home");
    setTimeout(()=>document.getElementById("studyQuizSearch")?.focus({preventScroll:true}),0);
    return;
  }
  if(e.altKey && lower==="s"){
    if(document.getElementById("examView")?.classList.contains("active")){e.preventDefault();saveSession();toast("Session saved ✓")}
    return;
  }

  if(e.shiftKey && !e.altKey && lower==="l"){e.preventDefault();setTheme("light");return}
  if(e.shiftKey && !e.altKey && lower==="d"){e.preventDefault();setTheme("dark");return}

  const examActive=document.getElementById("examView")?.classList.contains("active");
  if(!typing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&lower==="f"&&examActive){
    e.preventDefault();
    if(mode!=="practice"||!checkedQuestions.has(current))toast("Reveal or verify the answer in Practice before saving a flashcard.");
    else if(questions[current])Flashcards.saveQuestion(questions[current],examName);
    return;
  }
  if(!typing&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&lower==="f"&&document.getElementById("testResultsView")?.classList.contains("active")){
    e.preventDefault();
    const row=e.target.closest?.(".result-question")||document.querySelector("#resultQuestions .result-question.keyboard-current")||document.querySelector("#resultQuestions .result-question.open");
    const index=Number(row?.dataset.questionIndex);
    if(row&&Number.isInteger(index)&&lastResultSnapshot?.questions[index])Flashcards.saveQuestion(lastResultSnapshot.questions[index],lastResultSnapshot.name);
    else toast("Open a result question or select it with the arrow keys, then press F.");
    return;
  }



  if(lower==="k"){e.preventDefault();examflowToggleThemeFast();return}
  if(lower==="h"){e.preventDefault();showView("home");return}
  if(!examActive)return;

  if(e.shiftKey && lower==="p"){e.preventDefault();setMode("practice");return}
  if(e.shiftKey && lower==="e"){e.preventDefault();setMode("exam");return}
  if(e.shiftKey && lower==="g"){e.preventDefault();redirectQuestionToChatGPT();return}
  if(e.shiftKey && lower==="q"){e.preventDefault();toggleQuestionProgress();return}
  if(e.shiftKey && lower==="s"){e.preventDefault();submitExam();return}

  if(lower==="e"){e.preventDefault();setMode("exam");return}
  if(lower==="m"){e.preventDefault();setMode("practice");return}
  if(lower==="g"){e.preventDefault();redirectQuestionToChatGPT();return}

  if(e.key==="ArrowRight" || lower==="n"){
    e.preventDefault();
    nextQuestion();
    return;
  }
  if(e.key==="ArrowLeft" || lower==="b"){
    e.preventDefault();
    previousQuestion();
    return;
  }
  if(e.key==="Enter"){e.preventDefault();checkCurrentAnswer();return}
  if(lower==="v" && mode==="practice"){e.preventDefault();viewPracticeAnswer();return}
  if(lower==="p"){e.preventDefault();toggleQuestionProgress();return}
  if(lower==="r"){e.preventDefault();toggleReview();return}
  if(lower==="c"){e.preventDefault();copyCurrentQuestion();return}
  if(e.key==="Delete" || e.key==="Backspace"){e.preventDefault();clearAnswer();return}
  if(/^[1-4]$/.test(e.key)){e.preventDefault();examflowSelectOptionByNumber(Number(e.key));return}
}

/* Single keyboard router: all app shortcuts live here. */
document.addEventListener("keydown",examflowKeyboardHandler,true);


/* Lightweight click pulse: visual confirmation for every interactive button */
document.addEventListener("pointerdown",e=>{
  const b=e.target.closest("button,.btn,.modebtn,.preset-btn,.bookmark,.qbtn");
  if(!b||b.disabled)return;
  if(b.id!=="soundOffBtn")playButtonSound();
  b.classList.remove("click-pulse");
  void b.offsetWidth;
  b.classList.add("click-pulse");
  setTimeout(()=>b.classList.remove("click-pulse"),180);
});

function copyBeginnerSchema(override){
  const source=document.getElementById("beginnerSchema");
  if(!source)return;
  const schema=source.value||source.textContent||"";
  const fallbackText=`Create a Concept Breakdown Quiz (CBQ) about: [TOPIC]

What a CBQ means:
A CBQ breaks one difficult topic into a sequence of small, connected questions. Each question should build the reasoning needed for the next step, moving from core ideas to application and finally to a clear solution. Do not make a list of unrelated recall questions.

Your task:
- Replace [TOPIC] with the topic or source material I provide.
- Create a coherent quiz that tests understanding and step-by-step reasoning.
- Include useful explanations for every question.
- Add an optional short hint to guide the learner without revealing the answer.
- Use the question types that best fit the topic: mcq, true_false, fill_blank, match, drag_drop, ordering, or image_choice.
- Give every question a correct answer and marks. Use negativeMarks only when appropriate.
- Keep all question and answer text inside the JSON values.

Math and LaTeX:
- Use inline LaTeX such as $E=mc^2$ inside JSON strings when helpful.
- Use display LaTeX such as $$\\int_0^1 x^2 dx$$ when a separate equation is needed.
- ExamFlow renders this math with KaTeX, so keep LaTeX valid and do not use HTML for equations.
- Escape backslashes correctly for JSON strings.

Images:
- For image questions, use a publicly accessible HTTPS image URL in the "image" field.
- Do not use a local computer path. Example: "image": "https://your-site.example/diagram.png".

Output rules:
- Return only valid JSON. Do not return Markdown fences, commentary, or headings outside the JSON.
- Follow the complete ExamFlow schema below.
- Make the JSON directly usable by pasting it into ExamFlow's CBQ loader.

ExamFlow CBQ schema:
${schema}`;
  const promptText=typeof getPromptText==="function"?getPromptText("cbq"):"";
  const text=typeof override==="string"?override:promptText||fallbackText;
  const done=()=>toast(typeof override==="string"?"Prompt copied ✓":promptText?"CBQ prompt copied ✓":"AI CBQ prompt and schema copied ✓");
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>{
      const ta=document.createElement("textarea");
      ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand("copy");done()}catch(e){toast("Copy failed")}
      ta.remove();
    });
  }else{
    const ta=document.createElement("textarea");
    ta.value=text;document.body.appendChild(ta);ta.select();
    try{document.execCommand("copy");done()}catch(e){toast("Copy failed")}
    ta.remove();
  }
}

function render(){
 updateModeUI();
 if(!questions.length){
   document.getElementById("currentLabel").textContent="0";document.getElementById("totalLabel").textContent="0";
   setQuizRichText(document.getElementById("questionText"),"Paste a quiz JSON to start.");
   const hintCard=document.getElementById("hintCard");if(hintCard)hintCard.hidden=true;
   document.getElementById("options").innerHTML="";document.getElementById("qgrid").innerHTML="";
   document.getElementById("examProgressGrid").innerHTML="";
   document.getElementById("feedback").textContent="";document.getElementById("explanation").style.display="none";
   document.getElementById("progressText").textContent="0 / 0";document.getElementById("progressBar").style.width="0%";
   ["copyQuestionBtn","deleteQuestionBtn","clearAnswerBtn","viewAnswerBtn","prevBtn","nextBtn","bookmark"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true});
   return;
 }
 const q=questions[current],count=answers.reduce((total,answer,index)=>total+(answerIsPresent(answer,questions[index])?1:0),0);
 const apExisting=document.getElementById("practiceAnswerPanel");
 if(apExisting && apExisting.dataset.question!==String(current))apExisting.remove();
 document.getElementById("currentLabel").textContent=current+1;document.getElementById("totalLabel").textContent=questions.length;
 setQuizRichText(document.getElementById("questionText"),q.text||"");
 const hintCard=document.getElementById("hintCard"),hintText=document.getElementById("hintText"),hintToggle=document.getElementById("hintToggle");
 const hasHint=String(q.hint||"").trim()!=="";
 if(hintCard&&hintText&&hintToggle){
   hintCard.hidden=!hasHint;
   hintText.hidden=true;
   hintToggle.setAttribute("aria-expanded","false");
   hintToggle.textContent="💡 Show hint";
   if(hasHint)setQuizRichText(hintText,q.hint);
 }
 renderQuestionImage(q);
 const opts=document.getElementById("options");opts.innerHTML="";
 renderSpecialQuestion(q,opts);
 renderMath();
 renderAllQuizMath(document.getElementById("examView"));
 renderAllQuizMath(opts);
 const fb=document.getElementById("feedback");
 const ex=document.getElementById("explanation");
 const ap=document.getElementById("practiceAnswerPanel");
 if(ap && !checkedQuestions.has(current))ap.style.display="none";
 fb.removeAttribute("data-result");
 if(mode==="practice"&&checkedQuestions.has(current)){
   const hasAnswer=answerIsPresent(answers[current],q),correct=hasAnswer&&isQuestionCorrect(q,answers[current]);
   fb.textContent=hasAnswer?(correct?"✓ Correct":"✕ Incorrect — check the answer below"):"";
   if(hasAnswer)fb.dataset.result=correct?"correct":"wrong";
   else fb.removeAttribute("data-result");
   showPracticeAnswerPanel(q);
   highlightCorrectAnswerForView(q);
   if(q.explanation){ex.style.display="block";setQuizExplanation(ex,q.explanation)}else ex.style.display="none";
 }else{fb.textContent="";ex.style.display="none";}
 const bookmark=document.getElementById("bookmark");
 bookmark.textContent=reviews.has(current)?"★ Marked":"☆ Review";bookmark.classList.toggle("saved",reviews.has(current));
 document.getElementById("prevBtn").disabled=current===0;document.getElementById("nextBtn").textContent=current===questions.length-1?"Finish":"Next →";
 document.getElementById("answeredCount").textContent=count;document.getElementById("reviewCount").textContent=reviews.size;
 document.getElementById("progressText").textContent=`${count} / ${questions.length}`;document.getElementById("progressBar").style.width=(count/questions.length*100)+"%";
 renderQuestionNavigation(document.getElementById("qgrid"),"qbtn",jumpToQuestion);
 document.getElementById("options").querySelectorAll("button,input,select").forEach(el=>el.disabled=examFinished);
 ["prevBtn","viewAnswerBtn","nextBtn","bookmark","copyQuestionBtn","clearAnswerBtn","deleteQuestionBtn"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=examFinished});
 const questionOptions=document.querySelector("#examView .question-options");
 if(questionOptions){questionOptions.inert=examFinished;questionOptions.querySelector("summary").setAttribute("aria-disabled",String(examFinished))}
 document.getElementById("questionText").classList.toggle("exam-finished",examFinished);
 if(document.getElementById("examProgressDrawer")?.classList.contains("open"))renderQuestionProgress();
}
function renderQuestionNavigation(container,buttonClass,onSelect){
 if(!container)return;
 container.innerHTML="";
 getQuestionSectionGroups().forEach(group=>{
   const section=document.createElement("section");section.className="question-palette-section";
   const heading=document.createElement("div");heading.className="question-palette-section-heading";
   const title=document.createElement("strong");title.textContent=group.name;
   const sectionCount=document.createElement("small");sectionCount.textContent=`${group.indices.length} question${group.indices.length===1?"":"s"}`;
   heading.append(title,sectionCount);
   const grid=document.createElement("div");grid.className="question-palette-section-grid";
   group.indices.forEach(index=>{
     const isAnswered=answerIsPresent(answers[index],questions[index]),isCurrent=index===current,isReview=reviews.has(index);
     const button=document.createElement("button");
     button.className=buttonClass+(isCurrent?" current":"")+(isAnswered?" answered":"")+(isReview?" review":"");
     button.textContent=String(index+1);
     button.setAttribute("aria-label",`Question ${index+1}, ${group.name}, ${isCurrent?"current, ":""}${isAnswered?"answered":"unanswered"}${isReview?", marked for review":""}`);
     button.title=`Question ${index+1} · ${group.name}`;
     button.addEventListener("click",()=>onSelect(index));
     grid.appendChild(button);
   });
   section.append(heading,grid);container.appendChild(section);
 });
}
function getQuestionSectionGroups(){
 const groups=new Map();
 questions.forEach((question,index)=>{
   const name=String(question.section||"General").trim()||"General";
   if(!groups.has(name))groups.set(name,[]);
   groups.get(name).push(index);
 });
 const order=(Array.isArray(sections)?sections:[])
   .map(section=>String(section.name||"General").trim()||"General")
   .filter((name,index,names)=>names.indexOf(name)===index);
 return [...groups.entries()].map(([name,indices],index)=>({name,indices,index}))
   .sort((a,b)=>{
     const aOrder=order.indexOf(a.name),bOrder=order.indexOf(b.name);
     if(aOrder<0&&bOrder<0)return a.index-b.index;
     if(aOrder<0)return 1;
     if(bOrder<0)return -1;
     return aOrder-bOrder;
   });
}
function currentQuestionCopyText(q){
 const lines=[`Question: ${q.text||""}`];
 if(q.type)lines.push(`Type: ${q.type}`);
 if(q.type==="ordering"&&Array.isArray(q.options))lines.push(`Items:\n${q.options.map((item,index)=>`${index+1}. ${item}`).join("\n")}`);
 else if(Array.isArray(q.options)&&q.options.length)lines.push(`Options:\n${q.options.map((option,index)=>`${String.fromCharCode(65+index)}. ${option}`).join("\n")}`);
 if(Array.isArray(q.pairs)&&q.pairs.length)lines.push(`Pairs:\n${q.pairs.map(pair=>`${pair.left} → ${pair.right}`).join("\n")}`);
 if(q.answer!==undefined){
   let answer=q.answer;
   if(q.type==="mcq"||q.type==="true_false"||q.type==="image"||q.type==="image_choice"){
     const index=typeof q.answer==="number"?q.answer:(/^[A-Z]$/i.test(String(q.answer))?String(q.answer).toUpperCase().charCodeAt(0)-65:-1);
     if(index>=0&&q.options[index]!==undefined)answer=`${String.fromCharCode(65+index)}. ${q.options[index]}`;
   }
   lines.push(`Answer: ${Array.isArray(answer)?answer.join(" → "):answer}`);
 }
 if(Array.isArray(q.acceptedAnswers)&&q.acceptedAnswers.length)lines.push(`Accepted answers:\n${q.acceptedAnswers.join("\n")}`);
 if(q.hint)lines.push(`Hint:\n${q.hint}`);
 if(q.explanation)lines.push(`Explanation:\n${q.explanation}`);
 if(q.image)lines.push(`Image: ${q.image}`);
 return lines.join("\n\n");
}
function copyCurrentQuestion(){
 const q=questions[current];
 if(!q){toast("No question loaded");return}
 const text=currentQuestionCopyText(q),done=()=>toast("Question copied ✓");
 const fallback=()=>{
   const input=document.createElement("textarea");
   input.value=text;input.setAttribute("readonly","");input.style.position="fixed";input.style.opacity="0";
   document.body.appendChild(input);input.select();
   const copied=document.execCommand("copy");
   input.remove();
   if(copied)done();else toast("Copy failed");
 };
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(done).catch(fallback);
 else fallback();
}
function showPracticeAnswerPanel(q){
 let panel=document.getElementById("practiceAnswerPanel");
 if(!panel){
   panel=document.createElement("div");panel.id="practiceAnswerPanel";panel.className="practice-answer-panel";
   document.getElementById("explanation").before(panel);
 }
 panel.dataset.question=String(current);
 panel.innerHTML=`<div class="answer-label">Correct answer <button type="button" class="btn save-flashcard" title="Save this question as a flashcard (F)" onclick="event.stopPropagation();Flashcards.saveQuestion(questions[current],examName)">Save flashcard <kbd>F</kbd></button></div><div class="answer-value quiz-rich-text">${practiceCorrectAnswerHTML(q)}</div>`;
 panel.style.display="block";renderAllQuizMath(panel);
}
function deleteCurrentQuestion(){
 if(!questions.length||examFinished)return;
 const index=current;
 document.querySelector("#examView .question-options")?.removeAttribute("open");
 if(!confirm(questions.length===1?"Delete the last question and remove this saved session?":"Delete this question? Other answers will be kept."))return;
 clearTimeout(saveTimer);
 const remap=set=>new Set([...set].filter(value=>value!==index).map(value=>value>index?value-1:value));
 const previousExamId=examId;
 if(sessionId)PlanReviewQueue.removeQuestion(sessionId,index);
 questions.splice(index,1);answers.splice(index,1);
 reviews=remap(reviews);checkedQuestions=remap(checkedQuestions);
 matchOrders=Object.fromEntries(Object.entries(matchOrders).filter(([key])=>Number(key)!==index).map(([key,value])=>[Number(key)>index?Number(key)-1:Number(key),value]));
 sections=sections.filter(section=>questions.some(question=>question.section===String(section.name||"General")));
 current=Math.max(0,Math.min(index,questions.length-1));
 document.getElementById("practiceAnswerPanel")?.remove();
 if(!questions.length){
   put(K.sessions,get(K.sessions,[]).filter(session=>session.id!==sessionId));
   if(!get(K.sessions,[]).some(session=>session.examId===previousExamId)){
     put(K.exams,get(K.exams,[]).filter(exam=>exam.id!==previousExamId));
     put(K.recent,get(K.recent,[]).filter(exam=>exam.id!==previousExamId));
   }
   sessionId=null;examId=null;examName="No quiz loaded";
   answers=[];reviews=new Set();checkedQuestions=new Set();matchOrders={};sections=[];
   timerState.running=false;seconds=(settings.defaultDuration||5)*60;timerState.examSeconds=seconds;
   document.getElementById("examProgressGrid").innerHTML="";updateTimerUI();
 }else{
   registerActiveExam();saveSession();
 }
 syncExamTitleBar();render();renderSessions();renderHome();
 toast(questions.length?"Question deleted · progress saved":"Last question deleted");
}
function toggleHint(){
 const hintText=document.getElementById("hintText"),hintToggle=document.getElementById("hintToggle");
 if(!hintText||!hintToggle)return;
 const open=hintText.hidden;
 hintText.hidden=!open;hintToggle.setAttribute("aria-expanded",String(open));
 hintToggle.textContent=open?"💡 Hide hint":"💡 Show hint";
 if(open)renderAllQuizMath(hintText);
}
function choose(letter){if(examFinished)return;answers[current]=letter;checkedQuestions.delete(current);render();renderQuestionProgress();saveSessionSoon()}
function clearAnswer(){if(examFinished)return;answers[current]=null;checkedQuestions.delete(current);render();renderQuestionProgress();saveSessionSoon()}
function toggleReview(){if(examFinished)return;reviews.has(current)?reviews.delete(current):reviews.add(current);render();renderQuestionProgress();saveSessionSoon()}
function nextQuestion(){if(current<questions.length-1){current++;render();if(!examFinished)saveSessionSoon()}else if(!examFinished)submitExam()}
function previousQuestion(){if(current>0){current--;render();if(!examFinished)saveSessionSoon()}}
function submitExam(){
 if(examFinished)return;
 if(!questions.length){toast("Load a quiz first");return}
 const unanswered=questions.reduce((count,question,index)=>count+(answerIsPresent(answers[index],question)?0:1),0);
 document.getElementById("submitText").textContent=unanswered?`You have ${unanswered} unanswered question${unanswered>1?"s":""}. Submit anyway?`:"All questions are answered. Submit and save your result?";
 document.getElementById("submitModal").classList.add("show")
}
function closeSubmit(){document.getElementById("submitModal").classList.remove("show")}
function finishTest(automatic=false){
 if(examFinished)return;
 examFinished=true;timerState.running=false;closeSubmit();render();
 const r=saveResult();saveSession();openDetailedResults(r);toast(automatic?"Time is up. Exam submitted.":`Result saved · ${r.percent}% ✓`)
}

function saveSession(){
 if(!questions.length)return;
 const sessions=get(K.sessions,[]),now=new Date().toISOString(),sid=sessionId||id();sessionId=sid;
 const item={id:sid,examId:examId||sid,name:examName,questions,answers,reviews:[...reviews],checkedQuestions:[...checkedQuestions],matchOrders,current,seconds,quizDurationMinutes,mode,sections,examFinished,examTimerSeconds:timerState.examSeconds,practiceTimerSeconds:timerState.practiceSeconds,practiceTimerRunning:timerState.running,updatedAt:now};
 const old=sessions.find(x=>x.id===sid);if(old)Object.assign(old,item);else sessions.unshift(item);
 put(K.sessions,sessions);recordStudyActivity(item);renderSessions()
 PlanReviewQueue.render();
}
let saveTimer;function saveSessionSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(saveSession,120)}
function renderSessions(){
 const el=document.getElementById("sessionList"),ss=get(K.sessions,[]);
 el.innerHTML=ss.length?ss.slice(0,20).map(s=>`<div class="session-item"><button class="session-load" onclick="restoreSession('${s.id}')" title="${esc(s.name)}">${esc(s.name)} · ${getSessionAnsweredCount(s)}/${s.questions.length}</button><button class="session-delete" onclick="deleteSession('${s.id}')">×</button></div>`).join(""):'<div class="empty">No saved sessions.</div>';
}
function restoreSession(sid){
 const s=get(K.sessions,[]).find(x=>x.id===sid);if(!s)return;
 sessionId=s.id;examId=s.examId||s.id;examName=s.name;questions=s.questions;answers=s.answers||Array(questions.length).fill(null);reviews=new Set(s.reviews||[]);checkedQuestions=new Set(s.checkedQuestions||[]);matchOrders=s.matchOrders||{};current=Math.min(s.current||0,questions.length-1);seconds=s.seconds===0?0:Math.min(10*60,Math.max(1,s.seconds||5*60));quizDurationMinutes=Math.min(10,Math.max(1,s.quizDurationMinutes||Math.ceil(Math.max(seconds,1)/60)));timerState.examSeconds=Number.isFinite(s.examTimerSeconds)?s.examTimerSeconds:seconds;timerState.practiceSeconds=s.practiceTimerSeconds||5*60;timerState.running=!!s.practiceTimerRunning;examFinished=!!s.examFinished;mode=s.mode||settings.defaultMode;sections=s.sections||[];registerActiveExam();
 if(document.getElementById("examTitle"))document.getElementById("examTitle").textContent=examName;document.getElementById("headerQuizName").textContent=examName;showView("exam");render();toast("Session restored ✓")
}
function deleteSession(sid){
 put(K.sessions,get(K.sessions,[]).filter(x=>x.id!==sid));
 put(K.study,get(K.study,[]).filter(item=>item.sessionId!==sid));
 const receipts=get(K.reviewQueue,{});
 delete receipts["session:"+sid];
 put(K.reviewQueue,receipts);
 renderSessions();renderDashboard();renderHome();
 PlanReviewQueue.render();
}
function savedQuizGroup(kind,sourceId){
 const key={session:K.sessions,result:K.results,quiz:K.exams}[kind];
 const source=key&&get(key,[]).find(item=>item.id===sourceId);
 if(!source)return null;
 const quizId=source.examId||source.id;
 const matches=item=>item.examId===quizId||item.id===quizId;
 const sessions=get(K.sessions,[]).filter(item=>matches(item)||kind==="session"&&item.id===sourceId);
 const results=get(K.results,[]).filter(item=>matches(item)||kind==="result"&&item.id===sourceId);
 return {source,quizId,sessionIds:new Set(sessions.map(item=>item.id)),resultIds:new Set(results.map(item=>item.id))};
}
function downloadSavedQuiz(kind,sourceId){
 const group=savedQuizGroup(kind,sourceId);if(!group){toast("This saved quiz is no longer available.");return}
 const exam=getExamRecord(group.quizId),source=group.source;
 let questions=Array.isArray(source.questions)?source.questions:exam?.questions;
 if(!Array.isArray(questions)&&kind==="result")questions=hydrateResult(source).questions;
 if(!Array.isArray(questions)){toast("The saved quiz questions are unavailable.");return}
 const quiz={
  name:source.name||exam?.name||"Untitled quiz",
  durationMinutes:Number(source.durationMinutes||exam?.durationMinutes||settings.defaultDuration)||5,
  sections:cloneData(source.sections||exam?.sections||[]),
  questions:cloneData(questions).map(({selected,...question})=>question)
 };
 const link=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(quiz,null,2)],{type:"application/json"}));
 const filename=quiz.name.replace(/[<>:"/\\|?*\x00-\x1f]/g,"-").trim()||"quiz";
 link.href=url;link.download=`${filename}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renameSavedQuiz(kind,sourceId){
 const group=savedQuizGroup(kind,sourceId);if(!group){toast("This saved quiz is no longer available.");return}
 const entered=prompt("Edit saved quiz title",group.source.name||"Untitled quiz");if(entered===null)return;
 const name=entered.trim();
 if(!name){toast("Enter a quiz title.");return}
 if(name.length>160){toast("Keep the title under 160 characters.");return}
 if(name===group.source.name)return;
 const {quizId,sessionIds,resultIds}=group;
 put(K.sessions,get(K.sessions,[]).map(item=>sessionIds.has(item.id)?{...item,name}:item));
 put(K.results,get(K.results,[]).map(item=>resultIds.has(item.id)?{...item,name}:item));
 for(const key of [K.exams,K.recent])put(key,get(key,[]).map(item=>item.id===quizId?{...item,name}:item));
 if(examId===quizId||sessionIds.has(sessionId)){
  examName=name;syncExamTitleBar();
  const title=document.getElementById("examTitle");if(title)title.textContent=name;
 }
 renderSessions();renderDashboard();renderHome();toast("Quiz title updated");
}
function deleteSavedQuiz(kind,sourceId){
 const group=savedQuizGroup(kind,sourceId);if(!group){toast("This saved quiz is no longer available.");return}
 if(!confirm(`Delete "${group.source.name||"Untitled quiz"}"?\n\nThis removes its saved quiz, sessions, results, recent history and study activity.`))return;
 const {quizId,sessionIds,resultIds}=group;
 if(examId===quizId||sessionIds.has(sessionId)){
  clearTimeout(saveTimer);timerState.running=false;timerState.examSeconds=0;
  questions=[];answers=[];reviews=new Set();checkedQuestions=new Set();matchOrders={};sections=[];current=0;sessionId=null;examId=null;examFinished=false;examName="No quiz loaded";
  setQuestionSidebarState(false);syncQuestionSidebar(false);
  document.getElementById("practiceAnswerPanel")?.remove();
  const title=document.getElementById("examTitle");if(title)title.textContent=examName;
  syncExamTitleBar();updateTimerUI();render();
 }
 put(K.sessions,get(K.sessions,[]).filter(item=>!sessionIds.has(item.id)));
 put(K.results,get(K.results,[]).filter(item=>!resultIds.has(item.id)));
 put(K.study,get(K.study,[]).filter(item=>item.examId!==quizId&&!sessionIds.has(item.sessionId)&&!resultIds.has(item.resultId)));
 const receipts=get(K.reviewQueue,{});
 for(const sid of sessionIds)delete receipts["session:"+sid];
 for(const rid of resultIds)delete receipts["result:"+rid];
 put(K.reviewQueue,receipts);
 for(const key of [K.exams,K.recent])put(key,get(key,[]).filter(item=>item.id!==quizId));
 renderSessions();renderDashboard();renderHome();PlanReviewQueue.render();
 if(!questions.length)showView("home");
 toast("Saved quiz deleted");
}


async function redirectQuestionToChatGPT(){
 const q=questions[current];if(!q){toast("No question loaded");return}
 const question=q.text||"";
 let source=`Question: ${question}`;
 if(Array.isArray(q.options)&&q.options.length)
   source+=`\nOptions: ${q.options.map((x,i)=>`${String.fromCharCode(65+i)}. ${x}`).join(" | ")}`;
 if(q.answer!==undefined)source+=`\nAnswer: ${typeof q.answer==="string"?q.answer:JSON.stringify(q.answer)}`;
 if(q.hint)source+=`\nHint: ${q.hint}`;
 if(q.explanation)source+=`\nExplanation: ${q.explanation}`;
 if(Array.isArray(q.pairs)&&q.pairs.length)
   source+=`\nPairs: ${q.pairs.map(p=>`${p.left} → ${p.right}`).join(" | ")}`;

 const fallbackPrompt=`Create a Concept Breakdown Quiz (CBQ) for the question below.

WHAT IS A CBQ:
A CBQ is a sequence of step-by-step questions that breaks the original problem into smaller conceptual reasoning steps. It should guide the learner from basic understanding toward the original question, rather than simply asking recall questions or giving the answer. Create exactly 5 progressively deeper CBQs that help the learner understand and solve the original question.

REQUIREMENTS:
- Create exactly 5 CBQ questions.
- Make them progressively more challenging.
- Follow the reasoning path needed to solve the original question.
- Do not simply repeat the original question.
- Each CBQ should help establish a concept or reasoning step needed for the next one.
- Use the same subject terminology as the original question.
- Include explanations for each CBQ.
- Use exactly 2 options for MCQs by default.
- Put mathematical expressions in $...$ or $$...$$.
- Return ONLY a JSON codeblock. Do not return prose outside the codeblock.
- The JSON must be valid JSON.

USE THIS CBQ JSON SCHEMA:
{
  "name": "CBQ — <topic>",
  "sections": [
    {
      "name": "Concept Breakdown",
      "timeMinutes": 10,
      "marks": 1,
      "negativeMarks": 0,
      "questions": [
        {
          "type": "mcq",
          "question": "Question text or $LaTeX$",
          "options": ["Option A", "Option B"],
          "answer": "A",
          "explanation": "Explanation with $LaTeX$ where needed."
        }
      ]
    }
  ]
}

SUPPORTED QUESTION TYPES:
- mcq: question, options, answer, optional explanation
- true_false: question, answer (True or False), optional explanation
- fill_blank: question, acceptedAnswers, optional explanation
- match: question, pairs, optional explanation
- drag_drop: question, pairs, optional explanation
- ordering: question, items, answer, optional explanation
- image: question, image (prefer a publicly accessible HTTPS URL), options, answer, optional explanation
- image_choice: question, image, options, answer, optional explanation

ALIASES MAY INCLUDE:
text, choices, correct, points, negative, duration, category, topic, reason, solution, rationale, hint.

Generate the CBQ from this original question:

${source}`;
 const payloadTemplate=typeof getPromptText==="function"?getPromptText("payload"):"";
 const prompt=payloadTemplate?payloadTemplate.replace(/\{\{question\}\}/g,source):fallbackPrompt;

 const url="https://chatgpt.com/?q="+encodeURIComponent(prompt);
 const w=window.open(url,"_blank");
 if(!w)toast("Allow pop-ups to open ChatGPT");
}
function showGeneratedCBQs(cbqs){
 window.__generatedCBQs=cbqs;
 let modal=document.getElementById("cbqModal");
 if(!modal){modal=document.createElement("div");modal.id="cbqModal";modal.className="cbq-modal";document.body.appendChild(modal)}
 modal.innerHTML=`<div class="cbq-modal-card"><div class="cbq-modal-head"><div><div class="cbq-kicker">🧠 CONCEPT REPAIR</div><h2>5 CBQs for this question</h2></div><button class="btn" onclick="closeCBQModal()">✕</button></div><div class="cbq-original">${esc(questions[current].text||"")}</div><div class="cbq-list">${cbqs.map((q,i)=>`<article class="generated-cbq"><div class="cbq-number">CBQ ${i+1}</div><div class="cbq-question">${esc(q.question||"")}</div><div class="cbq-options">${(q.options||[]).map((o,j)=>`<button class="cbq-option" onclick="answerGeneratedCBQ(this,${i},'${String.fromCharCode(65+j)}')"><span>${String.fromCharCode(65+j)}</span>${esc(o)}</button>`).join("")}</div><div class="cbq-feedback"></div><div class="cbq-explanation" style="display:none">${esc(q.explanation||"")}</div></article>`).join("")}</div><div class="cbq-modal-foot"><span>Work through all five, then return to the original question.</span><button class="btn primary" onclick="closeCBQModal()">↩ Reattempt Original</button></div></div>`;
 modal.style.display="flex";
 renderAllQuizMath(modal);
 modal.querySelectorAll(".cbq-question,.cbq-option,.cbq-explanation,.cbq-original").forEach(el=>renderAllQuizMath(el));
}
function answerGeneratedCBQ(btn,i,choice){
 const card=btn.closest(".generated-cbq"),q=window.__generatedCBQs?.[i];if(!q)return;
 card.querySelectorAll(".cbq-option").forEach(x=>x.disabled=true);
 const correct=String(q.answer).toUpperCase()===choice;btn.classList.add(correct?"correct":"wrong");
 const fb=card.querySelector(".cbq-feedback");fb.innerHTML=correct?"✓ Correct — continue to the next step.":"✕ Not quite. Review the explanation and continue.";fb.className="cbq-feedback "+(correct?"good":"bad");
 const ex=card.querySelector(".cbq-explanation");ex.style.display="block";renderAllQuizMath(ex);
}
function closeCBQModal(){const m=document.getElementById("cbqModal");if(m)m.remove();window.__generatedCBQs=null}



let lastResultSnapshot=null,resultFilter="all",lastTestStartedAt=0;

function hydrateResult(saved){
  const result={...saved};
  let source=Array.isArray(saved.questions)?saved.questions:null;
  if(!source&&saved.examId)source=getExamRecord(saved.examId)?.questions||null;
  if(!source&&saved.examId){
    const session=get(K.sessions,[]).find(x=>x.examId===saved.examId);
    source=session?.questions||null;
  }
  source=Array.isArray(source)?cloneData(source):[];
  const savedAnswers=Array.isArray(saved.answers)?saved.answers:[];
  result.questions=source.map((q,i)=>({...q,selected:savedAnswers[i]!==undefined?savedAnswers[i]:(q.selected??null)}));
  return result;
}

function openSavedResult(resultId){
  const saved=get(K.results,[]).find(x=>x.id===resultId);if(!saved)return;
  openDetailedResults(saved);
}

function openDetailedResults(result){
 result=hydrateResult(result);
 lastResultSnapshot=result;
 document.getElementById("resultSubtitle").textContent=`${result.name} · ${result.mode==="practice"?"Practice Mode":"Exam Mode"}`;
 document.getElementById("resultScore").textContent=Number(result.score).toFixed(result.score%1?1:0);
 document.getElementById("resultMax").textContent="/"+Number(result.max).toFixed(result.max%1?1:0);
 document.getElementById("resultPercent").textContent=result.percent.toFixed(1)+"%";
 document.getElementById("resultAttempted").textContent=result.correct+result.wrong;
 document.getElementById("resultCorrect").textContent=result.correct;
 document.getElementById("resultWrong").textContent=result.wrong;
 document.getElementById("resultSkipped").textContent=result.unanswered;
 const status=document.getElementById("resultStatus");
 const label=result.percent>=80?"🏆 Excellent":result.percent>=60?"✨ Good Progress":"💪 Needs Improvement";
 status.textContent=label;status.className="result-status"+(result.percent>=80?" good":"");
 document.getElementById("resultProgressBar").style.width=Math.min(100,Math.max(0,result.percent))+"%";
 document.getElementById("resultTime").textContent=`◷ Time taken: ${result.timeTaken||0}s`;
 renderResultSections(result);
 renderResultQuestions();
 const reviewActions=document.getElementById("resultFlashcardReview");
 if(reviewActions)reviewActions.innerHTML=CBQReviewPreview.controls(result,"result");
 const advice=result.percent>=80
   ?"Your fundamentals are working well. Focus on speed, edge cases and maintaining consistency."
   :result.percent>=60
   ?"You have a usable foundation. Review the questions you missed and convert each mistake into a small CBQ."
   :"Go back to concept breakdown. Practice the reasoning steps before attempting another timed test.";
 document.getElementById("resultInsight").textContent=advice;
 document.getElementById("resultNextStep").textContent=result.unanswered
   ?`You left ${result.unanswered} question${result.unanswered>1?"s":""} unanswered. Try completing every question in Practice Mode before the next timed attempt.`
   :"Retake this quiz after reviewing the explanations, then compare your score and accuracy.";
 showView("testResults");
}
function renderResultSections(result){
 const map={};
 result.questions.forEach(q=>{
   const s=q.section||"General";
   if(!map[s])map[s]={total:0,correct:0,wrong:0,skipped:0,marks:0,score:0};
   const x=map[s],selected=q.selected;
   x.total++;x.marks+=Number(q.marks||1);
   if(!answerIsPresent(selected,q))x.skipped++;
   else if(isQuestionCorrect(q,selected)){x.correct++;x.score+=Number(q.marks||1)}
   else{x.wrong++;x.score-=Number(q.negativeMarks||0)}
 });
 const el=document.getElementById("sectionPerformance");
 el.innerHTML=Object.entries(map).map(([name,x])=>{
   const pct=Math.max(0,Math.round(x.score/Math.max(x.marks,1)*100));
   return `<div style="margin-bottom:17px">
     <div class="perf-head"><div class="perf-title">${esc(name)}</div><div class="perf-score">+${x.correct} correct · ${x.wrong} wrong</div></div>
     <div class="perf-meta">Attempted: ${x.correct+x.wrong}/${x.total} · Accuracy: ${x.correct?Math.round(x.correct/Math.max(x.correct+x.wrong,1)*100):0}%</div>
     <div class="perf-bar ${pct>=60?"good":""}"><i style="width:${Math.min(100,pct)}%"></i></div>
     <div style="text-align:right;font-size:9px;color:var(--muted);margin-top:3px">${x.score.toFixed(x.score%1?1:0)}/${x.marks.toFixed(x.marks%1?1:0)}</div>
   </div>`;
 }).join("");
}

function setResultFilter(f){
 resultFilter=f;
 document.querySelectorAll(".filter-btn").forEach(b=>b.classList.toggle("active",b.dataset.filter===f));
 renderResultQuestions();
}
function moveResultQuestion(direction){
 const items=[...document.querySelectorAll("#resultQuestions .result-question")];
 if(!items.length)return;
 const active=document.querySelector("#resultQuestions .result-question.keyboard-current");
 let index=active?items.indexOf(active):(direction>0?-1:items.length);
 index=Math.max(0,Math.min(items.length-1,index+direction));
 items.forEach(item=>item.classList.remove("keyboard-current"));
 const target=items[index];
 target.classList.add("keyboard-current");
 target.scrollIntoView({behavior:"smooth",block:"center"});
}
function resultValueText(q,value){
 if(value==null)return "Not answered";
 if(q.type==="fill_blank")return String(value);
 if(q.type==="match"||q.type==="drag_drop"){
   const vals=Array.isArray(value)?value:[];
   return q.pairs.map((p,i)=>`${esc(p.left)} → ${esc(vals[i]??"")}`).join("<br>");
 }
 if(q.type==="ordering"){
   const vals=Array.isArray(value)?value:[];
   return vals.map((v,i)=>`${i+1}. ${esc(v)}`).join("<br>");
 }
 if(q.type==="image_choice"||q.type==="image"||q.type==="mcq"||q.type==="true_false"){
   const letter=String(value);
   if(/^[A-Z]$/.test(letter)){
     const idx=letter.charCodeAt(0)-65;
     return `${letter}. ${esc(q.options?.[idx]??"")}`;
   }
 }
 return esc(String(value));
}
function correctValueText(q){
 if(q.type==="fill_blank")return (q.acceptedAnswers||[q.answer]).map(esc).join(" / ");
 if(q.type==="match"||q.type==="drag_drop"){
   return q.pairs.map(p=>`${esc(p.left)} → ${esc(p.right)}`).join("<br>");
 }
 if(q.type==="ordering")return q.answer.map((v,i)=>`${i+1}. ${esc(v)}`).join("<br>");
 return resultValueText(q,q.answer);
}
function optionsHtml(q){
 if(q.type==="match"||q.type==="drag_drop"){
   return q.pairs.map(p=>`<div>${esc(p.left)} → ${esc(p.right)}</div>`).join("");
 }
 if(q.type==="ordering"){
   return q.options.map((o,i)=>`${i+1}. ${esc(o)}`).join("<br>");
 }
 if(q.type==="fill_blank")return `<div>Accepted: ${correctValueText(q)}</div>`;
 return (q.options||[]).map((o,i)=>`${String.fromCharCode(65+i)}. ${esc(o)}`).join("<br>");
}
function renderResultQuestions(){
 if(!lastResultSnapshot)return;
 const result=lastResultSnapshot,select=document.getElementById("resultSectionFilter");
 const names=[...new Set(result.questions.map(q=>q.section||"General"))];
 const current=select.value;
 select.innerHTML='<option>All Sections</option>'+names.map(n=>`<option>${esc(n)}</option>`).join("");
 if(names.includes(current))select.value=current;
 const section=select.value;
 const qs=result.questions.map((q,i)=>({...q,index:i})).filter(q=>{
   const selected=q.selected;
   const status=!answerIsPresent(selected,q)?"skipped":isQuestionCorrect(q,selected)?"correct":"wrong";
   return (resultFilter==="all"||status===resultFilter)&&(section==="All Sections"||q.section===section);
 });
 document.getElementById("reviewShown").textContent=`(${qs.length} shown)`;
 const el=document.getElementById("resultQuestions");
 el.innerHTML=qs.length?qs.map(q=>{
   const status=!answerIsPresent(q.selected,q)?"skip":isQuestionCorrect(q,q.selected)?"correct":"wrong";
   const selected=resultValueText(q,q.selected);
   const correct=correctValueText(q);
   return `<div class="result-question ${status}" data-question-index="${q.index}" onclick="this.classList.toggle('open')">
     <div class="result-qno">${q.index+1}</div>
     <div>
       <div class="result-qmeta">SECTION ${esc(q.section||"GENERAL")} <span style="margin-left:5px">· ${status==="correct"?"✓ Correct +"+q.marks:status==="wrong"?"× Wrong":"Skipped"}</span></div>
       <div class="result-qtext">${esc(q.text)}</div>
       <div class="result-review-meta">Type: <strong>${esc(q.type||"mcq")}</strong> Â· Marks: <strong>${status==="correct"?"+"+Number(q.marks||0):status==="wrong"?"-"+Number(q.negativeMarks||0):"0"}</strong></div>
       <div class="result-answer">Your answer: <strong>${selected}</strong>${status!=="correct"?` · Correct: <strong>${correct}</strong>`:""}</div>
       <div class="result-detail">
         ${q.image?`<img class="result-question-image" src="${esc(q.image)}" alt="Question image">`:""}
         <strong>Options / Items</strong>
         <div style="margin-top:5px">${optionsHtml(q)}</div>
         ${q.explanation?`<div class="result-explanation"><strong>💡 Explanation</strong><br>${esc(q.explanation)}</div>`:""}
         <button class="btn save-flashcard" title="Save this question as a flashcard (F)" onclick="event.stopPropagation();Flashcards.saveQuestion(lastResultSnapshot.questions[${q.index}],lastResultSnapshot.name)">Save flashcard <kbd>F</kbd></button>
       </div>
     </div>
     <div class="result-status-icon">${status==="correct"?"✓":status==="wrong"?"×":"−"}</div>
   </div>`;
 }).join(""):'<div class="empty">No questions match this filter.</div>';
 renderAllQuizMath(el);
}

function saveResultCopy(){toast("Result is already saved locally ✓")}
function retakeLastTest(){
 if(!lastResultSnapshot)return;
 const qs=lastResultSnapshot.questions;
 questions=qs.map(q=>({
   type:q.type,text:q.text,options:q.options||[],answer:q.answer,
   acceptedAnswers:q.acceptedAnswers||[],pairs:q.pairs||[],image:q.image||"",
   hint:q.hint||"",explanation:q.explanation||"",marks:q.marks,negativeMarks:q.negativeMarks,section:q.section
 }));
 answers=Array(questions.length).fill(null);reviews=new Set();checkedQuestions=new Set();matchOrders={};current=0;
 seconds=Math.min(10,Math.max(1,lastResultSnapshot.durationMinutes||settings.defaultDuration||5))*60;
 quizDurationMinutes=Math.min(10,Math.max(1,lastResultSnapshot.durationMinutes||settings.defaultDuration||5));
 sessionId=null;examName=lastResultSnapshot.name;mode=lastResultSnapshot.mode||settings.defaultMode;examFinished=false;examId=lastResultSnapshot.examId||id();
 timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;
 registerActiveExam({name:examName});
 if(document.getElementById("examTitle"))document.getElementById("examTitle").textContent=examName;document.getElementById("headerQuizName").textContent=examName;
 showView("exam");render();saveSession();toast("Retake ready ✓")
}
function saveResult(){
 let correct=0,wrong=0,unanswered=0,score=0,max=0;
 questions.forEach((q,i)=>{max+=Number(q.marks||1);if(!answerIsPresent(answers[i],q))unanswered++;else if(isQuestionCorrect(q,answers[i])){correct++;score+=Number(q.marks||1)}else{wrong++;score-=Number(q.negativeMarks||0)}});
 const percent=Math.max(0,Math.round(score/Math.max(max,1)*100)),timestamp=new Date().toISOString(),r={
  id:id(),name:examName,mode,date:timestamp,timestamp,total:questions.length,
  correct,wrong,unanswered,score,max,percent,durationMinutes:quizDurationMinutes,
  timeTaken:Math.max(0,(quizDurationMinutes*60)-seconds),
  examId:examId||null,
  answers:cloneData(answers),
  matchOrders:cloneData(matchOrders),
  reviews:[...reviews],
  checkedQuestions:[...checkedQuestions]
 };
 if(!examId)registerActiveExam();
 r.examId=examId;
 const rs=get(K.results,[]);rs.unshift(r); put(K.results,rs);recordStudyActivity(null,r);PlanReviewQueue.render();return r
}
function renderStackedRows(items,renderRow,emptyMessage){
 const list=Array.isArray(items)?items:[];
 if(!list.length)return `<div class="empty">${emptyMessage}</div>`;
 const columns=[];
 for(let i=0;i<list.length;i+=10)columns.push(list.slice(i,i+10));
 return `<div class="stacked-list">${columns.map(column=>`<div class="stack-column">${column.map(renderRow).join("")}</div>`).join("")}</div>`;
}
function planSortNewestFirst(a,b){
 const created=String(b.createdAt||"").localeCompare(String(a.createdAt||""));
 if(created)return created;
 return (String(b.date||"")+" "+String(b.time||"")).localeCompare(String(a.date||"")+" "+String(a.time||""));
}
function renderDashboard(){
 if(!document.getElementById("mTests"))return;
 renderRecentQuizzes();
 const ss=get(K.sessions,[]).slice().sort((a,b)=>String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||"")));
 const ssl = document.getElementById("homeSessionsList");
 if(ssl)ssl.innerHTML=renderStackedRows(ss,s=>`<div class="resultrow"><div class="resultmain"><strong>${esc(s.name)}</strong><small>${getSessionAnsweredCount(s)}/${s.questions.length} answered · ${s.mode==="practice"?"Practice":"Exam"}</small></div><div style="display:flex;gap:5px"><button class="btn" onclick="restoreSession(&apos;${s.id}&apos;)">Continue</button><button class="session-delete2" style="border:1px solid var(--line); border-radius:10px; width: 34px; background:transparent; cursor:pointer; color:var(--muted); font-size:16px; display:flex; align-items:center; justify-content:center;" onclick="deleteSession(&apos;${s.id}&apos;)">×</button></div></div>`,`No saved sessions. Add a CBQ to begin.`);
 const rs=get(K.results,[]),avg=rs.length?Math.round(rs.reduce((a,r)=>a+r.percent,0)/rs.length):0,best=rs.length?Math.max(...rs.map(r=>r.percent)):0;
 const attempted=rs.reduce((a,r)=>a+(Number(r.correct)||0)+(Number(r.wrong)||0),0),solved=rs.reduce((a,r)=>a+(Number(r.correct)||0),0);
 document.getElementById("mTests").textContent=rs.length;document.getElementById("mAvg").textContent=avg+"%";document.getElementById("mBest").textContent=best+"%";document.getElementById("mQuestions").textContent=attempted;
 document.getElementById("mSolved").textContent=solved;
 document.getElementById("resultsList").innerHTML=rs.length?rs.slice(0,15).map(r=>`<div class="resultrow"><div class="resultmain"><strong>${esc(r.name)}</strong><small>${new Date(r.date).toLocaleString()} · ${r.mode==="practice"?"Practice":"Exam"} · ${r.correct}/${r.total} correct</small></div><div style="display:flex;align-items:center;gap:10px;"><b class="${r.percent>=80?"good":r.percent>=50?"mid":"bad"}">${r.percent}%</b><button class="session-delete" onclick="deleteResult('${r.id}')">×</button></div></div>`).join(""):'<div class="empty">No results yet.</div>';
 document.querySelectorAll("#resultsList .resultrow").forEach((row,i)=>{
   const result=rs[i];if(!result)return;
   row.classList.add("result-history-item");
   row.addEventListener("click",()=>openSavedResult(result.id));
   row.querySelectorAll(".session-delete").forEach(button=>button.addEventListener("click",event=>event.stopPropagation()));
 });
 const latest=rs[0],ad=document.getElementById("advice");
 if(!latest)ad.innerHTML='<div class="empty">Complete a test to unlock performance advice.</div>';
 else ad.innerHTML=`<strong>Latest: ${latest.percent}%</strong><p style="color:var(--muted);font-size:12px;line-height:1.6">${latest.percent>=80?"Strong performance. Push consistency with timed Exam Mode.":latest.percent>=60?"Good foundation. Use Practice Mode on weak topics, then retest.":"Focus on concept breakdown first, then repeat the same quiz after revision."}</p>`;
 renderGoal();
}
function deleteResult(id) {
  const rs = get(K.results, []);
  put(K.results, rs.filter(r => r.id !== id));
  put(K.study,get(K.study,[]).filter(item=>item.resultId!==id));
  const receipts=get(K.reviewQueue,{});
  delete receipts["result:"+id];
  put(K.reviewQueue,receipts);
  renderDashboard();
  renderHome();
  PlanReviewQueue.render();
  toast("Result deleted ✓");
}
function setGoalPreset(target){
 document.getElementById("goalTarget").value=target;
 if(!document.getElementById("goalInput").value.trim())document.getElementById("goalInput").value=`Reach ${target}% average in CBQ practice`;

}
function saveGoal(){
 const text=document.getElementById("goalInput").value.trim()||"Improve my CBQ performance";
 const target=Math.max(1,Math.min(100,Number(document.getElementById("goalTarget").value||80)));
 put(K.goal,{text,target,updatedAt:new Date().toISOString()});renderGoal();toast("Goal saved ✓")
}
function renderGoal(){
 const g=get(K.goal,{}),rs=get(K.results,[]),avg=rs.length?Math.round(rs.reduce((a,r)=>a+r.percent,0)/rs.length):0,target=Number(g.target||80),progress=Math.min(100,Math.round(avg/target*100));
 document.getElementById("goalInput").value=g.text||"";
 document.getElementById("goalTarget").value=target;
 document.getElementById("goalLabel").textContent=g.text?`${avg}% average · target ${target}%`:"Set a goal to track progress";
 document.getElementById("goalPercent").textContent=g.text?`${progress}% of goal`:"0%";
 document.getElementById("goalBar").style.width=(g.text?progress:0)+"%";
 document.querySelectorAll(".milestone").forEach(x=>x.classList.toggle("active",Number(x.textContent.match(/\d+/)?.[0])===target));
}
function clearResults(){if(confirm("Delete all saved results?")){removeStored(K.results);put(K.study,get(K.study,[]).filter(item=>item.kind!=="result"));const receipts=get(K.reviewQueue,{});for(const key of Object.keys(receipts))if(key.startsWith("result:"))delete receipts[key];put(K.reviewQueue,receipts);renderDashboard();renderHome();PlanReviewQueue.render();toast("Results cleared")}}


function planDateFromSource(source){
  const raw=source.examDate||source.scheduledDate||source.plannedDate||source.date||source.testDate;
  if(raw && /^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return String(raw);
  const d=new Date();d.setDate(d.getDate()+7);
  return d.toISOString().slice(0,10);
}
function planTimeFromSource(source){
  const raw=source.time||source.examTime||source.scheduledTime;
  return raw ? String(raw).slice(0,5) : "";
}
function saveQuickPlan(){
  const box=document.getElementById("planJson"),status=document.getElementById("planJsonStatus");
  const raw=box?.value.trim();
  if(!raw){toast("Paste quiz JSON first");return}
  try{
    const source=JSON.parse(raw);
    const quizSource=source.quiz||source.exam||source;
    const q=parseQuiz(quizSource);
    const name=source.name||q.name||"Planned CBQ";
    const date=planDateFromSource(source);
    const time=planTimeFromSource(source);
    const ps=get(K.plans,[]);
    ps.push({id:id(),name,date,time,notes:"",json:JSON.stringify(quizSource),createdAt:new Date().toISOString()});
    ps.sort(planSortNewestFirst);
    put(K.plans,ps);
    box.value="";
    if(status){status.textContent=`✓ Planned: ${name} · ${date}`;status.style.color="var(--good)"}
    renderPlans();renderHome();renderStudySuggestions();toast("Test planned ✓");
  }catch(e){
    if(status){status.textContent="✕ "+e.message+" Common paste formatting is supported."; status.style.color="var(--bad)"}
    toast("Invalid quiz JSON");
  }
}

function savePlan(){
 const name=document.getElementById("planName").value.trim(),date=document.getElementById("planDate").value,time=document.getElementById("planTime").value,notes=document.getElementById("planNotes").value.trim(),raw=document.getElementById("planJson").value.trim();
 if(!name||!date){toast("Add a test name and date");return}
 let json="";
 if(raw){
   try{
     const source=JSON.parse(raw);
     parseQuiz(source); // validate now, but keep the original compatible schema
     json=JSON.stringify(source);
   }catch(e){toast("Invalid quiz JSON: "+e.message);return}
 }
 const ps=get(K.plans,[]);ps.push({id:id(),name,date,time,notes,json,createdAt:new Date().toISOString()});ps.sort(planSortNewestFirst);put(K.plans,ps);
 clearPlanComposer();closePlanComposer();renderPlans();renderPlannerCalendar();renderStudySuggestions();toast("Future test saved ✓")
}
function renderPlans(){
 const el=document.getElementById("plansList");if(!el)return;
 const ps=get(K.plans,[]).slice().sort(planSortNewestFirst);
 const pc=document.getElementById("plannerCount");if(pc)pc.textContent=String(ps.length);
 el.innerHTML=renderStackedRows(ps,p=>`<div class="planrow"><div class="planmain"><strong>${esc(p.name)}</strong><small>${esc(p.date)}${p.time?" · "+esc(p.time):""}${p.notes?" · "+esc(p.notes):""}</small></div><div style="display:flex;gap:5px">${p.json?`<button class="btn primary" onclick="startPlan('${p.id}')">▶ Start</button>`:'<span class="plan-no-quiz">Quiz not attached</span>'}<button class="btn" aria-label="Delete ${esc(p.name)}" onclick="deletePlan('${p.id}')">×</button></div></div>`,`No upcoming tests.`);
}
function startPlan(pid){
 const p=get(K.plans,[]).find(x=>x.id===pid);if(!p)return;if(!p.json){toast("No quiz JSON attached to this plan");return}
 const q=parseQuiz(JSON.parse(p.json));questions=prepareShuffledQuiz(q.questions);sections=q.sections;examName=q.name||p.name;examId=p.examId||p.id;quizDurationMinutes=Math.min(10,Math.max(1,q.durationMinutes||settings.defaultDuration||5));answers=Array(questions.length).fill(null);reviews=new Set();checkedQuestions=new Set();matchOrders={};current=0;seconds=quizDurationMinutes*60;timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;sessionId=null;mode=settings.defaultMode;examFinished=false;
 registerActiveExam({source:"planned",plannedDate:p.date,plannedTime:p.time,name:p.name});
 if(document.getElementById("examTitle"))document.getElementById("examTitle").textContent=examName;document.getElementById("headerQuizName").textContent=examName;showView("exam");render();setTimeout(applyQuestionSidebarState,50);saveSession();toast("Planned test loaded ✓")
}
function deletePlan(pid){put(K.plans,get(K.plans,[]).filter(x=>x.id!==pid));renderPlans();renderStudySuggestions()}
async function importDataFile(event){
  const file=event.target.files?.[0];
  const status=document.getElementById("dataImportStatus");
  if(!file)return;
  try{
    const raw=await file.text();
    const parsed=JSON.parse(raw);

    if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error("The backup must be a JSON object.");
    const allowed=["settings","results","goal","plans","sessions","exams","recent","study","plannerDates","todos","promptLibrary","examDeadline","flashcards","reviewQueue"];
    const hasBackup=allowed.some(k=>Object.prototype.hasOwnProperty.call(parsed,k));
    if(!hasBackup)throw new Error("This is a quiz JSON, not an ExamFlow data backup. Use Add CBQ Quiz.");

    const overwrite=confirm(
      "Import this ExamFlow backup?\\n\\n" +
      "This will replace the supported data collections included in the backup."
    );
    if(!overwrite){
      event.target.value="";
      return;
    }

    const entries=[];
    const add=(field,key,value)=>{
      if(!Object.prototype.hasOwnProperty.call(parsed,field))return;
      entries.push([key,JSON.stringify(value)]);
    };
    const addArray=(field,key)=>{if(Object.prototype.hasOwnProperty.call(parsed,field)){if(!Array.isArray(parsed[field]))throw new Error(`${field} must be an array.`);add(field,key,parsed[field])}};
    const addObject=(field,key,allowNull=false)=>{if(Object.prototype.hasOwnProperty.call(parsed,field)){if(parsed[field]===null&&allowNull){add(field,key,{});return}if(!parsed[field]||typeof parsed[field]!=="object"||Array.isArray(parsed[field]))throw new Error(`${field} must be an object.`);add(field,key,parsed[field])}};
    addObject("settings",K.settings);addArray("results",K.results);addObject("goal",K.goal,true);
    addArray("plans",K.plans);addArray("sessions",K.sessions);addArray("exams",K.exams);
    addArray("recent",K.recent);
    if(Object.prototype.hasOwnProperty.call(parsed,"flashcards")){
      add("flashcards",K.flashcards,Flashcards.validateBackup(parsed.flashcards));
    }
    if(Object.prototype.hasOwnProperty.call(parsed,"reviewQueue")){
      PlanReviewQueue.validateReceipts(parsed.reviewQueue);
      addObject("reviewQueue",K.reviewQueue);
    }
    if(Object.prototype.hasOwnProperty.call(parsed,"study")){
      if(!Array.isArray(parsed.study))throw new Error("study must be an array.");
      entries.push([K.study,JSON.stringify(parsed.study.filter(item=>item?.kind!=="flashcards"&&item?.mode!=="flashcards"))]);
    }
    addObject("plannerDates",K.plannerDates);
    addArray("todos",K.todos);addObject("promptLibrary",K.promptLibrary,true);
    if(parsed.examDeadline!==undefined){
      if(parsed.examDeadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(String(parsed.examDeadline))||Number.isNaN(new Date(`${parsed.examDeadline}T00:00:00`).getTime())))throw new Error("examDeadline must use YYYY-MM-DD.");
      entries.push(["examflow_exam_deadline",parsed.examDeadline?JSON.stringify(String(parsed.examDeadline)):null]);
    }
    if(!entries.length)throw new Error("The backup contains no supported data.");
    await QuizStorage.batch(entries);

    settings=loadSettings();
    if(Object.prototype.hasOwnProperty.call(parsed,"flashcards"))Flashcards.refresh();
    if(Object.prototype.hasOwnProperty.call(parsed,"sessions"))sessionId=null;
    if(parsed.promptLibrary!==undefined&&typeof initPromptLibrary==="function")await initPromptLibrary();
    renderSessions();renderDashboard();renderPlans();renderHome();renderTodos();renderPlannerCalendar();renderPlannerTodos();PlanReviewQueue.render();applySettings();
    if(status){
      status.textContent="✓ Backup imported successfully.";
      status.style.color="var(--good)";
    }
    toast("ExamFlow data imported ✓");
  }catch(err){
    if(status){
      status.textContent="✕ "+(err?.message||"Could not import this JSON.");
      status.style.color="var(--bad)";
    }
    toast("Import failed");
  }finally{
    event.target.value="";
  }
}

function exportData(){
 const data={format:"examflow-library",version:1,exportedAt:new Date().toISOString(),settings:get(K.settings,{}),results:get(K.results,[]),goal:get(K.goal,{}),plans:get(K.plans,[]),sessions:get(K.sessions,[]),exams:get(K.exams,[]),recent:get(K.recent,[]),study:get(K.study,[]).filter(item=>item?.kind!=="flashcards"&&item?.mode!=="flashcards"),plannerDates:get(K.plannerDates,{}),todos:get(K.todos,[]),promptLibrary:get(K.promptLibrary,{}),flashcards:get(K.flashcards,{version:1,decks:[],session:null,activity:[]}),reviewQueue:get(K.reviewQueue,{}),examDeadline:getSavedExamDeadline()};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="examflow-data.json";a.click();URL.revokeObjectURL(url);
}
async function resetData(){
 if(!confirm("Reset all local ExamFlow data?"))return;
 try{
  const timestamp=new Date().toISOString();
  await QuizStorage.batch([...new Set([...Object.values(K),"examflow_exam_deadline","examflow_last_reset"])].map(key=>[key,key==="examflow_last_reset"?timestamp:key===K.flashcards?JSON.stringify({version:1,decks:[],session:null,activity:[]}):null]));
  location.reload();
 }catch(error){toast("Could not reset data: "+error.message)}
}



async function pasteFromClipboard(targetId,statusId,buttonId){
  const target=document.getElementById(targetId);
  const status=document.getElementById(statusId);
  const btn=document.getElementById(buttonId);
  if(!target)return;
  const original=btn?btn.textContent:"📋 Paste from Clipboard";
  try{
    if(btn){btn.disabled=true;btn.textContent="📋 Reading…";}
    if(!window.isSecureContext || !navigator.clipboard || !navigator.clipboard.readText){
      throw new Error("secure clipboard unavailable");
    }
    const text=await navigator.clipboard.readText();
    if(!text || !text.trim()){
      if(status){status.textContent="Clipboard is empty.";status.style.color="var(--bad)";}
      return;
    }
    target.value=text;
    target.dispatchEvent(new Event("input",{bubbles:true}));
    if(status){
      status.textContent="✓ Pasted directly from clipboard.";
      status.style.color="var(--good)";
    }
    target.focus();
    toast("JSON pasted ✓");
  }catch(err){
    if(status){
      status.textContent="Clipboard access was blocked. Allow clipboard permission for this site, then click Paste again.";
      status.style.color="var(--bad)";
    }
    toast("Clipboard permission blocked");
  }finally{
    if(btn){btn.disabled=false;btn.textContent=original;}
  }
}


/* Final exam date countdown */
function saveExamDeadline(sourceId="planExamDeadlineInput"){
  const v=document.getElementById(sourceId)?.value;
  if(!v){toast("Choose your final exam date");return}
  put("examflow_exam_deadline",v);
  renderExamDeadline();
  renderPlannerCalendar();renderStudySuggestions();
  toast("Final exam date saved ✓");
}
function getSavedExamDeadline(){
 const raw=QuizStorage.getItem("examflow_exam_deadline");
 if(!raw)return "";
 try{const value=JSON.parse(raw);return typeof value==="string"?value:""}catch{return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:""}
}
function setDeadlineInputValue(v){
  ["planExamDeadlineInput","dashboardExamDeadlineInput"].forEach(id=>{
    const input=document.getElementById(id);if(input)input.value=v;
  });
}
function openDeadlinePicker(idValue){
  const input=document.getElementById(idValue);
  if(!input)return;
  if(typeof input.showPicker==="function")input.showPicker();else input.click();
}
function renderExamDeadline(){
  const v=getSavedExamDeadline();
  const targets=[
    [document.getElementById("planExamCountdown"),document.getElementById("planExamDate")],
    [document.getElementById("dashboardExamCountdown"),document.getElementById("dashboardExamDate")]
  ];
  setDeadlineInputValue(v);
  if(!v){
    targets.forEach(([count,date])=>{
      if(count)count.textContent="No exam date set";
      if(date)date.textContent="Choose a target date to start your countdown.";
    });
    return;
  }
  const parts=v.split("-").map(Number),targetUtc=Date.UTC(parts[0],parts[1]-1,parts[2]);
  const now=new Date(),todayUtc=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const days=Math.round((targetUtc-todayUtc)/86400000);
  const target=new Date(targetUtc),dateText=target.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
  const text=days<0?"Exam date passed":days===0?"Exam day":`${days} day${days===1?"":"s"} remaining`;
  targets.forEach(([count,date])=>{
    if(count)count.textContent=text;
    if(date)date.textContent=days<0?`Target was ${dateText}`:`Target: ${dateText}`;
  });
}
if(!window.examflowDeadlineInterval)window.examflowDeadlineInterval=setInterval(renderExamDeadline,30000);

/* Question progress drawer */

const QUESTION_SIDEBAR_KEY="examflow_question_sidebar_open";

function getQuestionSidebarState(){
  return get(QUESTION_SIDEBAR_KEY,false)===true;
}
function setQuestionSidebarState(open){
  put(QUESTION_SIDEBAR_KEY,Boolean(open));
}
function syncQuestionSidebar(open){
  const d=document.getElementById("examProgressDrawer");
  const b=document.querySelector(".exam-progress-backdrop");
  if(!d)return;
  d.classList.toggle("open",open);
  d.setAttribute("aria-hidden",String(!open));d.inert=!open;
  const main=document.querySelector("#examView .main");if(main)main.classList.toggle("palette-shift",open);
  const toggle=document.getElementById("examProgressBtn");if(toggle)toggle.setAttribute("aria-expanded",String(open));
  if(b){b.classList.toggle("open",open);b.setAttribute("aria-hidden",String(!open))}
  if(open)renderQuestionProgress();
  else if(d.contains(document.activeElement))toggle?.focus({preventScroll:true});
}
function applyQuestionSidebarState(){
  syncQuestionSidebar(getQuestionSidebarState());
}

function toggleQuestionProgress(){
  const d=document.getElementById("examProgressDrawer");
  if(!d)return;
  const open=!d.classList.contains("open");
  if(open&&!questions.length){toast("Load a quiz to use the question palette");return}
  setQuestionSidebarState(open);
  syncQuestionSidebar(open);
  if(open)document.querySelector("#examProgressGrid .progress-q.current")?.focus({preventScroll:true});
}
function renderQuestionProgress(){
  const grid=document.getElementById("examProgressGrid");
  if(!grid)return;
  if(!questions.length){grid.innerHTML="";return}
  renderQuestionNavigation(grid,"progress-q",jumpToQuestion);
}


function shuffleAllQuestions(){
  if(!questions.length){
    toast("No questions to shuffle");
    return;
  }
  let indices = questions.map((_, i) => i);
  indices = shuffleArray(indices);
  const newQuestions = indices.map(i => questions[i]);
  const newAnswers = indices.map(i => answers[i]);
  const newReviews = new Set();
  reviews.forEach(oldIndex => {
    const newIndex = indices.indexOf(oldIndex);
    if (newIndex !== -1) newReviews.add(newIndex);
  });
  const newCheckedQuestions = new Set();
  checkedQuestions.forEach(oldIndex => {
    const newIndex = indices.indexOf(oldIndex);
    if (newIndex !== -1) newCheckedQuestions.add(newIndex);
  });
  const newMatchOrders = {};
  for(const [oldIdxStr, order] of Object.entries(matchOrders)) {
    const oldIndex = parseInt(oldIdxStr, 10);
    const newIndex = indices.indexOf(oldIndex);
    if(newIndex !== -1) newMatchOrders[newIndex] = order;
  }
  questions = newQuestions;
  answers = newAnswers;
  reviews = newReviews;
  checkedQuestions = newCheckedQuestions;
  matchOrders = newMatchOrders;
  current = 0;
  render();
  renderQuestionProgress();
  saveSessionSoon();
  toast("Questions shuffled ✓");
}

function _ignore_shuffleCurrentOptions(){
  const q=questions[current];
  if(!q || !Array.isArray(q.options) || q.options.length<2){
    toast("This question has no options to shuffle");
    return;
  }

  // Preserve the correct option by its value, then randomize the visible order.
  let correctValue=null;
  if(typeof q.answer==="string"){
    const m=q.answer.trim().match(/^([A-Z])$/i);
    if(m){
      const idx=m[1].toUpperCase().charCodeAt(0)-65;
      if(idx>=0 && idx<q.options.length) correctValue=q.options[idx];
    }else{
      correctValue=q.options.find(x=>String(x).trim()===q.answer.trim()) ?? null;
    }
  }else if(typeof q.answer==="number"){
    correctValue=q.options[q.answer] ?? null;
  }

  let shuffled=[...q.options];
  do{
    shuffled=shuffleArray(shuffled);
  }while(shuffled.length>1 && shuffled.every((x,i)=>String(x)===String(q.options[i])));

  q.options=shuffled;

  if(correctValue!==null){
    const newIndex=shuffled.findIndex(x=>String(x)===String(correctValue));
    if(newIndex>=0) q.answer=String.fromCharCode(65+newIndex);
  }

  // Keep the current selection intact if one exists, but reset checking because
  // the visual order has changed.
  checkedQuestions.delete(current);
  render();
  renderQuestionProgress();
  saveSessionSoon();
  toast("Options randomized ✓");
}

function jumpToQuestion(i){
  if(i<0||i>=questions.length)return;
  current=i;
  render();
  renderQuestionProgress();
  saveSessionSoon();
  if(window.innerWidth <= 800) {
    if(document.getElementById("examProgressDrawer")?.classList.contains("open"))toggleQuestionProgress();
    window.scrollTo({top: 0, behavior: "smooth"});
  }else if(document.getElementById("examProgressDrawer")?.classList.contains("open")){
    document.querySelector("#examProgressGrid .progress-q.current")?.focus({preventScroll:true});
  }
}


function shuffleArray(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function prepareShuffledQuiz(qs){
  return qs.map(q=>{
    const copy={...q};
    if(!Array.isArray(copy.options) || copy.options.length<2) return copy;

    // Preserve the actual correct option before shuffling.
    let correctIndex=-1;
    if(typeof copy.answer==="string"){
      const letter=copy.answer.trim().match(/^([A-Z])$/i);
      if(letter){
        correctIndex=letter[1].toUpperCase().charCodeAt(0)-65;
      }else{
        correctIndex=copy.options.findIndex(x=>String(x).trim()===copy.answer.trim());
      }
    }else if(typeof copy.answer==="number"){
      correctIndex=copy.answer;
    }

    const correctValue=correctIndex>=0 ? copy.options[correctIndex] : null;
    const shuffled=shuffleArray(copy.options);
    copy.options=shuffled;

    if(correctValue!==null){
      const newIndex=shuffled.findIndex(x=>String(x)===String(correctValue));
      if(newIndex>=0) copy.answer=String.fromCharCode(65+newIndex);
    }
    return copy;
  });
}

function startHomeQuiz(){
 const raw=document.getElementById("homeJson").value.trim();
 const status=document.getElementById("homeJsonStatus");
 if(!raw){status.textContent="Paste your CBQ JSON first.";status.style.color="var(--bad)";return}
 try{
   const parsed=parseQuiz(parseQuizInput(raw));
   questions=prepareShuffledQuiz(parsed.questions);sections=parsed.sections;examName=parsed.name;examId=id();
   quizDurationMinutes=parsed.durationMinutes||settings.defaultDuration||30;
   answers=Array(questions.length).fill(null);reviews=new Set();checkedQuestions=new Set();matchOrders={};current=0;seconds=quizDurationMinutes*60;timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;sessionId=null;mode=settings.defaultMode;examFinished=false;
   if(document.getElementById("examTitle"))document.getElementById("examTitle").textContent=examName;document.getElementById("headerQuizName").textContent=examName;
   if(document.getElementById("examMeta"))document.getElementById("examMeta").textContent=`${questions.length} questions · ${quizDurationMinutes} min · scoring from JSON/settings`;
   registerActiveExam();saveSession();showView("exam");render();toast(`Ready — ${questions.length} questions ✓`);
 }catch(e){status.textContent="✕ "+e.message;status.style.color="var(--bad)"}
}
function pasteAndStart(){
 document.getElementById("homeJson").focus();
 document.getElementById("homeJson").scrollIntoView({behavior:"smooth",block:"center"});
}
function readHomeFile(e){
 const f=e.target.files[0];if(!f)return;
 const r=new FileReader();r.onload=()=>{document.getElementById("homeJson").value=r.result;document.getElementById("homeJsonStatus").textContent="JSON loaded — click Load & Start.";document.getElementById("homeJsonStatus").style.color="var(--good)"};r.readAsText(f)
}

let studyCalendarMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let studySelectedDate=null,studySearchQuery="",studySearchScope="all",studySearchTimer=null;
function studyDateKey(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return null;
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function recordStudyActivity(session,result){
 const date=studyDateKey(result?.date||session?.updatedAt||new Date());
 if(!date)return;
 const entries=get(K.study,[]).filter(item=>item.kind!=="flashcards"&&item.mode!=="flashcards");
 if(result){
  for(let i=entries.length-1;i>=0;i--)if(entries[i].kind==="session"&&result.examId&&entries[i].examId===result.examId&&entries[i].date===date)entries.splice(i,1);
  const next={kind:"result",resultId:result.id,examId:result.examId,date,name:result.name,mode:result.mode,answered:Number(result.correct||0)+Number(result.wrong||0),total:result.total,percent:result.percent,updatedAt:result.date||result.timestamp};
  const index=entries.findIndex(item=>item.resultId===result.id);if(index>=0)entries[index]=next;else entries.push(next);
 }else{
  const answered=getSessionAnsweredCount(session);if(!answered)return;
  const next={kind:"session",sessionId:session.id,examId:session.examId,date,name:session.name,mode:session.mode,answered,total:session.questions?.length||0,updatedAt:session.updatedAt};
  if(entries.some(item=>item.kind==="result"&&item.examId===session.examId&&item.date===date))return;
  const index=entries.findIndex(item=>item.kind==="session"&&item.sessionId===session.id&&item.date===date);if(index>=0)entries[index]=next;else entries.push(next);
 }
 put(K.study,entries);
}
function getHomeStudyHistory(sessions,results){
 const history=get(K.study,[]).filter(item=>item.kind!=="flashcards"&&item.mode!=="flashcards").map(item=>({
   ...item,kind:item.kind==="result"||item.resultId?"result":"session",
   date:item.date||studyDateKey(item.updatedAt||item.createdAt)
 })).filter(item=>item.date);
 sessions.forEach(session=>{
   const date=studyDateKey(session.updatedAt||session.createdAt);
   const answered=getSessionAnsweredCount(session);
   if(date&&answered&&!history.some(item=>item.kind==="session"&&item.sessionId===session.id&&item.date===date)&&!history.some(item=>item.kind==="result"&&item.examId===session.examId&&item.date===date))history.push({kind:"session",sessionId:session.id,examId:session.examId,name:session.name,mode:session.mode,answered,total:session.questions?.length||0,date,updatedAt:session.updatedAt||session.createdAt,examFinished:session.examFinished});
 });
 results.forEach(result=>{
   const date=studyDateKey(result.date||result.timestamp);
   if(!date)return;
   for(let index=history.length-1;index>=0;index--){
     if(history[index].kind==="session"&&result.examId&&history[index].examId===result.examId&&history[index].date===date)history.splice(index,1);
   }
   const next={kind:"result",resultId:result.id,examId:result.examId,name:result.name,mode:result.mode,answered:Number(result.correct||0)+Number(result.wrong||0),total:Number(result.total)||0,percent:Number(result.percent)||0,date,updatedAt:result.date||result.timestamp};
   const existing=history.findIndex(item=>item.kind==="result"&&item.resultId===result.id);if(existing>=0)history[existing]=next;else history.push(next);
 });
 return history.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
}
function chooseStudyDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||""))return;
 const date=new Date(`${value}T12:00:00`);
 if(studyDateKey(date)!==value)return;
 studySelectedDate=value;studyCalendarMonth=new Date(date.getFullYear(),date.getMonth(),1);renderHome();
}
function shiftStudyMonth(delta){
 studyCalendarMonth=new Date(studyCalendarMonth.getFullYear(),studyCalendarMonth.getMonth()+delta,1);renderHome();
}
function clearStudyDate(){studySelectedDate=null;renderHome()}
function studySearchText(value){
 return String(value??"").normalize("NFKD").replace(/\p{M}/gu,"").toLowerCase().replace(/\s+/g," ").trim();
}
function studySessionRecord(session){
 return {kind:"session",sessionId:session.id,examId:session.examId,name:session.name,mode:session.mode,
  answered:getSessionAnsweredCount(session),total:session.questions?.length||0,updatedAt:session.updatedAt||session.createdAt};
}
function studySearchInventory(sessions,results,exams){
 const records=[],seen=new Set(),add=(item,key)=>{if(!seen.has(key)){seen.add(key);records.push(item)}};
 const newest=list=>list.slice().sort((a,b)=>String(b.updatedAt||b.date||b.timestamp||"").localeCompare(String(a.updatedAt||a.date||a.timestamp||"")));
 newest(sessions.filter(s=>!s.examFinished)).forEach(s=>add(studySessionRecord(s),s.examId||s.id));
 newest(results).forEach(r=>add({kind:"result",resultId:r.id,examId:r.examId,name:r.name,mode:r.mode,
  answered:Number(r.correct||0)+Number(r.wrong||0),total:r.total,percent:r.percent,updatedAt:r.date||r.timestamp},r.examId||r.id));
 newest(sessions.filter(s=>s.examFinished)).forEach(s=>add(studySessionRecord(s),s.examId||s.id));
 newest(exams).forEach(e=>add({kind:"quiz",examId:e.id,name:e.name,answered:0,total:e.questions?.length||0,updatedAt:e.updatedAt},e.id));
 return records;
}
function studyFindMatch(item,source,tokens){
 const title=studySearchText(item.name),reveal=source?.mode==="practice"||source?.examFinished===true||item.kind==="result";
 const parts=(Array.isArray(source?.questions)?source.questions:[]).map((q,index)=>{
  if(!q||typeof q!=="object")return {index,text:"",normalized:""};
  const text=[q.text||q.question||"",...(Array.isArray(q.options)?q.options:[]),q.section||"",q.hint||"",
   ...(reveal?[q.explanation||""]:[]),...(Array.isArray(q.pairs)?q.pairs.map(p=>p?.left||""):[])].join(" ");
  return {index,text,normalized:studySearchText(text)};
 });
 const body=parts.map(p=>p.normalized).join(" ");
 const haystack=studySearchScope==="title"?title:studySearchScope==="content"?body:title+" "+body;
 if(!tokens.every(token=>haystack.includes(token)))return null;
 const titleMatch=tokens.every(token=>title.includes(token));
 const hits=parts.map(p=>({...p,score:tokens.filter(token=>p.normalized.includes(token)).length}))
  .filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
 let snippet="";
 if(studySearchScope!=="title"&&hits.length){
  const hit=hits[0],text=hit.text.replace(/\s+/g," ").trim();
  const position=Math.max(0,...tokens.map(t=>hit.normalized.indexOf(t)).filter(n=>n>=0).slice(0,1));
  const start=Math.max(0,position-45);
  snippet=`Question ${hit.index+1} · ${start?"…":""}${text.slice(start,start+150)}${text.length>start+150?"…":""}`;
 }
 return {titleMatch,snippet};
}
function refreshStudySearch(restoreFocus=false){
 const host=document.getElementById("homeSessionsList");if(!host)return;
 const input=document.getElementById("studyQuizSearch"),start=input?.selectionStart,end=input?.selectionEnd;
 host.innerHTML=renderStudyWorkspace(get(K.sessions,[]),get(K.results,[]));
 if(restoreFocus){
  const next=document.getElementById("studyQuizSearch");
  if(next){next.focus({preventScroll:true});if(start!=null)next.setSelectionRange(start,end??start)}
 }
}
function renderStudyWorkspace(sessions,results){
 const history=getHomeStudyHistory(sessions,results),year=studyCalendarMonth.getFullYear(),month=studyCalendarMonth.getMonth();
 const dayCounts=new Map();history.forEach(item=>dayCounts.set(item.date,(dayCounts.get(item.date)||0)+1));
 const offset=(new Date(year,month,1).getDay()+6)%7,days=new Date(year,month+1,0).getDate(),today=studyDateKey(new Date());
 const dayButtons=Array.from({length:offset},()=>"<span class=\"study-day-spacer\" aria-hidden=\"true\"></span>");
 for(let day=1;day<=days;day++){
   const key=studyDateKey(new Date(year,month,day)),count=dayCounts.get(key)||0;
   const label=new Date(year,month,day).toLocaleDateString(undefined,{dateStyle:"full"});
   dayButtons.push(`<button class="study-day${key===today?" is-today":""}${key===studySelectedDate?" is-selected":""}" type="button" aria-label="${esc(label)}${count?`, ${count} study records`:""}" aria-pressed="${key===studySelectedDate}" onclick="chooseStudyDate('${key}')"><span>${day}</span>${count?"<i aria-hidden=\"true\"></i>":""}</button>`);
 }
 const active=sessions.filter(session=>!session.examFinished).map(session=>({kind:"session",sessionId:session.id,examId:session.examId,name:session.name,mode:session.mode,answered:getSessionAnsweredCount(session),total:session.questions?.length||0,updatedAt:session.updatedAt||session.createdAt}));
 const savedExams=get(K.exams,[]),sessionMap=new Map(sessions.map(s=>[s.id,s])),resultMap=new Map(results.map(r=>[r.id,r])),examMap=new Map(savedExams.map(e=>[e.id,e]));
 const sourceFor=item=>item.kind==="result"?resultMap.get(item.resultId):item.sessionId?sessionMap.get(item.sessionId)||examMap.get(item.examId):examMap.get(item.examId);
 const tokens=[...new Set(studySearchText(studySearchQuery).split(" ").filter(Boolean))],searching=tokens.length>0;
 let records=studySelectedDate?history.filter(item=>item.date===studySelectedDate):searching?studySearchInventory(sessions,results,savedExams):active;
 if(searching){
   records=records.map(item=>({...item,match:studyFindMatch(item,sourceFor(item),tokens)}))
   .filter(item=>item.match)
   .sort((a,b)=>Number(b.match.titleMatch)-Number(a.match.titleMatch)||String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
 }
 const title=studySelectedDate?new Date(`${studySelectedDate}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric",year:"numeric"}):searching?"Matching quizzes":"In progress";
 const cards=records.map(item=>{
   const session=item.sessionId&&sessions.find(s=>s.id===item.sessionId),completed=item.kind==="result"||item.examFinished;
   const progress=Math.min(100,Math.round((item.answered||0)/Math.max(item.total||0,1)*100));
   const updated=item.updatedAt?new Date(item.updatedAt):null;
   const time=updated&&!Number.isNaN(updated.getTime())?updated.toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"";
   const kind=item.kind==="result"?"result":session?"session":"quiz",idValue=item.kind==="result"?item.resultId:session?session.id:item.examId;
   const menu=idValue?`<details class="study-session-menu"><summary aria-label="Quiz options for ${esc(item.name||"Untitled quiz")}" title="Quiz options">⋯</summary><div class="study-session-menu-panel"><button type="button" data-download-study-quiz="${esc(idValue)}" data-study-quiz-kind="${kind}">Download quiz JSON</button><button type="button" data-rename-study-quiz="${esc(idValue)}" data-study-quiz-kind="${kind}">Edit title</button><button type="button" class="study-menu-delete" data-delete-study-quiz="${esc(idValue)}" data-study-quiz-kind="${kind}">Delete saved quiz</button></div></details>`:"";
   const action=item.kind==="result"?"result":session&&!completed?"session":item.examId&&getExamRecord(item.examId)?"quiz":"";
   const actionId=item.kind==="result"?item.resultId:session&&!completed?session.id:item.examId||"";
   const actionLabel=action==="session"?"Continue":action==="result"?"Review":completed?"Retake":"Start";
   return `<article class="study-session-card">
     <div class="study-card-meta"><span>${item.kind==="result"?"Completed":item.kind==="quiz"?"Saved quiz":item.mode==="practice"?"Practice":"Exam"}</span><div class="study-card-status">${completed?"Completed":item.kind==="quiz"?"Ready to start":"Progress saved"}${menu}</div></div>
     <h4>${esc(item.name||"Untitled quiz")}</h4>${item.match?.snippet?`<p class="study-search-match">${esc(item.match.snippet)}</p>`:""}
     <p>${item.kind==="result"?`${item.percent}% score · `:""}${item.answered||0} / ${item.total||0} answered</p>
     <div class="study-progress" role="progressbar" aria-label="Answered questions" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div>
     <div class="study-card-footer"><small>${esc(time)}</small>${action?`<button class="btn" type="button" data-study-open="${action}" data-study-id="${esc(actionId)}">${actionLabel} →</button>`:'<small>Quiz no longer saved</small>'}</div>
   </article>`;
 }).join("");
 const searchBar=`<div class="study-search-bar"><input id="studyQuizSearch" type="search" maxlength="160" value="${esc(studySearchQuery)}" placeholder="Search previous quizzes by topic…" aria-label="Search previous quiz titles and content" aria-controls="studySearchResults" autocomplete="off"><select id="studySearchScope" aria-label="Search in"><option value="all"${studySearchScope==="all"?" selected":""}>Title & content</option><option value="title"${studySearchScope==="title"?" selected":""}>Title only</option><option value="content"${studySearchScope==="content"?" selected":""}>Content only</option></select>${searching?'<button class="btn" type="button" data-clear-study-search aria-label="Clear quiz search">×</button>':""}</div>`;
 const emptyTitle=searching?"No matching quizzes":studySelectedDate?"No recorded study on this date":"Nothing to resume yet";
 const emptyCopy=searching?"Try fewer keywords or another search scope. Clear the date filter to search all saved quizzes.":studySelectedDate?"Choose a marked date to see its saved activity.":"Load a CBQ and your progress will appear here.";
 const listTitle=studySelectedDate?title:searching?title:"In progress";
 return `<div class="study-workspace">
   <div class="study-calendar-column">
     <div class="study-month-nav"><button class="btn" type="button" aria-label="Previous month" onclick="shiftStudyMonth(-1)">‹</button><strong>${studyCalendarMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"})}</strong><button class="btn" type="button" aria-label="Next month" onclick="shiftStudyMonth(1)">›</button></div>
     <div class="study-weekdays">${["M","T","W","T","F","S","S"].map(day=>`<span>${day}</span>`).join("")}</div>
     <div class="study-calendar-days">${dayButtons.join("")}</div>
     <p class="study-calendar-legend"><i aria-hidden="true"></i> Saved study activity</p>
     <label class="study-date-label" for="studyDateJump">Go to date</label><input id="studyDateJump" type="date" value="${studySelectedDate||""}" onchange="chooseStudyDate(this.value)">
     <div class="study-date-actions"><button class="btn" type="button" onclick="chooseStudyDate('${today}')">Today</button><button class="btn" type="button" onclick="clearStudyDate()">All sessions</button></div>
   </div>
   <div class="study-content-column">${searchBar}<div class="study-list-heading"><h4>${esc(listTitle)}</h4><span>${records.length} ${studySelectedDate?"records":searching?"quizzes":"sessions"}</span></div><div id="studySearchResults" class="study-session-grid">${cards||`<div class="study-empty"><strong>${emptyTitle}</strong><p>${emptyCopy}</p></div>`}</div></div>
 </div>`;
}
document.addEventListener("click",event=>{
 if(event.target.closest("[data-clear-study-search]")){clearTimeout(studySearchTimer);studySearchQuery="";refreshStudySearch(true);return}
 const open=event.target.closest("[data-study-open]");
 if(open){if(open.dataset.studyOpen==="session")restoreSession(open.dataset.studyId);else if(open.dataset.studyOpen==="result")openSavedResult(open.dataset.studyId);else openRecentQuiz(open.dataset.studyId);return}
 const menu=event.target.closest(".study-session-menu");
 document.querySelectorAll(".study-session-menu[open]").forEach(item=>{if(item!==menu)item.open=false});
 const download=event.target.closest("[data-download-study-quiz]");
 if(download){downloadSavedQuiz(download.dataset.studyQuizKind,download.dataset.downloadStudyQuiz);if(menu)menu.open=false;return}
 const rename=event.target.closest("[data-rename-study-quiz]");
 if(rename){renameSavedQuiz(rename.dataset.studyQuizKind,rename.dataset.renameStudyQuiz);if(menu)menu.open=false;document.getElementById("studyQuizSearch")?.focus({preventScroll:true});return}
 const remove=event.target.closest("[data-delete-study-quiz]");
 if(remove){deleteSavedQuiz(remove.dataset.studyQuizKind,remove.dataset.deleteStudyQuiz);if(menu)menu.open=false;document.getElementById("studyQuizSearch")?.focus({preventScroll:true})}
});
document.addEventListener("input",event=>{
 if(event.target.id!=="studyQuizSearch"||event.isComposing)return;
 studySearchQuery=event.target.value;clearTimeout(studySearchTimer);
 studySearchTimer=setTimeout(()=>refreshStudySearch(document.activeElement?.id==="studyQuizSearch"),140);
});
document.addEventListener("compositionend",event=>{
 if(event.target.id==="studyQuizSearch")event.target.dispatchEvent(new Event("input",{bubbles:true}));
});
document.addEventListener("change",event=>{
 if(event.target.id!=="studySearchScope"||!["all","title","content"].includes(event.target.value))return;
 clearTimeout(studySearchTimer);studySearchScope=event.target.value;refreshStudySearch();
 document.getElementById("studySearchScope")?.focus({preventScroll:true});
});
document.addEventListener("keydown",event=>{
 if(event.key!=="Escape")return;
 const menu=document.querySelector(".study-session-menu[open]");
 if(menu){menu.open=false;menu.querySelector("summary").focus({preventScroll:true})}
});
function renderHome(){
 renderRecentQuizzes();
 const rs=get(K.results,[]),ss=get(K.sessions,[]);
 const solved=rs.reduce((a,r)=>a+(Number(r.correct)||0),0);
 const homeMetrics={homeTests:rs.length,homeQuestions:solved};
 Object.entries(homeMetrics).forEach(([key,value])=>{const el=document.getElementById(key);if(el)el.textContent=value});
 const studyList=document.getElementById("homeSessionsList");
 if(studyList)studyList.innerHTML=renderStudyWorkspace(ss,rs);
 renderStudySuggestions();
}
let studySuggestionsDismissed=false;
function renderStudySuggestions(){
 const host=document.getElementById("studySuggestions"),list=document.getElementById("studySuggestionsList"),summary=document.getElementById("studySuggestionsSummary");
 if(!host||!list)return;
 if(studySuggestionsDismissed){host.hidden=true;return}
 const today=plannerDateKey(new Date()),items=[];
 const overdue=get(K.todos,[]).filter(todo=>!todo.done&&todo.deadline&&todo.deadline<today);
 const session=get(K.sessions,[]).find(item=>!item.examFinished);
 const plans=get(K.plans,[]).filter(plan=>plan.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const deadline=getSavedExamDeadline();
 if(overdue.length)items.push({title:`${overdue.length} overdue study task${overdue.length===1?"":"s"}`,detail:`Next: ${overdue[0].text}`,label:"Review tasks",action:"planner"});
 if(session)items.push({title:"Continue your CBQ",detail:`${session.name} · ${getSessionAnsweredCount(session)} of ${session.questions.length} answered`,label:"Continue",action:"session",id:session.id});
 if(plans.length&&items.length<2)items.push({title:"Upcoming planned quiz",detail:`${plans[0].name} · ${plans[0].date}`,label:"Open Plan",action:"planner"});
 if(deadline&&items.length<2)items.push({title:"Final exam countdown",detail:`Target date: ${deadline}`,label:"View calendar",action:"planner"});
 if(!items.length){host.hidden=true;return}
 host.hidden=false;
 if(summary)summary.textContent="A few useful next steps from your saved study data.";
 list.innerHTML=items.slice(0,2).map(item=>`<article class="study-suggestion-item"><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><button class="btn" type="button" data-study-suggestion="${item.action}" ${item.id?`data-study-session="${esc(item.id)}"`:""}>${esc(item.label)} →</button></article>`).join("");
}
function dismissStudySuggestions(){studySuggestionsDismissed=true;const host=document.getElementById("studySuggestions");if(host)host.hidden=true}
document.addEventListener("click",event=>{
 const button=event.target.closest("[data-study-suggestion]");if(!button)return;
 if(button.dataset.studySuggestion==="session")restoreSession(button.dataset.studySession);
 else showView("planner");
});


function syncExamTitleBar(){
  const bar=document.getElementById("headerQuizName");
  const globalTitle=document.getElementById("globalExamTitle");
  if(examName){
    if(bar){bar.textContent=examName;bar.title=examName;}
    if(globalTitle){globalTitle.textContent=examName;globalTitle.title=examName;}
  }
}

function showView(name){
 closeMobileNav();
 const allowedViews=["home","exam","dashboard","testResults","planner","flashcards","settings"];
 const resolvedName = allowedViews.includes(name) ? name : "home";
 if(resolvedName === "exam" && (!questions || questions.length===0)){
  toast("No quiz loaded. Please open a CBQ first.");
  return showView("home");
 }
 if(resolvedName === "exam"){updateTimerUI();updateModeUI();}
 document.body.classList.toggle("exam-active",resolvedName==="exam");
 window.scrollTo({top:0,behavior:"smooth"});
 allowedViews.forEach(x=>{
  const el=document.getElementById(x+"View");
  if(el)el.classList.toggle("active",x===resolvedName);
 });
 ["navHome","navExam","navDashboard","navPlanner","navFlashcards","navSettings"].forEach(x=>{
  const el=document.getElementById(x); if(el)el.classList.remove("active");
 });
 const activeNav=document.getElementById({home:"navHome",exam:"navExam",dashboard:"navDashboard",testResults:"navDashboard",planner:"navPlanner",flashcards:"navFlashcards",settings:"navSettings"}[resolvedName]);
 if(activeNav)activeNav.classList.add("active");
 if(resolvedName==="home"){renderHome();if(typeof renderTodos==='function')renderTodos();}
 if(resolvedName==="dashboard"){renderDashboard();renderExamDeadline();}
 if(resolvedName==="planner"){renderPlans();renderPlannerCalendar();renderPlannerTodos();renderExamDeadline();PlanReviewQueue.render();}
 if(resolvedName==="flashcards")Flashcards.refresh();
 if(resolvedName==="settings")updatePersistentStorageInfo();
 if(resolvedName==="exam"){setTimeout(()=>{applyQuestionSidebarState();syncExamTitleBar()},0)}
}
function toggleMobileNav(){document.body.classList.toggle("mobile-nav-open")}
function closeMobileNav(){document.body.classList.remove("mobile-nav-open")}
function toast(s){const x=document.getElementById("toast");x.textContent=s;x.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>x.classList.remove("show"),2200)}


let examAudioCtx=null;
function ensureExamAudio(){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return null;
    if(!examAudioCtx)examAudioCtx=new AC();
    if(examAudioCtx.state==="suspended")examAudioCtx.resume();
    return examAudioCtx;
  }catch(e){return null}
}
function playExamTone(frequency,duration,volume=0.07,when=0){
  const ctx=ensureExamAudio();
  if(!ctx)return false;
  try{
    const t=ctx.currentTime+when;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.type="sine";
    osc.frequency.setValueAtTime(frequency,t);
    gain.gain.setValueAtTime(0.0001,t);
    gain.gain.exponentialRampToValueAtTime(volume,t+0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001,t+duration);
    osc.connect(gain);gain.connect(ctx.destination);
    osc.start(t);osc.stop(t+duration+0.03);
    return true;
  }catch(e){return false}
}
function playButtonSound(){
  if(settings.soundEnabled===false)return;
  playExamTone(560,.075,.13,0);
}
function playAnswerSound(correct){
  if(settings.soundEnabled===false)return;
  const ctx=ensureExamAudio();
  if(!ctx)return;
  if(correct){
    playExamTone(660,.15,.16,0);
    playExamTone(880,.2,.14,.13);
  }else{
    playExamTone(260,.17,.15,0);
    playExamTone(180,.22,.13,.14);
  }
}
function testAnswerSound(){
  if(settings.soundEnabled===false){
    toast("Enable interface sounds first");
    return;
  }
  const ok=playExamTone(660,.15,.16,0);
  playExamTone(880,.2,.14,.13);
  if(!ok)toast("This browser is blocking audio. Click the page once, then try again.");
}



function practiceCorrectAnswerHTML(q){
  const escv=v=>esc(String(v??""));
  if(q.type==="fill_blank"){
    return (q.acceptedAnswers||[q.answer]).map(escv).join(" / ");
  }
  if(q.type==="match"||q.type==="drag_drop"){
    return q.pairs.map((p,i)=>`<div class="answer-pair"><span>${i+1}.</span><span>${escv(p.left)}</span><span class="answer-arrow">→</span><span>${escv(p.right)}</span></div>`).join("");
  }
  if(q.type==="ordering"){
    return (q.answer||[]).map((v,i)=>`<div><strong>${i+1}.</strong> ${escv(v)}</div>`).join("");
  }
  if(q.type==="true_false")return escv(q.answer);
  if(q.options&&q.options.length){
    const idx=typeof q.answer==="number"?q.answer:
      (/^[A-Z]$/i.test(String(q.answer))?String(q.answer).toUpperCase().charCodeAt(0)-65:q.options.findIndex(o=>String(o)===String(q.answer)));
    if(idx>=0&&idx<q.options.length)return `${String.fromCharCode(65+idx)}. ${escv(q.options[idx])}`;
  }
  return escv(q.answer);
}

function viewPracticeAnswer(){
  if(mode!=="practice"||!questions.length)return;
  checkedQuestions.add(current);
  render();
  saveSessionSoon();
}
function getCorrectOptionIndex(q){
  if(!Array.isArray(q.options))return -1;
  if(typeof q.answer==="number")return q.answer;
  const a=String(q.answer??"").trim();
  if(/^[A-Z]$/i.test(a))return a.toUpperCase().charCodeAt(0)-65;
  return q.options.findIndex(x=>String(x).trim()===a);
}
function highlightCorrectAnswerForView(q){
  const opts=document.getElementById("options");
  if(!opts)return;
  opts.classList.add("answer-revealed");

  if(q.type==="match"||q.type==="drag_drop"){
    const rows=opts.querySelectorAll(".match-row");
    rows.forEach((row,i)=>{
      const pair=q.pairs?.[i];
      if(!pair)return;
      const trigger=row.querySelector(".match-trigger");
      if(trigger){
        trigger.classList.add("answer-correct-reveal");
        trigger.innerHTML=`<span class="match-selected">${esc(pair.right??"")}</span><span class="match-chevron">✓</span>`;
        renderAllQuizMath(trigger);
      }
      row.classList.add("match-correct");
    });
    return;
  }

  if(q.type==="ordering"){
    const list=opts.querySelector(".ordering-list");
    if(list&&Array.isArray(q.answer)){
      list.innerHTML="";
      q.answer.forEach((item,i)=>{
        const b=document.createElement("div");
        b.className="order-item answer-correct-reveal";
        b.textContent=`${i+1}. ${item}`;
        list.appendChild(b);
      });
      renderAllQuizMath(list);
    }
    return;
  }

  if(q.type==="fill_blank"){
    const input=opts.querySelector(".fill-answer");
    if(input){
      input.value=String((q.acceptedAnswers||[q.answer])[0]??"");
      input.classList.add("answer-correct-reveal");
      input.readOnly=true;
      renderAllQuizMath(opts);
    }
    return;
  }

  // MCQ, True/False and Image Choice all use the option renderer.
  if(Array.isArray(q.options)){
    const correctIndex=getCorrectOptionIndex(q);
    opts.querySelectorAll(".option").forEach((b,i)=>{
      if(i===correctIndex)b.classList.add("correct","answer-correct-reveal");
      else b.classList.add("answer-not-correct");
    });
    // image_choice may use image cards instead of .option
    opts.querySelectorAll("[data-option-index]").forEach((b,i)=>{
      if(i===correctIndex)b.classList.add("correct","answer-correct-reveal");
      else b.classList.add("answer-not-correct");
    });
    renderAllQuizMath(opts);
  }
}

function checkCurrentAnswer(){
 if(!questions.length)return;
 const q=questions[current],chosen=answers[current];
 if(!answerIsPresent(chosen,q)){toast("Answer the question first");return}
 const wasChecked=checkedQuestions.has(current);
 checkedQuestions.add(current);
 if(!wasChecked&&mode==="practice")playAnswerSound(isQuestionCorrect(q,chosen));
 if(mode==="practice")render();
 else{
   const fb=document.getElementById("feedback");
   fb.textContent="✓ Answer recorded";fb.style.color="var(--muted)";fb.removeAttribute("data-result");
 }
 saveSessionSoon();
 flashKey("Enter");
}

function flashKey(key){
 const old=document.getElementById("keyboardFlash");
 if(old)old.remove();
 const el=document.createElement("div");
 el.id="keyboardFlash";
 el.textContent=key;
 el.style.cssText="position:fixed;left:50%;top:82px;transform:translateX(-50%);z-index:90;background:var(--text);color:var(--surface);padding:6px 10px;border-radius:8px;font:800 11px system-ui;opacity:.92;pointer-events:none";
 document.body.appendChild(el);
 setTimeout(()=>el.remove(),500);
}

setTimeout(()=>{if(document.getElementById("examProgressDrawer")?.classList.contains("open"))renderQuestionProgress()},0);
setInterval(()=>{if(document.getElementById("examProgressDrawer")?.classList.contains("open"))renderQuestionProgress()},250);

setInterval(()=>{
  if(!timerState || !timerState.running || examFinished)return;
  if(mode==="practice"){
    // Practice timer logic removed, but keeping the block in case of future extensions
  }else{
    if(timerState.examSeconds>0){
      timerState.examSeconds=Math.max(0,timerState.examSeconds-1);
      seconds=timerState.examSeconds;
      updateTimerUI();
      if(timerState.examSeconds%10===0)saveSessionSoon();
      if(timerState.examSeconds<=0)finishTest(true);
    }
  }
},1000);

window.addEventListener("beforeunload",saveSession);

if(typeof initPromptLibrary==="function")initPromptLibrary();
applySettings();timerState.examSeconds=seconds;timerState.practiceSeconds=5*60;timerState.running=false;updateTimerUI();render();renderSessions();renderDashboard();renderPlans();renderHome();renderTodos();

initPersistentBackup();
updatePersistentStorageInfo();
