'use strict';
(()=>{
  const VERSION='3.1.0', LEGACY_KEY='machete.v2', OLD='machete.v1';
  let authUser=null;
  const storageKey=()=>authUser?'machete.v3.'+authUser.uid:null;
  const photoKey=key=>authUser?authUser.uid+'::'+key:null;
  const $=s=>document.querySelector(s), screen=$('#screen'), overlay=$('#overlay'), toastNode=$('#toast');
  const emptyState=()=>({orders:[],watchlist:[],meta:{},theme:'dark',importedAt:null});
  let view='home', productKey=null, query='', year='all', kind='all', sort='recent', toastTimer=0, photoUrls=[];
  const uniqueId=()=>crypto?.randomUUID?.()||'m'+Date.now()+Math.random().toString(16).slice(2);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const money=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):'—';
  const shortDate=s=>s?String(s).slice(0,10):'Unknown date';
  const num=(x,defaultValue=null)=>{
    if(typeof x==='number')return Number.isFinite(x)?x:defaultValue;
    const s=String(x??'').replace(/[, $']/g,'').trim();
    if(!s||/not available|not applicable|^na$/i.test(s))return defaultValue;
    const v=Number(s);return Number.isFinite(v)?v:defaultValue;
  };
  const slug=s=>String(s??'').toLowerCase().replace(/\s+/g,' ').trim();
  const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);};
  const asinOk=s=>/^[A-Z0-9]{10}$/.test(String(s||'').toUpperCase());
  const productId=(asin,title)=>asinOk(asin)?String(asin).toUpperCase():'title-'+hash(slug(title));
  const amazonUrl=asin=>asinOk(asin)?'https://www.amazon.com/dp/'+encodeURIComponent(asin):null;
  const photoUrl=url=>{try{const u=new URL(String(url||''));return u.protocol==='https:'&&u.username===''&&u.password===''&&/^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
  function normalizeState(x){
    if(!x||!Array.isArray(x.orders)||!Array.isArray(x.watchlist))return emptyState();
    return {
      orders:x.orders.filter(o=>o&&typeof o.id==='string'&&typeof o.title==='string').slice(0,50000),
      watchlist:x.watchlist.filter(w=>w&&typeof w.id==='string').slice(0,3000),
      meta:x.meta&&typeof x.meta==='object'&&!Array.isArray(x.meta)?x.meta:{},
      theme:x.theme==='light'?'light':'dark',importedAt:x.importedAt||null
    };
  }
  function load(){
    if(!authUser)return emptyState();
    try{return normalizeState(JSON.parse(localStorage.getItem(storageKey())));}
    catch(err){console.warn('Machete account data could not be opened',err);return emptyState();}
  }
  let state=emptyState();
  const save=()=>{
    if(!authUser){toast('Sign in to save your changes.');return false;}
    try{localStorage.setItem(storageKey(),JSON.stringify(state));return true;}
    catch(e){toast('Cannot save. Device storage may be full; export a backup.');return false;}
  };
  function oldDeviceData(){
    try{
      const current=JSON.parse(localStorage.getItem(LEGACY_KEY));
      if(current&&Array.isArray(current.orders)&&Array.isArray(current.watchlist))return normalizeState(current);
      const prev=JSON.parse(localStorage.getItem(OLD));
      if(prev&&Array.isArray(prev.items)){
        const result=emptyState();result.theme=prev.theme==='light'?'light':'dark';
        result.watchlist=prev.items.filter(w=>w&&asinOk(w.asin)).map(w=>({
          id:w.id||uniqueId(),asin:w.asin,title:w.title||'Amazon product '+w.asin,
          target:num(w.targetPrice),createdAt:w.createdAt||new Date().toISOString()
        }));
        return result;
      }
    }catch(err){console.warn('Existing unclaimed data could not be parsed',err);}
    return null;
  }
  function legacyBanner(){
    const old=oldDeviceData();
    if(!old||(old.orders.length===0&&old.watchlist.length===0))return '';
    return section('Previous device history',
      '<div class="card"><h3>Existing Machete data found on this device</h3>'+
      '<p>This history was saved before Google sign-in was added. Choose which Google account it belongs to. It will not be moved automatically.</p>'+
      '<div class="actions"><button type="button" class="button" data-action="claim-history">Attach to this account</button>'+
      '<button type="button" class="button secondary" data-action="dismiss-legacy">Not now</button></div></div>');
  }
  async function claimLegacy(){
    if(!authUser)return;
    const owningUid=authUser.uid;
    const old=oldDeviceData();
    if(!old)return toast('No previous history was found.');
    if(!confirm('Attach the existing on-device history to '+authUser.email+'? This account will own the local copy.'))return;
    const previous=state;
    const byId=new Map(state.orders.map(o=>[o.id,o]));
    for(const order of old.orders)if(!byId.has(order.id))byId.set(order.id,order);
    const watches=new Map(state.watchlist.map(w=>[w.asin,w]));
    for(const w of old.watchlist)if(!watches.has(w.asin))watches.set(w.asin,w);
    state={orders:Array.from(byId.values()),watchlist:Array.from(watches.values()),
      meta:{...old.meta,...state.meta},theme:state.theme,
      importedAt:state.importedAt||old.importedAt};
    if(!save()){state=previous;return;}
    // Copy previously selected photos into this account's namespaced image store.
    const keys=new Set([...Object.keys(old.meta),
      ...old.orders.map(o=>o.key),...old.watchlist.map(w=>productId(w.asin,w.title))]);
    let copied=0;
    for(const key of keys){
      try{
        if(authUser?.uid!==owningUid)break;
        const photo=await getPhotoRaw(key);
        if(authUser?.uid!==owningUid)break;
        if(photo){await putPhoto(key,photo);copied++;}
      }catch(err){console.warn('Could not migrate one local product photo',err);}
    }
    if(authUser?.uid!==owningUid)return;
    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(OLD);
    render();
    toast('Previous history attached to your Google account'+(copied?' with '+copied+' photos':'')+'.');
  }
  function toast(msg){toastNode.textContent=msg;toastNode.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastNode.classList.remove('show'),3600);}
  const isSpend=o=>o.status==='completed'||o.status==='refunded';
  const paid=o=>o.status==='refunded'?(o.total||0):o.status==='completed'?(o.total||0):0;
  const items=()=>state.orders.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const getProduct=k=>state.orders.filter(o=>o.key===k&&o.kind!=='refund').sort((a,b)=>a.date.localeCompare(b.date));
  const getMeta=k=>state.meta[k]||{};
  const products=()=>{
    const map=new Map();
    for(const o of state.orders){
      if(o.kind==='refund')continue;
      const cur=map.get(o.key)||{key:o.key,asin:o.asin,title:o.title,count:0,qty:0,last:'',prices:[],spent:0};
      cur.count+=o.status==='completed'?1:0;
      cur.qty+=o.status==='completed'?o.qty:0;
      cur.last=o.date>cur.last?o.date:cur.last;
      if(o.status==='completed'){
        if(Number.isFinite(o.unitPrice))cur.prices.push(o.unitPrice);
        cur.spent+=paid(o);
      }
      if(o.date===cur.last)cur.title=o.title;
      map.set(o.key,cur);
    }
    for(const w of state.watchlist){
      const k=productId(w.asin,w.title);
      if(!map.has(k))map.set(k,{key:k,asin:w.asin,title:w.title,count:0,qty:0,last:'',prices:[],spent:0});
    }
    return Array.from(map.values()).sort((a,b)=>b.last.localeCompare(a.last));
  };
  function syncTheme(){
    $('html').dataset.theme=state.theme;
    $('meta[name="theme-color"]').content=state.theme==='light'?'#f4f3ef':'#101416';
  }
  function image(k,klass=''){
    const meta=getMeta(k), url=photoUrl(meta.imageUrl);
    return '<div class="'+(klass||'thumb')+'" data-image-wrap="'+esc(k)+'">'+
      '<span class="art-fallback" aria-hidden="true">m.</span>'+
      '<img alt="" loading="eager" style="display:none" data-img-key="'+esc(k)+'" '+(url?'data-remote-img="'+esc(url)+'"':'')+'></div>';
  }
  function attachImages(){
    const thisUid=authUser?.uid||'';
    const titles=new Map();
    for(const o of state.orders)if(o?.key&&!titles.has(o.key))titles.set(o.key,o.title);
    for(const w of state.watchlist){
      const k=productId(w.asin,w.title);
      if(!titles.has(k))titles.set(k,w.title);
    }
    for(const img of document.querySelectorAll('[data-img-key]')){
      const key=img.dataset.imgKey, fallback=img.parentElement.querySelector('.art-fallback');
      const reveal=()=>{
        if(!img.isConnected||authUser?.uid!==thisUid)return;
        img.style.display='block';if(fallback)fallback.style.display='none';
        if(img.dataset.photoSource){
          const label=document.getElementById('auto-photo-source');
          if(label)label.textContent='Product photo matched through '+img.dataset.photoSource+'.';
        }
      };
      img.addEventListener('load',reveal);
      img.addEventListener('error',()=>{
        img.style.display='none';
        if(fallback)fallback.style.display='block';
        if(img.dataset.photoSource){
          window.MachetePhotos?.clear?.(key);
          delete img.dataset.photoSource;
        }
      });
      if(img.dataset.remoteImg){
        img.dataset.manualPicture='yes';
        img.referrerPolicy='no-referrer';
        img.src=img.dataset.remoteImg;
      }else getPhoto(key).then(blob=>{
        if(!img.isConnected||authUser?.uid!==thisUid)return;
        if(blob){
          img.dataset.manualPicture='yes';
          const url=URL.createObjectURL(blob);
          photoUrls.push(url);img.src=url;
        }else{
          window.MachetePhotos?.observe?.(img,key,titles.get(key)||'');
        }
      }).catch(()=>{
        if(img.isConnected&&authUser?.uid===thisUid)
          window.MachetePhotos?.observe?.(img,key,titles.get(key)||'');
      });
    }
  }
  function releaseImages(){for(const u of photoUrls)URL.revokeObjectURL(u);photoUrls=[];}
  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('Image storage is unavailable here.'));
      const request=indexedDB.open('machete-images',1);
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images');};
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function getPhotoRaw(key){
    if(!key)return null;
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('images','readonly');
      const req=tx.objectStore('images').get(key);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();
    });
  }
  async function getPhoto(key){return getPhotoRaw(photoKey(key));}
  async function putPhoto(key,blob){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('images','readwrite');
      tx.objectStore('images').put(blob,photoKey(key));
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  async function resizePhoto(file){
    if(file.size>12000000)throw Error('Choose an image smaller than 12 MB.');
    const source=await createImageBitmap(file);
    const scale=Math.min(1,480/Math.max(source.width,source.height));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(source.width*scale));c.height=Math.max(1,Math.round(source.height*scale));
    c.getContext('2d').drawImage(source,0,0,c.width,c.height);source.close?.();
    return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Cannot process image.')),'image/jpeg',.78));
  }
  function headline(kicker,title,sub){return '<section><p class="kicker">'+esc(kicker)+'</p><h1 class="page-title">'+title+'</h1><p class="sub">'+esc(sub)+'</p></section>';}
  function importButton(label='Import Amazon history'){return '<button type="button" class="button" data-action="import">'+esc(label)+'</button>';}
  function empty(title,desc,action=''){return '<div class="empty"><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p>'+(action?'<div class="actions" style="justify-content:center">'+action+'</div>':'')+'</div>';}
  const section=(name,inside,side='')=>'<section class="section"><div class="section-head"><h2>'+esc(name)+'</h2>'+side+'</div>'+inside+'</section>';
  function moneyStats(){
    const completed=state.orders.filter(o=>o.status==='completed');
    const refunds=state.orders.filter(o=>o.status==='refunded');
    return {spent:completed.reduce((t,o)=>t+(o.total||0),0)+refunds.reduce((t,o)=>t+(o.total||0),0),
      count:completed.length,unique:new Set(completed.map(o=>o.key)).size,refunds:refunds.length};
  }
  function yearlyChart(){
    const sums=new Map();
    for(const o of state.orders)if(isSpend(o)&&o.date){
      const y=o.date.slice(0,4);sums.set(y,(sums.get(y)||0)+paid(o));
    }
    const rows=Array.from(sums).sort((a,b)=>a[0].localeCompare(b[0]));
    if(!rows.length)return '<p class="small muted">Import a history file to see your purchasing timeline.</p>';
    const max=Math.max(1,...rows.map(x=>x[1]));
    return rows.map(([y,value])=>'<div class="row" style="margin:9px 0;gap:11px"><span style="font-size:11px;color:var(--muted);width:36px">'+esc(y)+'</span><div style="background:var(--panel2);border-radius:6px;flex:1;height:11px;overflow:hidden"><div style="background:var(--accent);height:100%;width:'+Math.max(0,100*value/max).toFixed(1)+'%"></div></div><span style="width:75px;text-align:right;font-size:11px;font-weight:800">'+money(value)+'</span></div>').join('');
  }
  function home(){
    const m=moneyStats(), recent=items().filter(o=>o.status==='completed').slice(0,4);
    return '<section class="hero"><p class="kicker">Machete · '+VERSION+'</p><h1 class="page-title">Know what you paid.</h1><p class="sub">Your Amazon history, real purchase prices, and a better way to compare what things cost.</p>'+
      '<div class="actions">'+importButton(state.orders.length?'Update history':'Import your history')+'<button class="button secondary" type="button" data-view="products">Browse products</button></div></section>'+
      '<div class="metrics"><div class="metric"><div class="metric-value">'+money(m.spent)+'</div><div class="metric-label">Net exported spend</div></div><div class="metric"><div class="metric-value">'+m.count+'</div><div class="metric-label">Completed item entries</div></div><div class="metric"><div class="metric-value">'+m.unique+'</div><div class="metric-label">Unique products bought</div></div></div>'+
      legacyBanner()+section('Spending by year','<div class="card">'+yearlyChart()+'<p class="note">Completed retail and digital item totals, minus recorded refunds. Not a bank reconciliation.</p></div>')+
      section('Recent purchases',recent.length?'<div class="history-list">'+recent.map(historyCard).join('')+'</div>':empty('Your history is empty','Import the original Amazon Your Orders.zip file directly. It stays in this browser.',importButton()),'<button class="button quiet" data-view="history">View all</button>')+
      section('Import progress','<div class="card"><h3>'+(state.importedAt?'Last imported '+esc(shortDate(state.importedAt)):'Ready for your first import')+'</h3><p>Import an updated file whenever you receive one. Previous entries are deduplicated, so you keep a rolling history without OCR.</p><div class="actions">'+importButton('Choose ZIP or CSV')+'</div></div>');
  }
  function historyCard(o){
    const label=o.status==='refunded'?'Refund':o.status==='cancelled'?'Cancelled':o.status==='pending'?'Pending':o.kind==='digital'?'Digital':'Purchase';
    return '<article class="card history-item">'+image(o.key)+
      '<div class="history-info"><h3 class="history-title"><button type="button" data-product="'+esc(o.key)+'">'+esc(o.title)+'</button></h3>'+
      '<div class="history-meta">'+esc(shortDate(o.date))+' · '+esc(label)+' · qty '+esc(o.qty)+
      (Number.isFinite(o.unitPrice)?'<br>Amazon unit price '+money(o.unitPrice):'')+
      (o.orderId?'<br>Order '+esc(o.orderId):'')+'</div></div>'+
      '<div class="history-amount'+(o.status==='refunded'?' refund':'')+'">'+money(o.total)+'<span>'+esc(o.kind)+'</span></div></article>';
  }
  function getFilteredHistory(){
    const q=slug(query);
    return items().filter(o=>(year==='all'||o.date.startsWith(year))&&(kind==='all'||o.kind===kind)&&(!q||slug(o.title+' '+o.asin+' '+o.orderId).includes(q)));
  }
  function filterControls(type){
    const years=Array.from(new Set(state.orders.map(x=>x.date.slice(0,4)).filter(Boolean))).sort().reverse();
    return '<div class="toolbar"><input type="search" id="search" placeholder="Search products or orders" value="'+esc(query)+'" aria-label="Search history">'+
      (type==='history'?'<select id="year-filter" aria-label="Filter by year"><option value="all">All years</option>'+years.map(y=>'<option '+(year===y?'selected':'')+' value="'+esc(y)+'">'+esc(y)+'</option>').join('')+'</select>'+
      '<select id="kind-filter" aria-label="Filter by type"><option value="all">All types</option>'+[['retail','Retail'],['digital','Digital'],['refund','Refund']].map(([v,label])=>'<option '+(kind===v?'selected':'')+' value="'+v+'">'+label+'</option>').join('')+'</select>':'<select id="sort-products" aria-label="Sort products"><option value="recent" '+(sort==='recent'?'selected':'')+'>Recent</option><option value="name" '+(sort==='name'?'selected':'')+'>Name</option><option value="spent" '+(sort==='spent'?'selected':'')+'>Most spent</option><option value="repeat" '+(sort==='repeat'?'selected':'')+'>Most bought</option></select>')+'</div>';
  }
  function history(){
    return headline('Your records','Purchase history<span style="color:var(--accent)">.</span>','Every exported item, refund, and recorded purchase price — not a continuous Amazon market price feed.')+
      section('All entries',filterControls('history')+'<div id="filtered-list">'+renderHistoryList()+'</div>','<span class="tag">'+state.orders.length+' records</span>')+
      section('Rolling updates','<div class="card"><h3>Update without duplicates</h3><p>Reimport Amazon’s newer order ZIP when it is available. Machete compares each entry to those already saved.</p><div class="actions">'+importButton('Import newer export')+'</div></div>');
  }
  function renderHistoryList(){
    const result=getFilteredHistory();
    return result.length?'<p class="note" style="margin:0 0 10px">'+result.length+' matching entries</p><div class="history-list">'+result.map(historyCard).join('')+'</div>':
      empty('No matching orders','Change your filters or import your Amazon purchase history.',!state.orders.length?importButton():'');
  }
  function productCard(p){
    const meta=getMeta(p.key), target=Number.isFinite(meta.target)?meta.target:null, lowest=p.prices.length?Math.min(...p.prices):null;
    const picture=image(p.key,'product-art');
    return '<button type="button" class="product-card" data-product="'+esc(p.key)+'">'+picture+'<div class="product-content">'+
      '<div class="product-name">'+esc(p.title)+'</div><div class="product-stat">'+(lowest!=null?'Lowest paid '+money(lowest):'Not purchased yet')+'</div>'+
      '<div class="product-caption">'+(p.count?p.count+' purchase'+(p.count===1?'':'s'):'Watchlist')+(target!=null?' · Target '+money(target):'')+'</div></div></button>';
  }
  function getFilteredProducts(){
    const q=slug(query);
    const arr=products().filter(p=>!q||slug(p.title+' '+p.asin).includes(q));
    if(sort==='name')arr.sort((a,b)=>a.title.localeCompare(b.title));
    if(sort==='spent')arr.sort((a,b)=>b.spent-a.spent);
    if(sort==='repeat')arr.sort((a,b)=>b.count-a.count);
    return arr;
  }
  function renderProductList(){
    const result=getFilteredProducts();
    return result.length?'<div class="product-grid">'+result.map(productCard).join('')+'</div>':
      empty('No matching products','Import your Amazon order ZIP or add a product to your watchlist.',importButton());
  }
  function productsView(){
    return headline('Catalog','Products<span style="color:var(--accent)">.</span>','See every unique purchased item and your saved watchlist, with photos where available.')+
      section('Your product catalog',filterControls('products')+'<div id="filtered-list">'+renderProductList()+'</div>','<span class="tag">'+products().length+' products</span>')+
      section('Add a product to watch','<form id="watch-form" class="card"><div class="field"><label for="watch-url">Amazon.com product link</label><input id="watch-url" type="url" required placeholder="https://www.amazon.com/dp/..."></div><div class="actions"><button type="submit" class="button">Add to watchlist</button></div></form>');
  }
  function trendChart(rows){
    const pts=rows.filter(x=>x.status==='completed'&&Number.isFinite(x.unitPrice)&&x.date);
    if(!pts.length)return '<div class="chart-empty">No purchase-price observations for this product.</div>';
    const w=620,h=220,pad=27, values=pts.map(x=>x.unitPrice);
    const minValue=Math.min(...values),maxValue=Math.max(...values),range=Math.max(.01,maxValue-minValue),yMin=Math.max(0,minValue-range*.16),yMax=maxValue+range*.16;
    const times=pts.map(x=>new Date(x.date).getTime()).map(x=>Number.isFinite(x)?x:0);
    const start=Math.min(...times),end=Math.max(...times);
    const xx=x=>pad+(end===start?(w-2*pad)/2:(x-start)/(end-start)*(w-2*pad));
    const yy=v=>pad+(1-(v-yMin)/(yMax-yMin))*(h-2*pad);
    const coords=pts.map((x,i)=>[xx(times[i]),yy(x.unitPrice)]);
    const line=coords.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    return '<div class="chart"><p class="chart-label">Price paid per sold item (before tax)</p>'+
      '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Prices paid on purchase dates"><path d="M'+pad+','+(h-pad)+'H'+(w-pad)+'" stroke="var(--line)" fill="none"/>'+
      '<path d="M'+pad+','+pad+'V'+(h-pad)+'" stroke="var(--line)" fill="none"/>'+
      '<text x="3" y="'+(pad+3)+'" font-size="11" fill="var(--muted)">'+esc(money(maxValue))+'</text>'+
      '<text x="3" y="'+(h-8)+'" font-size="11" fill="var(--muted)">'+esc(money(minValue))+'</text>'+
      (pts.length>1?'<path d="'+line+'" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/>':'')+
      pts.map((x,i)=>'<circle cx="'+coords[i][0].toFixed(1)+'" cy="'+coords[i][1].toFixed(1)+'" r="5" fill="var(--accent)"><title>'+esc(shortDate(x.date)+' · '+money(x.unitPrice))+'</title></circle>').join('')+'</svg>'+
      '<div class="chart-footer"><span>'+esc(shortDate(pts[0].date))+'</span><span>'+esc(shortDate(pts[pts.length-1].date))+'</span></div></div>'+
      '<p class="note">Dots represent purchases only. No price is inferred between orders.</p>';
  }
  function details(){
    const rows=getProduct(productKey),p=products().find(p=>p.key===productKey), w=state.watchlist.find(x=>productId(x.asin,x.title)===productKey);
    if(!p)return productsView();
    const meta=getMeta(productKey),lowest=rows.filter(o=>o.status==='completed'&&Number.isFinite(o.unitPrice));
    const last=lowest.length?lowest[lowest.length-1].unitPrice:null;
    const min=lowest.length?Math.min(...lowest.map(o=>o.unitPrice)):null;
    const per=Number(meta.packageUnits)>0&&last!=null?last/Number(meta.packageUnits):null;
    return '<button type="button" class="back" data-view="products">‹ Back to products</button>'+
      '<div class="detail-heading">'+image(p.key,'detail-cover')+'<div><h1>'+esc(meta.displayName||p.title)+'</h1>'+
      '<p>'+(p.asin?'ASIN '+esc(p.asin):'Imported title only')+' · '+(p.count||0)+' completed purchases</p>'+
      (amazonUrl(p.asin)?'<a class="small" target="_blank" rel="noopener noreferrer" href="'+amazonUrl(p.asin)+'">View on Amazon</a>':'')+'</div></div>'+
      '<div class="detail-metrics"><div class="detail-stat"><b>'+money(min)+'</b><span>Lowest price you paid (pre-tax)</span></div>'+
      '<div class="detail-stat"><b>'+money(last)+'</b><span>Last purchase price (pre-tax)</span></div>'+
      '<div class="detail-stat"><b>'+money(per)+'</b><span>Last price per '+esc(meta.unitLabel||'contained unit')+'</span></div>'+
      '<div class="detail-stat"><b>'+money(p.spent)+'</b><span>Total recorded spend on item</span></div></div>'+
      section('Price paid over time','<div class="card">'+trendChart(rows)+'</div>')+
      '<p id="auto-photo-source" class="photo-source-hint">'+
      (window.MachetePhotos?.attribution?.(productKey)?.source?
        'Product photo matched through '+esc(window.MachetePhotos.attribution(productKey).source)+'.':
        'Automatic photos appear for verified matches. You can override them below.')+
      '</p>'+
      section('Package and picture','<form id="meta-form" class="card"><div class="form-grid">'+
      '<div class="field"><label for="package-units">Units inside one purchased item</label><input type="number" id="package-units" min=".01" max="1000000" step="any" inputmode="decimal" value="'+esc(meta.packageUnits||'')+'" placeholder="e.g. 24"></div>'+
      '<div class="field"><label for="unit-label">Unit label</label><input id="unit-label" maxlength="25" value="'+esc(meta.unitLabel||'')+'" placeholder="bottle, oz, count…"></div>'+
      '<div class="field"><label for="target-price">Your target price per purchased item</label><input type="number" id="target-price" min=".01" max="1000000" step=".01" inputmode="decimal" value="'+esc(meta.target||w?.target||'')+'" placeholder="$"></div>'+
      '<div class="field wide"><label for="picture-url">Product photo URL (optional)</label><input type="url" id="picture-url" value="'+esc(meta.imageUrl||'')+'" placeholder="https://..."></div></div>'+
      '<div class="actions"><button type="submit" class="button">Save details</button><button type="button" class="button secondary" data-action="image-upload" data-id="'+esc(p.key)+'">Choose a photo</button><button type="button" class="button secondary" data-action="retry-image" data-id="'+esc(p.key)+'">Retry auto photo</button></div>'+
      '<p class="note">Amazon exports do not provide catalog images. Machete searches BOGO’s verified photo library and open product catalogs using product names only, and shows results only when names match. Your uploaded photos always take priority.</p></form>')+
      section('Purchase records',rows.length?'<div class="history-list">'+rows.map(historyCard).join('')+'</div>':empty('Not purchased yet','This item is on your watchlist. Its actual market price is not tracked yet.'));
  }
  function deals(){
    const targets=products().filter(p=>Number.isFinite(getMeta(p.key).target)||state.watchlist.some(w=>productId(w.asin,w.title)===p.key&&Number.isFinite(w.target)));
    return headline('Comparison','Deals<span style="color:var(--accent)">.</span>','Target prices are your preferences. They are not current Amazon prices or verified discounts.')+
      section('Target prices',targets.length?'<div class="product-grid">'+targets.map(productCard).join('')+'</div>':empty('No targets yet','Open a product to set your preferred purchase price.'))+
      section('Market history — planned','<div class="card"><h3>Real historical pricing needs a separate source</h3><p>The Amazon order export only records what you bought. An authenticated historical-price provider is needed for daily price histories, deals, alerts, and automatic product photos.</p><p>For now, Machete does not invent a current price or present a guess as a bargain.</p></div>');
  }
  function settings(){
    const account=authUser||{email:''};
    return headline('Preferences','Settings<span style="color:var(--accent)">.</span>','Account controls, data portability, and appearance.')+
      section('Google account',
        '<div class="card"><div class="row between"><div><h3>Signed in with Google</h3>'+
        '<p>'+esc(account.email)+'</p></div><span class="tag orange">Signed in</span></div>'+
        '<div class="actions"><button type="button" class="button secondary" data-action="sign-out">Sign out</button></div>'+
        '<p class="note">This is an account-gated local app, not cloud storage. Your purchase history remains on this device and is not encrypted. Signing out hides it, but does not erase it.</p></div>')+
      legacyBanner()+
      section('Automatic product photos',
        '<div class="card"><h3>Matching real product packaging</h3>'+
        '<p>Machete first checks BOGO’s existing verified photo catalog, then searches Open Food Facts and related open catalogs. Photos appear automatically as you browse. Uncertain matches are skipped.</p>'+
        '<p class="note">'+(window.MachetePhotos?.stats?.().found||0)+' photos matched on this account so far · '+
        (window.MachetePhotos?.stats?.().missing||0)+' unmatched or unavailable. This is not a count of all products.</p>'+
        '<div class="actions"><button type="button" class="button secondary" data-action="reset-photos">Retry automatic photo searches</button></div>'+
        '<p class="note">Only product names are used in public catalog search queries. Your order IDs, dates, prices, and Google account details are not shared with photo providers. This feature uses the network and results vary by catalog.</p>'+
        '<p class="note">Community product photos: Open Food Facts / Open Beauty Facts / Open Products Facts / Open Pet Food Facts. Source names are shown on matched product details.</p></div>')+
      section('Data and privacy',
        '<div class="card"><h3>Stored separately for each Google account</h3>'+
        '<p>Amazon exports are processed in this browser. The source ZIP, shipping addresses and payment fields are not retained or uploaded. Automatic Firebase cloud sync is not enabled.</p>'+
        '<div class="actions">'+importButton('Import ZIP / CSV / backup')+
        '<button class="button secondary" data-action="backup">Export complete backup</button>'+
        '<button class="button danger" data-action="clear">Delete account history on this device</button></div>'+
        '<p class="note">Export a backup before changing devices or clearing Safari website data. A ZIP includes your history and local product photos.</p></div>')+
      section('Appearance','<div class="card"><h3>Theme</h3><div class="actions">'+
        '<button type="button" class="button '+(state.theme==='dark'?'':'secondary')+'" data-theme="dark">Dark</button>'+
        '<button type="button" class="button '+(state.theme==='light'?'':'secondary')+'" data-theme="light">Light</button></div></div>')+
      section('About','<div class="card"><h3>Machete v'+VERSION+'</h3>'+
        '<p>Google Authentication, account-separated local history, custom app icon, purchase records and product price comparisons. Automatic cloud sync and at-rest encryption are not implemented.</p>'+
        '<div class="actions"><a href="https://github.com/DownAirOnly/machete" target="_blank" rel="noopener noreferrer" class="button secondary">View source</a></div></div>');
  }
  function loginView(){
    const auth=window.MacheteAuth||{status:'initializing',ready:false,error:''};
    const loading=!auth.ready||auth.status==='initializing';
    return '<section class="login-gate"><img class="login-logo" src="./icon.svg?v=3" width="112" height="112" alt="Machete m dot icon">'+
      '<p class="kicker">Your private purchase history</p>'+
      '<h1 class="page-title">Welcome to machete<span style="color:var(--accent)">.</span></h1>'+
      '<p class="sub">Sign in with Google before viewing or importing your Amazon purchases.</p>'+
      '<button type="button" class="button google-button" data-action="google-sign-in" '+(loading?'disabled':'')+'>'+
      '<span class="google-mark" aria-hidden="true">G</span>'+(loading?'Checking Google account…':'Continue with Google')+'</button>'+
      (auth.error?'<p class="login-error" role="alert">'+esc(auth.error)+'</p>':'')+
      '<p class="note">Machete keeps your order history on this device, separate for each Google account. Signing in does not upload or encrypt data.</p>'+
      '</section>';
  }
  function navigate(next){
    view=next;productKey=null;query='';year='all';kind='all';sort='recent';render();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function render(){
    syncTheme();releaseImages();
    const loggedIn=!!authUser && !!window.MacheteAuth?.user;
    screen.innerHTML=loggedIn?({home,history,products:productsView,deals,settings,detail:details}[view]||home)():loginView();
    const nav=document.querySelector('.tabbar');
    nav.hidden=!loggedIn;
    document.querySelectorAll('.tab').forEach(el=>{
      const active=el.dataset.view===view||(view==='detail'&&el.dataset.view==='products');
      el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    });
    if(loggedIn)attachImages();
  }
  function record(values){
    const title=String(values.title||'Unnamed item').trim().slice(0,400);
    const asin=asinOk(values.asin)?String(values.asin).toUpperCase():'';
    const date=String(values.date||'').slice(0,10);
    if(!date||!title)return null;
    const qty=Math.max(0,num(values.qty,1));
    const unitPrice=num(values.unitPrice);
    const total=num(values.total);
    const source=String(values.kind||'retail');
    const orderId=String(values.orderId||'').slice(0,80);
    const status=values.status||'completed';
    const key=productId(asin,title);
    return {id:hash([source,orderId,date,asin,slug(title),qty,unitPrice,total,status].join('|')),key,asin,
      title,date,qty,unitPrice,total,kind:source,orderId,status};
  }
  function rawRows(csv){
    const lines=[];let row=[],cell='',quote=false;
    const t=String(csv||'').replace(/^\uFEFF/,'');
    for(let i=0;i<t.length;i++){
      const c=t[i];
      if(quote){if(c==='"'&&t[i+1]==='"'){cell+='"';i++;}else if(c==='"')quote=false;else cell+=c;}
      else if(c==='"')quote=true;
      else if(c===','){row.push(cell);cell='';}
      else if(c==='\r'||c==='\n'){
        if(c==='\r'&&t[i+1]==='\n')i++;
        row.push(cell);if(row.some(x=>x.trim()))lines.push(row);row=[];cell='';
      }else cell+=c;
    }
    if(cell||row.length){row.push(cell);lines.push(row);}
    return lines;
  }
  function csvObjects(csv){
    const lines=rawRows(csv);
    if(!lines.length)return [];
    const heads=lines.shift().map(x=>x.trim().replace(/^\uFEFF/,''));
    return lines.map(row=>Object.fromEntries(heads.map((h,i)=>[h,row[i]??''])));
  }
  function parseRetail(rows){
    return rows.map(r=>record({asin:r.ASIN,title:r['Product Name'],date:r['Order Date'],orderId:r['Order ID'],qty:r['Original Quantity'],
      unitPrice:r['Unit Price'],total:r['Total Amount'],kind:'retail',
      status:/cancel/i.test(r['Order Status'])?'cancelled':/closed|completed|shipped/i.test(r['Order Status'])?'completed':'pending'})).filter(Boolean);
  }
  function parseDigital(rows){
    return rows.map(r=>record({asin:r.ASIN,title:r['Product Name'],date:r['Order Date'],orderId:r['Order ID'],
      qty:r['Original Quantity']||r['Quantity Ordered'],unitPrice:r.Price,total:r['Transaction Amount']||r.Price,kind:'digital',
      status:/success|closed|completed/i.test(r['Order Status'])?'completed':/cancel|fail/i.test(r['Order Status'])?'cancelled':'pending'})).filter(Boolean);
  }
  function parseRefunds(rows,retail){
    return rows.map(r=>{
      const matches=retail.filter(o=>o.orderId&&o.orderId===r['Order ID']);
      const matched=matches.length===1?matches[0]:null;
      const v=num(r['Refund Amount'],0);
      return record({asin:matched?.asin||'',title:matched?.title||'Refund — order '+String(r['Order ID']||'unknown').slice(-9),
        date:r['Refund Date']||r['Creation Date'],orderId:r['Order ID'],qty:r.Quantity,
        unitPrice:null,total:-Math.abs(v),kind:'refund',status:/completed/i.test(r['Payment Status']||'')?'refunded':'pending'});
    }).filter(Boolean);
  }
  function parseLedger(rows){
    return rows.map(r=>{
      const kind=/refund/i.test(r.type||'')?'refund':/digital|membership/i.test(r.type||'')?'digital':'retail';
      const v=num(r.amount_usd);
      const q=Math.max(1,num(r.quantity,1));
      return record({asin:r.asin||r.ASIN,title:r.description||r.name,date:r.date,orderId:r.order_id,qty:q,
        unitPrice:null,total:v,kind,
        status:kind==='refund'?'refunded':/cancel/i.test(r.status||'')?'cancelled':/pending|author/i.test(r.status||'')?'pending':'completed'});
    }).filter(Boolean);
  }
  function parseCSV(csv,name=''){
    const rows=csvObjects(csv);
    if(!rows.length)throw Error('The CSV has no records.');
    const cols=Object.keys(rows[0]);
    if(cols.includes('Unit Price')&&cols.includes('ASIN')&&cols.includes('Order Date'))return parseRetail(rows);
    if(cols.includes('Price')&&cols.includes('Transaction Amount')&&cols.includes('ASIN'))return parseDigital(rows);
    if(cols.includes('Refund Amount')&&cols.includes('Refund Date'))return parseRefunds(rows,state.orders.filter(o=>o.kind==='retail'));
    if(cols.includes('amount_usd')&&cols.includes('description'))return parseLedger(rows);
    throw Error('Unsupported CSV. Use the Your Orders.zip export or its Order History.csv file.');
  }
  async function zipContent(file){
    if(!window.JSZip)throw Error('ZIP support did not load. Refresh and try again.');
    const zip=await JSZip.loadAsync(file);
    const backup=zip.file('machete.json');
    if(backup){
      const json=JSON.parse(await backup.async('string'));
      if(json.app!=='machete' || !Array.isArray(json.orders))throw Error('Not a valid Machete backup.');
      const images=[];
      for(const name of Object.keys(zip.files)){
        const m=name.match(/^photos\/([A-Z0-9a-z-]+)\.jpg$/);
        if(m&&images.length<1000)images.push([m[1],await zip.files[name].async('blob')]);
      }
      return {records:json.orders.filter(o=>o&&typeof o.id==='string'&&typeof o.title==='string'),backup:json,images};
    }
    const csvPaths=Object.keys(zip.files).filter(s=>/\.csv$/i.test(s)&&!zip.files[s].dir);
    const find=(re)=>csvPaths.find(s=>re.test(s));
    const orderName=find(/(?:^|\/)(?:Order History|Retail\.OrderHistory\.\d+)\.csv$/i);
    const digitalName=find(/(?:^|\/)Digital Content Orders\.csv$/i);
    const refundName=find(/(?:^|\/)Refund Details\.csv$/i);
    if(!orderName&&!digitalName)throw Error('Could not find Amazon Order History.csv in this ZIP.');
    async function readName(n){
      if(!n)return [];
      const raw=await zip.file(n).async('string');
      if(raw.length>20000000)throw Error('The order table is larger than supported.');
      return csvObjects(raw);
    }
    const retail=parseRetail(await readName(orderName));
    const digital=parseDigital(await readName(digitalName));
    const refunds=parseRefunds(await readName(refundName),retail);
    return {records:[...retail,...digital,...refunds],backup:null,images:[]};
  }
  function mergeRecords(records){
    const index=new Map(state.orders.map(o=>[o.id,o]));
    let added=0;
    for(const x of records){
      if(!x||typeof x.id!=='string'||typeof x.title!=='string'||!x.date)continue;
      if(!index.has(x.id)){index.set(x.id,x);added++;}
    }
    if(index.size>50000)throw Error('Your history exceeds the current 50,000-record limit.');
    return {orders:Array.from(index.values()),added};
  }
  async function importFile(file){
    if(!file)return;
    const owningUid=authUser?.uid;
    if(!owningUid)return toast('Sign in before importing history.');
    if(file.size>40000000){toast('File too large (40 MB maximum).');return;}
    toast('Reading history on your device…');
    try{
      let imported;
      if(/\.zip$/i.test(file.name))imported=await zipContent(file);
      else if(/\.csv$/i.test(file.name))imported={records:parseCSV(await file.text(),file.name)};
      else if(/\.json$/i.test(file.name)){
        const data=JSON.parse(await file.text());
        if(data.app!=='machete'||!Array.isArray(data.orders))throw Error('This is not a Machete history JSON file.');
        imported={records:data.orders,backup:data};
      }else throw Error('Choose an Amazon ZIP, CSV, or Machete backup.');
      if(authUser?.uid!==owningUid)throw Error('Account changed during import. Nothing was saved.');
      const old=JSON.parse(JSON.stringify(state));
      const merged=mergeRecords(imported.records);
      state.orders=merged.orders;
      if(imported.backup){
        const b=imported.backup;
        state.meta={...state.meta,...(b.meta&&typeof b.meta==='object'?b.meta:{})};
        if(Array.isArray(b.watchlist)){
          const byAsin=new Map(state.watchlist.map(x=>[x.asin,x]));
          for(const w of b.watchlist)if(w&&asinOk(w.asin)&&!byAsin.has(w.asin))byAsin.set(w.asin,w);
          state.watchlist=Array.from(byAsin.values());
        }
      }
      state.importedAt=new Date().toISOString();
      if(!save()){state=old;return;}
      for(const [key,photo] of imported.images||[])await putPhoto(key,photo);
      query='';year='all';kind='all';navigate('history');
      toast('Imported '+merged.added+' new entries; '+(state.orders.length)+' total.');
    }catch(err){console.error('Machete import',err);toast(err.message||'Could not import history.');}
    finally{$('#import-file').value='';}
  }
  async function exportBackup(){
    const owningUid=authUser?.uid;
    if(!owningUid)return toast('Sign in to export your history.');
    try{
      if(!window.JSZip)throw Error('ZIP support unavailable. Refresh the page.');
      const zip=new JSZip();
      zip.file('machete.json',JSON.stringify({app:'machete',version:VERSION,exportedAt:new Date().toISOString(),orders:state.orders,watchlist:state.watchlist,meta:state.meta},null,2));
      const keys=Object.keys(state.meta).filter(k=>/^[A-Z0-9a-z-]+$/.test(k)).slice(0,1000);
      for(const key of keys){
        const image=await getPhoto(key).catch(()=>null);
        if(image)zip.file('photos/'+key+'.jpg',image);
      }
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});
      if(authUser?.uid!==owningUid)throw Error('Account changed before backup finished.');
      downloadBlob(blob,'machete-backup-'+new Date().toISOString().slice(0,10)+'.zip');
      toast('Complete backup exported.');
    }catch(e){toast(e.message||'Backup failed.');}
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function parseProductURL(raw){
    let u;try{u=new URL(raw.trim());}catch{throw Error('Paste a full Amazon.com product URL.');}
    if(!/(^|\.)amazon\.com$/i.test(u.hostname)||u.protocol!=='https:')throw Error('Use an https://amazon.com product link.');
    const match=u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:\/|$)/i);
    if(!match)throw Error('Could not find the product ASIN in that link.');
    return match[1].toUpperCase();
  }
  function openPhotoPicker(key){const input=$('#image-file');input.dataset.key=key;input.click();}
  async function storePhoto(file,key){
    if(!file||!key)return;
    const owningUid=authUser?.uid;
    if(!owningUid)return toast('Sign in before choosing a photo.');
    try{const blob=await resizePhoto(file);if(authUser?.uid!==owningUid)return;await putPhoto(key,blob);if(authUser?.uid!==owningUid)return;state.meta[key]={...getMeta(key),imageUrl:''};save();render();toast('Product photo saved on this device.');}
    catch(e){toast(e.message||'Could not save photo.');}
    finally{$('#image-file').value='';}
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-view]');if(el){navigate(el.dataset.view);return;}
    const pr=event.target.closest('[data-product]');if(pr){productKey=pr.dataset.product;view='detail';render();window.scrollTo(0,0);return;}
    const action=event.target.closest('[data-action]');if(action){
      const a=action.dataset.action;
      if(a==='google-sign-in'){window.MacheteAuth?.signIn?.().catch(err=>toast(err.message||'Sign-in failed.'));return;}
      if(a==='sign-out'){window.MacheteAuth?.signOut?.().catch(err=>toast(err.message||'Sign-out failed.'));return;}
      if(a==='claim-history'){claimLegacy();return;}
      if(a==='retry-image'){
        window.MachetePhotos?.clear?.(action.dataset.id);
        render();toast('Searching for an updated photo where available.');
        return;
      }
      if(a==='reset-photos'){
        if(confirm('Retry automatic image searches as you browse? Your chosen photos are not changed.')){
          window.MachetePhotos?.clear?.();
          render();toast('Automatic photo cache reset. Matching restarts as you browse.');
        }
        return;
      }
      if(a==='dismiss-legacy'){toast('Old device data was left unchanged.');return;}
      if(!authUser)return;
      if(a==='import')$('#import-file').click();
      if(a==='backup')exportBackup();
      if(a==='image-upload')openPhotoPicker(action.dataset.id);
      if(a==='clear'&&confirm('Delete your local order history and watchlist? Export a backup first if you might need them.')){
        const previous=state;state=emptyState();
        if(!save())state=previous;else{navigate('home');toast('Local history deleted. Saved photo files may remain until browser data is cleared.');}
      }
      return;
    }
    const theme=event.target.closest('button[data-theme]');
    if(theme){state.theme=theme.dataset.theme;save();render();}
  });
  document.addEventListener('input',event=>{
    if(event.target.id==='search'){query=event.target.value;const area=$('#filtered-list');if(area){area.innerHTML=view==='history'?renderHistoryList():renderProductList();attachImages();}}
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='year-filter')year=event.target.value;
    else if(event.target.id==='kind-filter')kind=event.target.value;
    else if(event.target.id==='sort-products')sort=event.target.value;
    else return;
    const area=$('#filtered-list');if(area){releaseImages();area.innerHTML=view==='history'?renderHistoryList():renderProductList();attachImages();}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id==='watch-form'){
      event.preventDefault();
      try{
        const asin=parseProductURL($('#watch-url').value);
        if(state.watchlist.some(w=>w.asin===asin))throw Error('Already on your watchlist.');
        state.watchlist.push({id:uniqueId(),asin,title:'Amazon product '+asin,target:null,createdAt:new Date().toISOString()});
        if(save()){navigate('products');toast('Added to your watchlist.');}
      }catch(e){toast(e.message);}
    }
    if(event.target.id==='meta-form'){
      event.preventDefault();
      const key=productKey; if(!key)return;
      const packageUnits=num($('#package-units').value);
      const unitLabel=$('#unit-label').value.trim().slice(0,25);
      const target=num($('#target-price').value);
      const img=$('#picture-url').value.trim();
      if($('#package-units').value&&(!Number.isFinite(packageUnits)||packageUnits<=0))return toast('Use a positive units-per-package number.');
      if($('#target-price').value&&(!Number.isFinite(target)||target<=0))return toast('Target price must be positive.');
      if(img&&!photoUrl(img))return toast('Photo links must use a full HTTPS URL.');
      state.meta[key]={...getMeta(key),packageUnits,unitLabel,target,imageUrl:img};
      if(save()){render();toast('Product details saved.');}
    }
  });
  $('#import-file').addEventListener('change',e=>importFile(e.target.files[0]));
  $('#image-file').addEventListener('change',e=>storePhoto(e.target.files[0],e.target.dataset.key));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.innerHTML='';});
  window.addEventListener('machete-auth-changed',()=>{
    const nextUser=window.MacheteAuth?.user||null;
    if((nextUser?.uid||null)!==(authUser?.uid||null)){
      releaseImages();
      authUser=nextUser;
      window.MachetePhotos?.setUser?.(authUser?.uid||'');
      state=authUser?load():emptyState();
      view='home';productKey=null;query='';year='all';kind='all';
    }
    render();
  });
  if(window.MacheteAuth?.ready){
    authUser=window.MacheteAuth.user||null;
    window.MachetePhotos?.setUser?.(authUser?.uid||'');
    state=authUser?load():emptyState();
  }
  render();
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=3').catch(console.warn));
})();
