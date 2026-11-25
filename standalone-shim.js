/* Standalone runtime for GitHub Pages. Gives the page the three things claude.ai normally provides:
   db (documents kept in this browser's localStorage), user (one local user) and downloads (browser file save). */
(function(){
  if(window.claude&&window.claude.use)return;
  var KEY='ga8d:reports',listeners=[];
  function load(){try{var o=JSON.parse(localStorage.getItem(KEY)||'{}');return o&&typeof o==='object'?o:{}}catch(e){return{}}}
  function save(o){try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){var er=new Error('storage');er.code='quota_exceeded';throw er}}
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function isObj(v){return v&&typeof v==='object'&&!Array.isArray(v)}
  function merge(dst,src){Object.keys(src).forEach(function(k){if(isObj(src[k])&&isObj(dst[k]))merge(dst[k],src[k]);else dst[k]=clone(src[k])})}
  function snap(){var all=load(),ids=Object.keys(all).sort();
    return{docs:ids.map(function(id){var d=all[id];return{id:id,exists:true,data:function(){return clone(d)},metadata:{fromCache:false,hasPendingWrites:false}}}),
      size:ids.length,empty:!ids.length,metadata:{fromCache:false,hasPendingWrites:false}}}
  function notify(){listeners.forEach(function(f){try{f(snap())}catch(e){}})}
  window.addEventListener('storage',function(e){if(e.key===KEY)notify()});
  function fail(code,msg){var e=new Error(msg||code);e.code=code;return Promise.reject(e)}
  var db={collection:function(name){
    if(name!=='reports')throw new TypeError('only "reports" is stored here');
    return{onSnapshot:function(next){listeners.push(next);setTimeout(function(){next(snap())},0);return function(){listeners=listeners.filter(function(f){return f!==next})}},
      doc:function(id){return{
        set:function(data){try{var all=load();all[id]=clone(data);save(all)}catch(e){return Promise.reject(e)}notify();return Promise.resolve()},
        update:function(patch){var all=load();if(!all[id])return fail('invalid_argument','no such document');try{merge(all[id],patch);save(all)}catch(e){return Promise.reject(e)}notify();return Promise.resolve()},
        delete:function(){var all=load();delete all[id];try{save(all)}catch(e){return Promise.reject(e)}notify();return Promise.resolve()}}}}}};
  var me={id:'u_local',name:'You',isMe:true};
  var user={id:function(){return Promise.resolve(me.id)},can:function(){return Promise.resolve(true)},isOwner:function(){return Promise.resolve(true)},canEdit:function(){return Promise.resolve(true)},
    profiles:function(ids){var m={};[].concat(ids).forEach(function(i){m[i]={id:i,name:i===me.id?me.name:'',isMe:i===me.id,guest:false}});return Promise.resolve(m)}};
  var downloads={save:function(req){return new Promise(function(ok,no){try{
    var d=req.data,blob=d instanceof Blob?d:new Blob([d]),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=req.filename;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);ok({status:'saved'})}catch(e){var er=new Error('download failed');er.code='unavailable';no(er)}})}};
  window.claude={use:function(n){return Promise.resolve(n==='db'?db:n==='user'?user:n==='downloads'?downloads:null)}};

  /* a bar that says where the data lives, with export and import of all reports as one JSON file */
  document.addEventListener('DOMContentLoaded',function(){
    var bar=document.createElement('div');bar.id='localbar';
    bar.style.cssText='font:13px/1.5 var(--body,system-ui,sans-serif);background:var(--warn-soft,#fbefd3);color:var(--fg,#17212e);border-bottom:1px solid var(--warn,#9a6200);padding:8px max(16px,env(safe-area-inset-left,0px));display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center';
    bar.innerHTML='<span><b>Standalone version.</b> Reports are saved in this browser only, on this device. Use Export to move them or keep a copy.</span>'+
      '<span style="display:flex;gap:8px;margin-left:auto;align-items:center"><span id="localmsg" role="status"></span>'+
      '<button type="button" id="lb-exp" class="btn">Export all (JSON)</button><label class="btn" style="cursor:pointer">Import<input id="lb-imp" type="file" accept="application/json,.json" hidden></label></span>';
    document.body.insertBefore(bar,document.body.firstChild);
    /* the page's copy describes the shared team version; here nothing is shared, so say what is true */
    var sub=document.querySelector('#v-list .brand .note');
    if(sub)sub.textContent='8D reports saved in this browser. Only you see them, on this device.';
    var emp=document.getElementById('l-empty');
    function fixEmpty(){emp.querySelectorAll('p').forEach(function(p){if(/Reports your team opens/.test(p.textContent))p.textContent=p.textContent.replace('Reports your team opens appear here','Reports you create appear here')})}
    if(emp){fixEmpty();new MutationObserver(fixEmpty).observe(emp,{childList:true,subtree:true})}
    var msg=bar.querySelector('#localmsg');
    bar.querySelector('#lb-exp').onclick=function(){var n=Object.keys(load()).length;if(!n){msg.textContent='Nothing to export yet.';return}
      downloads.save({filename:'8d-reports-'+new Date().toISOString().slice(0,10)+'.json',data:JSON.stringify({app:'ga-8d',version:1,reports:load()},null,1)}).then(function(){msg.textContent='Exported '+n+' report'+(n===1?'':'s')+'.'})};
    bar.querySelector('#lb-imp').onchange=function(e){var f=e.target.files[0];e.target.value='';if(!f)return;
      var r=new FileReader();r.onload=function(){try{var j=JSON.parse(r.result);if(!j||j.app!=='ga-8d'||!isObj(j.reports))throw 0;
        var all=load(),n=0;Object.keys(j.reports).forEach(function(id){if(isObj(j.reports[id])){all[id]=j.reports[id];n++}});save(all);notify();msg.textContent='Imported '+n+' report'+(n===1?'':'s')+'. Reports with the same id were replaced.'}catch(x){msg.textContent='That file is not an 8D export.'}};r.readAsText(f)};
  });
})();
