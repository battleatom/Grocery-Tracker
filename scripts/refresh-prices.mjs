import fs from 'node:fs/promises';
const FILE='public/data/prices.json',HISTORY='public/data/history.json',DEALS='public/data/deals.json';
const ZIP='87401'; // refresh credentials check 2026-09-19
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
let history=[];try{history=JSON.parse(await fs.readFile(HISTORY,'utf8'))}catch{}
let deals={meta:{location:'Farmington, NM'},stores:[]};try{deals=JSON.parse(await fs.readFile(DEALS,'utf8'))}catch{}
const now=new Date().toISOString(), checks=[];
// Never carry forward auto-matched Flipp cells: rebuild them from today's flyer using strict matching.
for(const item of data.items) item.offers=item.offers.map(o=>(o?.automated&&String(o.source||'').includes('Flipp weekly ad'))?null:o);
const storeIndex=Object.fromEntries(data.meta.stores.map((s,i)=>[s,i]));
const aliases={safeway:'Safeway',albertsons:'Albertsons',walmart:'Walmart'};
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function relevant(name,item){const n=clean(name),terms=clean(item.name).split(' ').filter(x=>x.length>=3&&!['fresh','large','whole','receipt','item'].includes(x));return terms.some(t=>n.includes(t))}
function priceNum(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function addHistory(item,store,offer){const last=history.at(-1);history.push({at:now,item:item.id,store,price:offer.price,promo_price:offer.promo_price??null,unit_price:offer.unit_price??null,unit:offer.unit??item.comparison_unit,source_type:offer.deal_type||'price',verified:true})}
async function flipp(){
 try{
  const listUrl=`https://backflipp.wishabi.com/flipp/flyers?locale=en-us&postal_code=${ZIP}`;
  const r=await fetch(listUrl,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 GroceryTracker/1.0'}});
  if(!r.ok){checks.push({source:'Flipp/Wishabi',status:r.status,checked_at:now,stage:'flyers'});return 0}
  const j=await r.json(), flyers=Array.isArray(j)?j:(j.flyers||[]);
  const wanted=flyers.filter(f=>/safeway|albertsons|walmart/i.test(f.merchant_name||f.merchant||''));
  let matched=0, totalItems=0; const out={Safeway:[],Albertsons:[],Walmart:[]};
  for(const flyer of wanted){
   const merchant=clean(flyer.merchant_name||flyer.merchant);
   const store=merchant.includes('safeway')?'Safeway':merchant.includes('albertsons')?'Albertsons':merchant.includes('walmart')?'Walmart':null;
   if(!store)continue;
   const id=flyer.id||flyer.flyer_id;if(!id)continue;
   const detailUrl=`https://backflipp.wishabi.com/flipp/flyers/${id}?locale=en-us&postal_code=${ZIP}`;
   const dr=await fetch(detailUrl,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 GroceryTracker/1.0'}});
   if(!dr.ok)continue;
   const dj=await dr.json();
   let rows=[];
   for(const key of ['flyer_items','items','ecom_items'])if(Array.isArray(dj?.[key]))rows.push(...dj[key]);
   if(!rows.length)for(const v of Object.values(dj||{}))if(Array.isArray(v)&&v.some(x=>x&&typeof x==='object'&&'name'in x)){rows=v;break}
   totalItems+=rows.length;
   for(const row of rows){
    if(!row?.name||row.display_type===5||row.ttm_url)continue;
    const p=priceNum(row.current_price??(row.price!==''?row.price:null));
    if(!p)continue;
    const regular=priceNum(row.original_price);
    const deal={name:row.name,price:p,regular_price:regular,valid_from:row.valid_from??flyer.valid_from??null,valid_to:row.valid_to??flyer.valid_to??null,type:row.display_type===25?'coupon':'weekly_ad',source:'Flipp/Wishabi',source_url:row.flyer_url??detailUrl};
    out[store].push(deal);
    let best=null,bestScore=0;
    const nWords=new Set(clean(row.name).split(' '));
    for(const item of data.items){
      const terms=clean(item.name).split(' ').filter(x=>x.length>=3&&!['fresh','large','whole','receipt','item','frozen','boneless'].includes(x));
      if(!terms.length)continue;
      const hits=terms.filter(t=>nWords.has(t)).length;
      // Multi-word catalog names require at least two exact word matches.
      // Single-word names may match one exact word. This prevents "Large Brown Eggs"
      // from being assigned an unrelated $104.99 flyer item merely sharing one broad token.
      const required=terms.length===1?1:2;
      if(hits>=required && hits/terms.length>=0.5 && hits>bestScore){best=item;bestScore=hits}
    }
    if(!best)continue;
    const idx=storeIndex[store], old=best.offers[idx];
    const offer={...(old||{}),price:regular&&regular>p?regular:p,promo_price:regular&&regular>p?p:null,unit_price:null,unit:best.comparison_unit,label:String(row.name).slice(0,100),sale:true,deal_type:deal.type,deal_ends:deal.valid_to,source:`Flipp weekly ad — ${store}`,source_url:deal.source_url,observed:now.slice(0,10),observed_at:now,automated:true};
    best.offers[idx]=offer;addHistory(best,store,offer);matched++;
   }
  }
  for(const store of ['Safeway','Albertsons','Walmart']){let rec=deals.stores.find(x=>x.store===store);if(!rec){rec={store,deals:[]};deals.stores.push(rec)}rec.deals=out[store]}
  checks.push({source:'Flipp/Wishabi',status:200,checked_at:now,flyers:wanted.length,items:totalItems,deals:Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.length]))});
  return matched;
 }catch(e){checks.push({source:'Flipp/Wishabi',status:'error',checked_at:now,error:e.message});return 0}
}

const SWY_KEY='e914eec9448c4d5eb672debf5011cf8f';
async function albertsonsBanner(store,banner,storeid){
 let matched=0, searched=0;
 try{
  for(const item of data.items){
   if(/^Receipt item:/i.test(item.name))continue;
   const q=item.name.replace(/—.*/,'').trim(); if(!q)continue; searched++;
   const host=banner==='safeway'?'www.safeway.com':'www.albertsons.com';
   const u=new URL(`https://${host}/abs/pub/xapi/search/substitute`);
   Object.entries({'request-id':Date.now()+'-'+searched,url:`https://${host}`,pageurl:`https://${host}`,pagename:'search',rows:'8',start:'0','search-type':'keyword',storeid:String(storeid),featured:'true','search-uid':'',q,channel:'pickup',banner}).forEach(([k,v])=>u.searchParams.set(k,v));
   const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 GroceryTracker/1.0','Ocp-Apim-Subscription-Key':SWY_KEY,Referer:`https://${host}/shop/search-results.html`,'x-swy-banner':banner,'x-swy-client-id':'web-portal'}});
   if(!r.ok){if(r.status===429)break;continue}
   const j=await r.json();
   const rows=j?.response?.docs||j?.docs||j?.products||j?.response?.products||[];
   let best=null,bestScore=0;
   const wanted=clean(item.name).split(' ').filter(x=>x.length>=3&&!['fresh','large','whole','receipt','item','frozen','boneless'].includes(x));
   for(const p of rows){
    if(String(p.inventoryAvailable??'1')==='0')continue;
    const words=new Set(clean(p.name||p.productName).split(' '));const hits=wanted.filter(t=>words.has(t)).length;
    const required=wanted.length===1?1:Math.min(2,wanted.length);
    if(hits>=required&&hits/Math.max(1,wanted.length)>=0.5&&hits>bestScore){best=p;bestScore=hits}
   }
   if(!best)continue;
   const current=priceNum(best.price), base=priceNum(best.basePrice)||current;if(!current&&!base)continue;
   const sale=!!(current&&base&&current<base);
   const offer={price:base||current,promo_price:sale?current:null,unit_price:priceNum(best.pricePer),unit:item.comparison_unit,label:String(best.name||best.productName||q).slice(0,100),sale,deal_type:sale?'sale':'regular',deal_ends:best.promoEndDate||null,source:`Albertsons Companies product API — ${store}`,source_url:null,observed:now.slice(0,10),observed_at:now,automated:true,pid:best.pid||null,upc:best.upc||null};
   item.offers[storeIndex[store]]=offer;addHistory(item,store,offer);matched++;
   await new Promise(r=>setTimeout(r,35));
  }
  checks.push({source:`${store} product API`,status:200,checked_at:now,store_id:String(storeid),searched,matched});return matched;
 }catch(e){checks.push({source:`${store} product API`,status:'error',checked_at:now,error:e.message});return matched}
}
async function resolveABSStore(banner){
 try{
  const host=banner==='safeway'?'www.safeway.com':'www.albertsons.com';
  const u=`https://${host}/abs/pub/xapi/storeresolver/v2/all?zipcode=${ZIP}&banner=${banner}`;
  const r=await fetch(u,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 GroceryTracker/1.0','Ocp-Apim-Subscription-Key':'7bad9afbb87043b28519c4443106db06','x-swy-banner':banner}});
  if(!r.ok)return null;const j=await r.json();const a=Array.isArray(j)?j:(j.stores||j.data||j.storeList||[]);
  const local=a.find(x=>clean(x.city).includes('farmington'))||a[0];
  return local?.storeId||local?.storeid||local?.id||null;
 }catch{return null}
}
async function albertsonsPrices(){
 // Farmington E Main stores. Resolver remains a fallback because Albertsons' resolver payload changes shape.
 // Validate these IDs through the price endpoint on each run; failed calls do not overwrite existing verified data.
 const configured={safeway:process.env.SAFEWAY_STORE_ID||'2004',albertsons:process.env.ALBERTSONS_STORE_ID||'824'};
 const [rsid,raid]=await Promise.all([configured.safeway?null:resolveABSStore('safeway'),configured.albertsons?null:resolveABSStore('albertsons')]);
 const sid=configured.safeway||rsid, aid=configured.albertsons||raid;
 let n=0;
 if(sid)n+=await albertsonsBanner('Safeway','safeway',sid);else checks.push({source:'Safeway product API',status:'store_not_found',checked_at:now});
 if(aid)n+=await albertsonsBanner('Albertsons','albertsons',aid);else checks.push({source:'Albertsons product API',status:'store_not_found',checked_at:now});
 return n;
}
async function kroger(){
 const id=process.env.KROGER_CLIENT_ID, secret=process.env.KROGER_CLIENT_SECRET;
 if(!id||!secret){checks.push({source:"Kroger API / Smith's",status:'credentials_missing',checked_at:now});return 0}
 try{
  const tok=await fetch('https://api.kroger.com/v1/connect/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials&scope=product.compact'});
  if(!tok.ok){checks.push({source:"Kroger API / Smith's",status:tok.status,checked_at:now});return 0}
  const token=(await tok.json()).access_token;
  const lr=await fetch(`https://api.kroger.com/v1/locations?filter.zipCode.near=${ZIP}&filter.radiusInMiles=20&filter.limit=10`,{headers:{Authorization:'Bearer '+token}});
  const lj=await lr.json(); const loc=(lj.data||[]).find(x=>/smith/i.test(x.name||''))||(lj.data||[])[0]; if(!loc)return 0;
  let matched=0;
  for(const item of data.items){
   const q=encodeURIComponent(item.name.replace(/—.*/,'').replace(/Receipt item:.*/,'').trim()); if(!q)continue;
   const r=await fetch(`https://api.kroger.com/v1/products?filter.term=${q}&filter.locationId=${loc.locationId}&filter.limit=3`,{headers:{Authorization:'Bearer '+token}});
   if(!r.ok)continue; const j=await r.json(); const p=(j.data||[]).find(x=>relevant(x.description,item)); if(!p)continue;
   const it=p.items?.[0], reg=priceNum(it?.price?.regular), promo=priceNum(it?.price?.promo); if(!reg)continue;
   const offer={price:reg,promo_price:promo&&promo<reg?promo:null,unit_price:null,unit:item.comparison_unit,label:[p.description,it?.size].filter(Boolean).join(' '),sale:!!(promo&&promo<reg),deal_type:promo&&promo<reg?'promo':'regular',source:"Official Kroger API — Smith's Farmington",observed:now.slice(0,10),observed_at:now,automated:true};
   item.offers[4]=offer;addHistory(item,"Smith's",offer);matched++;
  }
  checks.push({source:"Kroger API / Smith's",status:200,checked_at:now,location_id:loc.locationId});return matched;
 }catch(e){checks.push({source:"Kroger API / Smith's",status:'error',checked_at:now,error:e.message});return 0}
}
async function thunderbitSams(){
 const key=process.env.THUNDERBIT_API_SCRAPER;
 if(!key){checks.push({source:"Thunderbit / Sam's Club",status:'credentials_missing',checked_at:now});return 0}
 let matched=0;
 try{
  for(const item of data.items){
   if(/^Receipt item:/i.test(item.name))continue;
   const q=encodeURIComponent(item.name.replace(/—.*/,'').trim());
   const url=`https://www.samsclub.com/s/${q}?xid=hdr_search-typeahead_${q}`;
   const r=await fetch('https://openapi.thunderbit.com/openapi/v1/extract',{
    method:'POST',
    headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({url,renderMode:'full',waitFor:2500,forceRefresh:true,countryCode:'US',timeout:60000,schema:{
     type:'object',properties:{products:{type:'array',items:{type:'object',properties:{
      name:{type:'string',description:'Exact product title'},
      price:{type:'number',description:'Current Sam’s Club member selling price in USD, not a sponsored or crossed-out price'},
      regular_price:{type:'number',description:'Original or regular price in USD before discount, if shown'},
      unit_price:{type:'number',description:'Displayed price per pound, ounce, count, or other unit as a number, if shown'},
      unit:{type:'string',description:'Unit associated with unit_price, if shown'},
      item_number:{type:'string',description:'Sam’s Club item number, if shown'},
      url:{type:'string',description:'Product detail URL, if available'},
      in_stock:{type:'boolean',description:'Whether the item is shown as available'}
     },required:['name','price']}}},required:['products']}})
   });
   if(r.status===401||r.status===403){checks.push({source:"Thunderbit / Sam's Club",status:r.status,checked_at:now,error:'API authentication/authorization failed'});return matched}
   if(r.status===402){checks.push({source:"Thunderbit / Sam's Club",status:402,checked_at:now,error:'insufficient_credits'});return matched}
   if(r.status===429){checks.push({source:"Thunderbit / Sam's Club",status:429,checked_at:now,error:'rate_limited'});return matched}
   if(!r.ok)continue;
   const j=await r.json(); const out=j?.data?.result||j?.data?.json||j?.data||{};
   const products=Array.isArray(out?.products)?out.products:[];
   let best=null,bestScore=0;
   const wanted=clean(item.name).split(' ').filter(x=>x.length>=3&&!['fresh','large','whole','receipt','item','frozen','boneless'].includes(x));
   for(const p of products){
    const words=new Set(clean(p.name).split(' ')); const hits=wanted.filter(t=>words.has(t)).length;
    const required=wanted.length===1?1:Math.min(2,wanted.length);
    if(hits>=required&&hits/Math.max(1,wanted.length)>=0.5&&hits>bestScore&&p.in_stock!==false){best=p;bestScore=hits}
   }
   if(!best)continue;
   const current=priceNum(best.price),regular=priceNum(best.regular_price)||current;if(!current)continue;
   const sale=regular>current;
   const offer={price:regular,promo_price:sale?current:null,unit_price:priceNum(best.unit_price),unit:best.unit||item.comparison_unit,label:String(best.name).slice(0,120),sale,deal_type:sale?'sale':'regular',source:"Thunderbit live extraction — Sam's Club Farmington",source_url:best.url||url,observed:now.slice(0,10),observed_at:now,automated:true,item_number:best.item_number||null};
   item.offers[0]=offer;addHistory(item,"Sam's Club",offer);matched++;
  }
  checks.push({source:"Thunderbit / Sam's Club",status:200,checked_at:now,matched});return matched;
 }catch(e){checks.push({source:"Thunderbit / Sam's Club",status:'error',checked_at:now,error:e.message});return matched}
}
async function legacyPages(){
 const srcs=[["Sam's Club",0,'https://www.samsclub.com/club/6347/grocery'],['Walmart',1,'https://www.walmart.com/store/3428-farmington-nm/shopping-services']];
 for(const [name,idx,url] of srcs)try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 GroceryTracker/1.0'}});const body=await r.text();checks.push({source:name,status:r.status,checked_at:now,blocked:/robot or human|captcha/i.test(body)});}catch(e){checks.push({source:name,status:'error',checked_at:now,error:e.message})}
}
const [fm,km,am,sm]=await Promise.all([flipp(),kroger(),albertsonsPrices(),thunderbitSams(),legacyPages().then(()=>0)]);
data.meta.automation={last_run:now,matched:fm+km+am+sm,schedule:'daily',source_checks:checks,policy:'Public weekly-ad deals via Flipp; Smith\'s full catalog via official Kroger API when credentials are configured. Preserve prior verified values when a source fails.'};
if(fm+km+am+sm>0)data.meta.updated_at=now;
deals.meta.updated_at=now;deals.meta.source_checks=checks;
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
await fs.writeFile(HISTORY,JSON.stringify(history.slice(-5000),null,2)+'\n');
await fs.writeFile(DEALS,JSON.stringify(deals,null,2)+'\n');
console.log('verified matches',fm+km+am+sm,'flipp',fm,'kroger',km,'abs',am,'sams',sm);
