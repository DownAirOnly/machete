'use strict';
/* Machete v3.3: Candidate discovery only. Never auto-assign images to cards.
 * Public lookups start only after the user taps "Find possible pictures".
 * No UID, order ID, date, purchase price or order history is transmitted.
 */
(()=>{
  let uid='',generation=0,lastCatalogSearch=0;
  const BASE='https://downaironly.github.io/bogo/';
  const STOP=new Set('the and for with from this that these amazon original new fresh pack package packs count ct each multi set bundle variety flavor size classic premium of by at in on to a an oz lb ml g kg inch inches x'.split(' '));
  const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
  const normalize=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/(\d+)[\s_-]*(?:pack|packs|pk)\b/g,'$1pk').replace(/[^a-z0-9]+/g,' ').trim();
  const words=s=>[...new Set(normalize(s).split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)))].slice(0,17);
  function score(original,other){
    const a=words(original),b=words(other);
    if(a.length<2||b.length<2||a[0]!==b[0])return -1;
    const set=new Set(b),hits=a.filter(x=>set.has(x));
    if(hits.length<Math.min(3,a.length))return -1;
    const originalCounts=a.filter(x=>/^\d+pk$/.test(x)),candidateCounts=b.filter(x=>/^\d+pk$/.test(x));
    if(originalCounts.length&&candidateCounts.length&&originalCounts.some(x=>!candidateCounts.includes(x)))return -1;
    return hits.length*4+hits.length/a.length*8;
  }
  function loadable(url){
    return new Promise(resolve=>{
      const u=safe(url);if(!u)return resolve(false);
      const image=new Image();image.referrerPolicy='no-referrer';
      const timer=setTimeout(()=>finish(false),4800);let done=false;
      function finish(ok){if(done)return;done=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(ok);}
      image.onload=()=>finish(image.naturalWidth>=70&&image.naturalHeight>=70);
      image.onerror=()=>finish(false);image.src=u;
    });
  }
  async function json(url){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8500);
    try{
      const r=await fetch(url,{cache:'force-cache',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
      if(!r.ok)throw Error('Catalog returned '+r.status);
      return await r.json();
    }finally{clearTimeout(timer);}
  }
  async function amazon(asin){
    if(!/^[A-Z0-9]{10}$/.test(String(asin||'')))return [];
    const urls=[
      'https://images-na.ssl-images-amazon.com/images/P/'+asin+'.01._SX450_.jpg',
      'https://m.media-amazon.com/images/P/'+asin+'.01._SX450_.jpg',
      'https://images.amazon.com/images/P/'+asin+'.01._SCLZZZZZZZ_.jpg'
    ];
    for(const url of urls)if(await loadable(url))return [{url,source:'Amazon ASIN candidate',sourceUrl:'https://www.amazon.com/dp/'+asin,title:'ASIN image · verify packaging'}];
    return [];
  }
  async function bogo(title){
    const catalogs=await Promise.allSettled(['data/current-deals.json','data/deals.json'].map(p=>json(BASE+p)));
    const seen=new Map();
    for(const r of catalogs)if(r.status==='fulfilled')for(const p of r.value.deals||[]){
      if(!/^[a-z0-9_-]{1,90}$/i.test(p.id||''))continue;
      const s=score(title,(p.name||'')+' '+(p.details||p.size||''));
      if(s>=0)seen.set(p.id,{url:BASE+'images/verified-products/'+encodeURIComponent(p.id)+'.webp',source:'BOGO library',sourceUrl:BASE,title:p.name||'',score:s});
    }
    const sorted=[...seen.values()].sort((a,b)=>b.score-a.score).slice(0,4);
    const results=[];
    for(const v of sorted)if(await loadable(v.url)){results.push(v);if(results.length===2)break;}
    return results;
  }
  function catalog(title){
    const s=normalize(title);
    if(/\b(dog|cat|kitten|puppy|pet)\b/.test(s)&&/\b(food|treat|kibble)\b/.test(s))return ['world.openpetfoodfacts.org','Open Pet Food Facts'];
    if(/\b(shampoo|soap|conditioner|lotion|makeup|skin|deodorant|toothpaste|beauty)\b/.test(s))return ['world.openbeautyfacts.org','Open Beauty Facts'];
    if(/\b(drink|soda|juice|milk|water|snack|cereal|rice|pasta|protein|food|soup|sauce|cracker|chips|coffee|tea|candy|yogurt|bread|energy|cookie|chocolate|butter)\b/.test(s))return ['world.openfoodfacts.org','Open Food Facts'];
    return ['world.openproductsfacts.org','Open Products Facts'];
  }
  async function openFacts(title){
    const [host,source]=catalog(title),q=words(title).slice(0,3).join(' ');
    if(!q)return [];
    const start=Math.max(Date.now(),lastCatalogSearch);lastCatalogSearch=start+6500;
    if(start>Date.now())await new Promise(ok=>setTimeout(ok,start-Date.now()));
    const params=new URLSearchParams({search_terms:q,search_simple:'1',action:'process',json:'1',page_size:'20',
      fields:'code,product_name,product_name_en,brands,image_front_url,image_front_small_url,image_url'});
    const products=(await json('https://'+host+'/cgi/search.pl?'+params)).products||[];
    const options=[];
    for(const p of products){
      const url=safe(p.image_front_url||p.image_front_small_url||p.image_url);
      if(!url)continue;
      const candidateTitle=[p.brands,p.product_name_en||p.product_name].filter(Boolean).join(' ');
      const s=score(title,candidateTitle);if(s<0)continue;
      options.push({url,source,sourceUrl:'https://'+host+'/product/'+encodeURIComponent(p.code||''),title:candidateTitle,score:s});
    }
    const valid=[];
    for(const c of options.sort((a,b)=>b.score-a.score).slice(0,5)){
      if(await loadable(c.url)){valid.push(c);if(valid.length===3)break;}
    }
    return valid;
  }
  function setUser(newUid){uid=String(newUid||'');generation++;lastCatalogSearch=0;}
  async function candidates(asin,title){
    if(!uid||!title)return [];
    const at=generation,owner=uid;
    const results=await Promise.allSettled([amazon(asin),bogo(title),openFacts(title)]);
    if(at!==generation||owner!==uid)return [];
    const seen=new Set(),list=[];
    for(const group of results)if(group.status==='fulfilled')for(const c of group.value){
      if(!safe(c.url)||seen.has(c.url))continue;
      seen.add(c.url);list.push(c);if(list.length===6)return list;
    }
    return list;
  }
  window.MachetePhotos={setUser,candidates};
})();
