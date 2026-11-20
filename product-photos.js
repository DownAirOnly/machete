'use strict';
/*
 * Machete product photos v3.1.
 * BOGO-inspired: known/validated image files first, conservative product-title
 * matching second, image-load verification, lazy jobs, small on-device cache.
 *
 * Privacy: only product NAME search terms leave the device (to public product
 * catalogs). No Amazon order IDs, receipt records, dates, totals, UID or emails
 * are sent. The public BOGO catalog is shared across the user's two apps.
 *
 * Amazon ASIN is used strictly as a LOCAL cache key, NOT sent to public search.
 * Missing and ambiguous matches intentionally retain a neutral placeholder.
 */
(()=>{
  const VERSION=2, CACHE_PREFIX='machete-photo-index-v'+VERSION+'.';
  const BOGO_BASE='https://downaironly.github.io/bogo/';
  const BOGO_CATALOGS=['data/current-deals.json','data/deals.json'];
  const SOURCES=[
    {id:'food',label:'Open Food Facts',host:'world.openfoodfacts.org'},
    {id:'beauty',label:'Open Beauty Facts',host:'world.openbeautyfacts.org'},
    {id:'general',label:'Open Products Facts',host:'world.openproductsfacts.org'},
    {id:'pet',label:'Open Pet Food Facts',host:'world.openpetfoodfacts.org'}
  ];
  const STOP=new Set('the and for with from this that these those item product products amazon amazoncom original new fresh pack package packs count ct each multi set bundle assorted variety flavor flavored size classic plus extra included including single premium best of by at in on to a an oz lb ml l g kg inch inches foot feet x'.split(' '));
  const REJECT=new Set('recipe recipes cooking meal dinner review reviews tutorial poster wallpaper illustration clipart artwork infographic screenshots screenshot template label blank empty before after youtube tiktok pinterest facebook'.split(' '));
  const diagnostics={attempted:0,matched:0,notFound:0,errors:0,lastError:'',lastSource:'',lastQuery:'',lastSuccess:''};
  let uid='', cache={}, pending=new Map(), lazyObserver=null, scheduled=0, generation=0;
  const waiting=[], queuedKeys=new Set();
  let inflight=0;
  let bogoPromise=null;
  const $=s=>document.querySelector(s);
  const safeHttps=u=>{
    try{const url=new URL(u);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}
    catch{return '';}
  };
  const normalize=s=>String(s||'').toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/prebtc/g,'prebiotic')
    .replace(/(\d+)[\s_-]*(?:packs?|pk)\b/g,'$1pk')
    .replace(/[^a-z0-9]+/g,' ').trim();
  const singular=w=>w.endsWith('ies')&&w.length>5?w.slice(0,-3)+'y':
    w.endsWith('oes')&&w.length>5?w.slice(0,-2):
    w.endsWith('s')&&!w.endsWith('ss')&&w.length>4?w.slice(0,-1):w;
  const tokens=s=>normalize(s).split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)).map(singular);
  const distinct=a=>[...new Set(a)];
  const titleTokens=s=>distinct(tokens(s)).slice(0,15);
  const cacheName=()=>CACHE_PREFIX+uid;
  const readCache=()=>{
    try{
      const v=JSON.parse(localStorage.getItem(cacheName())||'{}');
      return v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    }catch{return {};}
  };
  const persist=()=>{
    if(!uid)return;
    try{
      const pairs=Object.entries(cache);
      // Keep bounds below iOS Safari localStorage limits.
      if(pairs.length>1400)cache=Object.fromEntries(pairs.slice(-1200));
      localStorage.setItem(cacheName(),JSON.stringify(cache));
    }catch(e){console.debug('Image lookup cache unavailable',e);}
  };
  function setUser(newUid){
    generation++;
    uid=typeof newUid==='string'?newUid:'';
    cache=uid?readCache():{};
    pending.clear();waiting.length=0;queuedKeys.clear();scheduled=0;
    Object.assign(diagnostics,{attempted:0,matched:0,notFound:0,errors:0,lastError:'',lastSource:'',lastQuery:'',lastSuccess:''});
    lazyObserver?.disconnect();lazyObserver=null;
  }
  function cached(key){
    if(!uid)return null;
    const v=cache[key];
    if(!v||typeof v!=='object')return null;
    if(v.status==='found'&&safeHttps(v.url))return v;
    return null;
  }
  function negativeFresh(key){
    const v=cache[key];
    if(!v||v.status!=='missing')return false;
    return Date.now()-Number(v.checked||0)<(Number(v.retryAfter)||36*3600e3);
  }
  function clear(key){
    if(!uid)return;
    if(typeof key==='string'&&key){delete cache[key];pending.delete(key);}
    else cache={};
    persist();
  }
  const stats=()=>{
    let found=0,missing=0;
    for(const v of Object.values(cache)){
      if(v?.status==='found')found++;
      if(v?.status==='missing')missing++;
    }
    return {found,missing,waiting:waiting.length,active:inflight,...diagnostics};
  };
  const timeoutFetch=async(url,ms=8500)=>{
    const ctrl=new AbortController();
    const timeout=setTimeout(()=>ctrl.abort(),ms);
    try{
      const r=await fetch(url,{mode:'cors',cache:'force-cache',signal:ctrl.signal,referrerPolicy:'no-referrer'});
      if(!r.ok)throw Error('Image source returned '+r.status);
      return await r.json();
    }finally{clearTimeout(timeout);}
  };
  // Browser image tags can verify photos from domains without a CORS read.
  function loadable(src,timeoutMs=6500){
    return new Promise(resolve=>{
      const url=safeHttps(src);
      if(!url)return resolve(false);
      const im=new Image();
      im.referrerPolicy='no-referrer';
      im.decoding='async';
      let settled=false;
      const timer=setTimeout(()=>finish(false),timeoutMs);
      function finish(ok){
        if(settled)return;settled=true;
        clearTimeout(timer);im.onload=null;im.onerror=null;
        resolve(ok);
      }
      im.onload=()=>finish(im.naturalWidth>=70&&im.naturalHeight>=70);
      im.onerror=()=>finish(false);
      im.src=url;
    });
  }
  const bogoIdent=s=>/^[A-Za-z0-9_-]{1,90}$/.test(String(s||''))?s:'';
  // Conservative comparison used for both public BOGO and open-catalog names.
  // Do not show the wrong flavor, brand, count or model just to fill a card.
  function matchScore(expected,matchTitle){
    const wanted=titleTokens(expected),got=titleTokens(matchTitle);
    if(wanted.length<2||got.length<2)return -1;
    if(got.some(t=>REJECT.has(t)))return -1;
    const seen=new Set(got);
    if(!seen.has(wanted[0]))return -1; // Require first strong brand token.
    const hits=wanted.filter(w=>seen.has(w));
    const minHits=wanted.length<4?2:3;
    if(hits.length<minHits)return -1;
    // If the purchased item says 8pk, a 12pk photo is misleading.
    const importantCounts=wanted.filter(x=>/^\d+pk$/.test(x));
    if(importantCounts.length&&!importantCounts.every(x=>seen.has(x)))return -1;
    const haveCounts=got.filter(x=>/^\d+pk$/.test(x));
    if(haveCounts.length&&importantCounts.length&&haveCounts.some(x=>!importantCounts.includes(x)))return -1;
    // Long Amazon marketing titles need not share every word with catalog names.
    return hits.length*4 + (hits.length/wanted.length)*8 +
      (seen.has(wanted[1])?3:0) -
      (got.length>18?4:0);
  }
  async function bogoCatalog(){
    if(bogoPromise)return bogoPromise;
    bogoPromise=(async()=>{
      const loaded=await Promise.all(BOGO_CATALOGS.map(async path=>{
        try{
          const c=await timeoutFetch(BOGO_BASE+path,8500);
          return Array.isArray(c.deals)?c.deals:[];
        }catch{return [];}
      }));
      const seen=new Map();
      for(const d of loaded.flat()){
        if(!bogoIdent(d.id)||!d.name)continue;
        seen.set(d.id,{id:d.id,title:String(d.name),details:String(d.details||d.size||'')});
      }
      return [...seen.values()];
    })();
    return bogoPromise;
  }
  async function findBOGO(title){
    const catalog=await bogoCatalog();
    let candidates=[];
    for(const d of catalog){
      const score=matchScore(title,d.title+' '+d.details);
      if(score<0)continue;
      candidates.push({score,filename:d.id});
    }
    candidates.sort((a,b)=>b.score-a.score);
    // Only use the best single plausible photo; do not silently fallback to
    // a completely different product if that image is unavailable.
    for(const c of candidates.slice(0,2)){
      const url=BOGO_BASE+'images/verified-products/'+encodeURIComponent(c.filename)+'.webp';
      if(await loadable(url))return {status:'found',url,source:'BOGO verified-photo library',
        sourceUrl:BOGO_BASE,checked:Date.now(),score:c.score};
    }
    return null;
  }
  async function findAmazonByAsin(key){
    if(!/^[A-Z0-9]{10}$/.test(key))return null;
    const urls=[
      'https://images-na.ssl-images-amazon.com/images/P/'+key+'.01._SX300_.jpg',
      'https://m.media-amazon.com/images/P/'+key+'.01._SX300_.jpg'
    ];
    // Older Amazon image aliases may work; newer ASINs often have no alias.
    const ok=await Promise.all(urls.map(u=>loadable(u,2500)));
    const i=ok.indexOf(true);
    return i<0?null:{status:'found',url:urls[i],source:'Amazon ASIN image',
      sourceUrl:'https://www.amazon.com/dp/'+key,checked:Date.now(),score:100};
  }
  function catalogSource(title){
    const s=normalize(title);
    if(/\b(dog|cat|kitten|puppy|pet)\b/.test(s)&&/\b(food|treat|kibble)\b/.test(s))return SOURCES[3];
    if(/\b(shampoo|soap|conditioner|lotion|makeup|cosmetic|skin|deodorant|toothpaste|face|beauty)\b/.test(s))return SOURCES[1];
    if(/\b(drink|soda|juice|milk|water|snack|cereal|rice|pasta|protein|food|soup|sauce|cracker|chips|cheese|coffee|tea|candy|yogurt|bread|cereal|energy|cookie|chocolate|butter)\b/.test(s))return SOURCES[0];
    return SOURCES[2];
  }
  function queryFor(title){
    // Avoid searching for full Amazon marketing text. 5 informative tokens
    // are normally enough to find the actual brand/product.
    return titleTokens(title).slice(0,3).join(' ');
  }
  function imageFromProduct(p){
    return safeHttps(p?.image_front_url)||safeHttps(p?.image_front_small_url)||safeHttps(p?.image_url)||'';
  }
  async function catalogCandidates(title){
    const source=catalogSource(title),query=queryFor(title);
    if(!query)return [];
    // Treat catalog lookup as a rate-limited external API, never as a
    // search-as-you-type request. Max ~7-8 new searches/minute on this device.
    const scheduledTime=Math.max(Date.now(),scheduled);
    scheduled=scheduledTime+6500;
    const delay=scheduledTime-Date.now();
    if(delay>0)await new Promise(done=>setTimeout(done,delay));
    if(!uid)return [];
    const params=new URLSearchParams({
      search_terms:query,search_simple:'1',action:'process',json:'1',page_size:'20',
      fields:'code,product_name,product_name_en,brands,image_front_url,image_front_small_url,image_url'
    });
    // Open Facts API v2 does not support full-text search. Its legacy
    // /cgi/search.pl endpoint does, although provider downtime may occur.
    const api='https://'+source.host+'/cgi/search.pl?'+params;
    diagnostics.lastSource=source.label;diagnostics.lastQuery=query;
    const data=await timeoutFetch(api,9000);
    const matches=[];
    for(const p of data.products||[]){
      const url=imageFromProduct(p);
      if(!url)continue;
      const titleText=(p.brands||'')+' '+(p.product_name_en||p.product_name||'');
      const score=matchScore(title,titleText);
      if(score<0)continue;
      matches.push({score,url,source:source.label,sourceUrl:'https://'+source.host+'/product/'+encodeURIComponent(p.code||'')});
    }
    matches.sort((a,b)=>b.score-a.score);
    return matches.slice(0,3);
  }
  async function resolve(key,title){
    if(!uid||!key||!title)return null;
    if(cached(key))return cached(key);
    if(negativeFresh(key))return null;
    if(pending.has(key))return pending.get(key);
    const searchUid=uid,searchGen=generation;
    const promise=(async()=>{
      diagnostics.attempted++;
      let result=null,providerError=false;
      try{result=await findAmazonByAsin(key);}
      catch(e){console.debug('ASIN image unavailable',e);}
      if(!result){
        try{result=await findBOGO(title);}
        catch(e){diagnostics.errors++;diagnostics.lastError='BOGO: '+(e.message||e);providerError=true;}
      }
      if(!result){
        let candidates=[];
        try{candidates=await catalogCandidates(title);}
        catch(e){
          diagnostics.errors++;providerError=true;
          diagnostics.lastError=(diagnostics.lastSource||'Product catalog')+': '+String(e?.message||e).slice(0,140);
          console.debug('Catalog search unavailable',e);
        }
        for(const candidate of candidates){
          if(searchUid!==uid||searchGen!==generation)break;
          if(await loadable(candidate.url,6000)){
            result={status:'found',...candidate,checked:Date.now()};break;
          }
        }
      }
      if(searchUid!==uid||searchGen!==generation)return null;
      if(result){
        cache[key]=result;diagnostics.matched++;
        diagnostics.lastSuccess=title.slice(0,90)+' via '+result.source;
        persist();window.dispatchEvent(new Event('machete-photo-progress'));return result;
      }
      cache[key]={status:'missing',checked:Date.now(),retryAfter:providerError?15*60e3:24*3600e3};
      diagnostics.notFound++;persist();window.dispatchEvent(new Event('machete-photo-progress'));return null;
    })();
    pending.set(key,promise);
    try{return await promise;}finally{if(pending.get(key)===promise)pending.delete(key);}
  }
  function queueImage(image,key,title){
    if(!uid||!image?.isConnected||!key||!title||queuedKeys.has(image))return;
    // Product photo searches run only near cards the user opens or scrolls to.
    waiting.push({image,key,title,uid,generation});
    queuedKeys.add(image);
    pump();
  }
  function pump(){
    while(inflight<3&&waiting.length){
      const work=waiting.shift();
      if(!work.image.isConnected||work.uid!==uid||work.generation!==generation)continue;
      inflight++;
      resolve(work.key,work.title).then(result=>{
        if(!result||!work.image.isConnected||work.uid!==uid||work.generation!==generation)return;
        // Protect manual/custom images that finished loading while searching.
        if(work.image.dataset.manualPicture==='yes')return;
        work.image.dataset.photoSource=result.source;
        work.image.referrerPolicy='no-referrer';work.image.src=result.url;
      }).catch(e=>console.debug('Automatic product photo unavailable',e))
        .finally(()=>{inflight--;pump();});
    }
  }
  function observe(image,key,title){
    if(!image?.isConnected||!uid||!key||!title)return;
    const hit=cached(key);
    if(hit){image.dataset.photoSource=hit.source;image.referrerPolicy='no-referrer';image.src=hit.url;return;}
    if(negativeFresh(key))return;
    image.dataset.photoStatus='queued';
    if('IntersectionObserver' in window){
      if(!lazyObserver)lazyObserver=new IntersectionObserver(entries=>{
        for(const ent of entries){
          if(!ent.isIntersecting)continue;
          lazyObserver.unobserve(ent.target);
          // The image starts hidden until a verified file loads, so
          // observe its visible wrapper instead.
          const wrap=ent.target, img=wrap.querySelector('img[data-img-key]');
          if(img)queueImage(img,wrap.dataset.photoKey,wrap.dataset.photoTitle);
        }
      },{rootMargin:'360px'});
      const wrap=image.parentElement;
      if(!wrap)return queueImage(image,key,title);
      wrap.dataset.photoKey=key;
      wrap.dataset.photoTitle=title;
      lazyObserver.observe(wrap);
    }else queueImage(image,key,title);
  }
  function attribution(key){
    const hit=cached(key);
    return hit?{source:hit.source,url:hit.sourceUrl||''}:null;
  }
  window.MachetePhotos={setUser,observe,getCached:cached,clear,stats,attribution,resolve};
})();
