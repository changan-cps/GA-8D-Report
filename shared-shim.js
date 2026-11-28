/* Shared runtime for GitHub Pages: reports, names and attachments are kept in your Supabase project,
   so everyone who opened the team link sees and edits the same 8D reports, live. No email, no password:
   the team link (site address + ?team=<key>) lets a browser straight in. A name is optional, added from the bar.
   Turned on by filling in config.js. With config.js empty, standalone-shim.js (this browser only) is used instead. */
(function(){
  var C=window.GA8D_CONFIG||{};
  if(!C.supabaseUrl||!C.supabaseAnonKey)return;
  if(window.claude&&window.claude.use)return;
  var LIB=C.supabaseJs||'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  var sb=null,me=null,myName='',started=false,readyRes,ready=new Promise(function(r){readyRes=r});
  function err(code,msg){var e=new Error(msg||code);e.code=code;return e}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  /* a database or storage error, in the codes the page already understands */
  function mapErr(e){var m=String(e&&(e.message||e.error||e)||''),c=String(e&&(e.code||e.statusCode||e.status)||'');
    if(/42501|row-level security|permission|not authorized|JWT|401|403/i.test(c+' '+m))return err('invalid_argument',m);
    if(/too large|413|exceeded the maximum/i.test(c+' '+m))return err('too_large',m);
    if(/quota|disk|53100|54000/i.test(c+' '+m))return err('quota_exceeded',m);
    return err('unavailable',m)}

  /* ---------- reports ---------- */
  var cache={},subs=[],chan=null,loadedOnce=false;
  function snap(){var ids=Object.keys(cache).sort();
    return{docs:ids.map(function(id){var d=cache[id];return{id:id,exists:true,data:function(){return clone(d)},metadata:{fromCache:false,hasPendingWrites:false}}}),
      size:ids.length,empty:!ids.length,metadata:{fromCache:false,hasPendingWrites:false}}}
  function emit(){var s=snap();subs.forEach(function(x){try{x.next(s)}catch(e){}})}
  function fail(e){subs.forEach(function(x){try{x.error&&x.error(e)}catch(_){}})}
  function loadAll(){return sb.from('reports').select('id,data').then(function(r){if(r.error)throw mapErr(r.error);
    var next={};(r.data||[]).forEach(function(row){next[row.id]=row.data});cache=next;loadedOnce=true;emit()})}
  function loadOne(id){return sb.from('reports').select('id,data').eq('id',id).maybeSingle().then(function(r){
    if(r.error)return;if(r.data)cache[id]=r.data.data;else delete cache[id];emit()})}
  function listen(){if(chan)return;
    chan=sb.channel('ga8d-reports').on('postgres_changes',{event:'*',schema:'public',table:'reports'},function(p){
      if(p.eventType==='DELETE'){if(p.old&&p.old.id){delete cache[p.old.id];emit()}}
      else if(p.new&&p.new.id)loadOne(p.new.id)})
    .subscribe(function(st){if(st==='SUBSCRIBED'&&loadedOnce)loadAll().catch(function(){})})}
  /* coming back to the tab or back online: catch up on anything missed */
  function catchUp(){if(sb&&me&&loadedOnce)loadAll().catch(function(){})}
  document.addEventListener('visibilitychange',function(){if(!document.hidden)catchUp()});
  window.addEventListener('online',catchUp);
  var db={collection:function(name){
    if(name!=='reports')throw new TypeError('only "reports" is stored here');
    return{onSnapshot:function(next,error){var s={next:next,error:error};subs.push(s);
        if(loadedOnce)setTimeout(function(){next(snap())},0);
        else loadAll().then(listen).catch(function(e){fail(e)});
        return function(){subs=subs.filter(function(x){return x!==s})}},
      doc:function(id){return{
        set:function(data){return sb.from('reports').upsert({id:id,data:data,updated_at:new Date().toISOString()}).then(function(r){
          if(r.error)throw mapErr(r.error);cache[id]=clone(data);emit()})},
        update:function(patch){return sb.rpc('ga8d_patch',{p_id:id,p_patch:patch}).then(function(r){
          if(r.error)throw mapErr(r.error);if(r.data===false)throw err('invalid_argument','no such report');return loadOne(id)})},
        delete:function(){return sb.from('reports').delete().eq('id',id).then(function(r){
          if(r.error)throw mapErr(r.error);delete cache[id];emit()})}}}}}};

  /* ---------- people ---------- */
  var names={};
  var user={id:function(){return Promise.resolve(me.id)},can:function(){return Promise.resolve(true)},
    isOwner:function(){return Promise.resolve(false)},canEdit:function(){return Promise.resolve(true)},
    profiles:function(ids){ids=[].concat(ids).filter(Boolean);var need=ids.filter(function(i){return !(i in names)});
      var q=need.length?sb.from('profiles').select('id,name').in('id',need).then(function(r){
        need.forEach(function(i){names[i]=''});(r.data||[]).forEach(function(p){names[p.id]=p.name||''})}):Promise.resolve();
      return q.then(function(){var m={};ids.forEach(function(i){m[i]={id:i,name:i===me.id?myName:(names[i]||''),isMe:i===me.id,guest:false}});return m})}};

  /* ---------- attachments ---------- */
  function hex32(){var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return('0'+x.toString(16)).slice(-2)}).join('')}
  var assets={
    upload:function(blob,o){var id=hex32(),type=(o&&o.type)||blob.type||'application/octet-stream';
      return sb.storage.from('attachments').upload(id,blob,{contentType:type,upsert:false}).then(function(r){
        if(r.error)throw mapErr(r.error);return{id:id,url:'',sizeBytes:blob.size,contentType:type}})},
    delete:function(id){return sb.storage.from('attachments').remove([id]).then(function(r){if(r.error)throw mapErr(r.error)})},
    blobOf:function(id){return sb.storage.from('attachments').download(id).then(function(r){
      if(r.error||!r.data)throw err('not_found','missing file');return r.data})}};

  var downloads={save:function(req){return new Promise(function(ok,no){try{
    var d=req.data,blob=d instanceof Blob?d:new Blob([d]),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=req.filename;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);ok({status:'saved'})}catch(e){no(err('unavailable','download failed'))}})}};

  window.claude={use:function(n){return ready.then(function(){
    return n==='db'?db:n==='user'?user:n==='downloads'?downloads:n==='assets'?assets:null})}};

  /* ---------- the welcome screen and the bar ---------- */
  var gate,bar;
  var CSS='#ga8d-gate{position:fixed;inset:0;z-index:50;background:var(--bg,#f3f5f8);display:grid;place-items:center;padding:24px;overflow:auto}'+
    '#ga8d-gate .card{background:var(--surface,#fff);border:1px solid var(--line,#d8dee6);border-radius:12px;padding:28px;width:min(420px,100%);display:flex;flex-direction:column;gap:14px;box-sizing:border-box}'+
    '#ga8d-gate h1{margin:0;font-size:1.4rem}#ga8d-gate p{margin:0;color:var(--muted,#5b6878);font-size:.92rem;line-height:1.55}'+
    '#ga8d-gate label{display:flex;flex-direction:column;gap:6px;font-size:.8rem;font-weight:600;color:var(--muted,#5b6878)}'+
    '#ga8d-gate input{font:inherit;font-size:1rem;padding:10px 12px;border:1px solid var(--field,#7a889b);border-radius:8px;background:var(--surface,#fff);color:var(--fg,#17212e)}'+
    '#ga8d-gate .msg{min-height:1.2em;font-size:.88rem;color:var(--bad,#b3261e)}'+
    '#ga8d-bar{font:13px/1.5 var(--body,system-ui,sans-serif);background:var(--accent-soft,#e4eefb);color:var(--fg,#17212e);border-bottom:1px solid var(--line,#d8dee6);padding:8px max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}'+
    '#ga8d-bar .acts{display:flex;gap:8px;margin-left:auto;align-items:center;flex-wrap:wrap}#ga8d-bar form{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto}'+
    '#ga8d-bar input{font:inherit;padding:6px 8px;border:1px solid var(--field,#7a889b);border-radius:6px;background:var(--surface,#fff);color:var(--fg,#17212e)}';
  function mountStyle(){var s=document.createElement('style');s.textContent=CSS;document.head.appendChild(s)}
  function card(html){if(!gate){gate=document.createElement('div');gate.id='ga8d-gate';document.body.appendChild(gate)}gate.hidden=false;gate.innerHTML='<div class="card">'+html+'</div>';return gate.firstChild}
  function hideGate(){if(gate)gate.hidden=true}
  function needLink(why){card('<h1>8D Reports</h1><p role="alert">'+(why||'Open this site with the team link you were sent. The link lets you in; there is no password.')+'</p><p>No link? Ask the person who runs the 8D site to send it to you.</p>')}
  function askName(then){var c=card('<form novalidate style="display:contents"><h1>Welcome to the 8D reports</h1><p>Type your name once. Your team sees it on the reports and actions you work on.</p>'+
      '<label>Your name<input name="nm" autocomplete="name" maxlength="80" required></label><button class="btn primary" type="submit">Continue</button><div class="msg" role="status"></div></form>');
    var f=c.querySelector('form');f.nm.focus();
    f.onsubmit=function(ev){ev.preventDefault();var v=f.nm.value.trim().slice(0,80),msg=f.querySelector('.msg');if(!v){msg.textContent='Type your name to continue.';return}
      f.querySelector('button').disabled=true;sb.from('profiles').upsert({id:me.id,name:v}).then(function(r){
        if(r.error){f.querySelector('button').disabled=false;msg.textContent='Could not save your name. Check your connection and try again.';return}
        myName=v;names[me.id]=v;then()})}}
  function renderBar(note){if(!bar){bar=document.createElement('div');bar.id='ga8d-bar';document.body.insertBefore(bar,document.body.firstChild)}
    bar.innerHTML='<span><b>Shared 8D reports.</b> Everyone with the team link sees the same reports<span id="ga8d-you"></span>.</span>'+
      '<span class="acts"><span id="ga8d-msg" role="status"></span><button type="button" class="btn" id="ga8d-name">'+(myName?'Change name':'Add your name (optional)')+'</button></span>';
    if(myName)bar.querySelector('#ga8d-you').textContent='. You appear as '+myName;bar.querySelector('#ga8d-msg').textContent=note||'';
    bar.querySelector('#ga8d-name').onclick=function(){var acts=bar.querySelector('.acts'),f=document.createElement('form');
      f.innerHTML='<input aria-label="Your name" placeholder="Your name" maxlength="80"><button class="btn primary" type="submit">Save</button><button class="btn" type="button">Cancel</button>';
      var i=f.querySelector('input');i.value=myName;f.querySelectorAll('button')[1].onclick=function(){renderBar()};
      f.onsubmit=function(ev){ev.preventDefault();var v=i.value.trim().slice(0,80);if(!v||v===myName){renderBar();return}
        sb.from('profiles').upsert({id:me.id,name:v}).then(function(r){if(r.error){renderBar('Name not saved. Try again.');return}
          myName=v;names[me.id]=v;renderBar('Name saved.');if(typeof window.fillNames==='function')window.fillNames()})};
      acts.replaceWith(f);i.focus();i.select()}}
  function open(){hideGate();renderBar();if(!started){started=true;readyRes()}else loadAll().catch(function(){})}
  /* in: load this person's name, ask for it the first time */
  function enter(u){me=u;sb.from('profiles').select('name').eq('id',u.id).maybeSingle().then(function(r){
    myName=(r.data&&r.data.name)||'';open()},function(){open()})}
  function teamKey(){var m=location.search.match(/[?&]team=([A-Za-z0-9_-]{8,128})/);return m?m[1]:''}
  function dropKey(){var q=location.search.replace(/([?&])team=[^&]*&?/,'$1').replace(/[?&]$/,'');history.replaceState(null,'',location.pathname+q+location.hash)}
  function joinWith(key){return sb.rpc('ga8d_join',{p_key:key}).then(function(r){if(r.error)throw r.error;return r.data===true})}
  function start(){var key=teamKey();
    sb.auth.getSession().then(function(r){var s=r.data&&r.data.session;
      /* a visitor without the team link is not signed in at all, so strangers create nothing in the project */
      if(!s&&!key)return needLink();
      return(s?Promise.resolve(s.user):sb.auth.signInAnonymously().then(function(a){if(a.error)throw a.error;return a.data.user})).then(function(u){
        me=u;
        if(key)return joinWith(key).then(function(ok){dropKey();if(!ok)return needLink('This team link is not valid any more. Ask for the latest link.');enter(u)});
        return sb.rpc('ga8d_member').then(function(m){if(m.data===true)enter(u);else needLink()})})})
    .catch(function(e){var m=String(e&&e.message||'');
      needLink(/anonymous/i.test(m)?'The site is not set up yet: anonymous sign-ins are turned off in Supabase.':'The 8D data service did not answer. Check your internet connection, then reload this page.')})}
  function boot(){mountStyle();
    if(!window.supabase||!window.supabase.createClient){var s=document.createElement('script');s.src=LIB;
      s.onload=go;s.onerror=function(){needLink('The 8D data service could not be loaded. Check your internet connection, then reload this page.')};document.head.appendChild(s)}
    else go()}
  function go(){sb=window.supabase.createClient(C.supabaseUrl,C.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'ga8d-auth'}});start()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
