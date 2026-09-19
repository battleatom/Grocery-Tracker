import fs from 'node:fs/promises';
const FILE='public/data/prices.json',HISTORY='public/data/history.json',DEALS='public/data/deals.json';
const ZIP='87401';
const data=JSON.parse(await fs.readFile(FILE,'utf8'));
let history=[];try{history=JSON.parse(await fs.readFile(HISTORY,'utf8'))}catch{}
let deals={meta:{location:'Farmington, NM'},stores:[]};try{deals=JSON.parse(await fs.readFile(DEALS,'utf8'))}catch{}
const now=new Date().toISOString(), checks=[];
const storeIndex=Object.fromEntries(data.meta.stores.map((s,i)=>[s,i]));
const aliases={safeway:'Safeway',albertsons:'Albertsons',walmart:'Walmart'};
const clean=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function relevant(name,item){const n=clean(name),terms=clean(item.name).split(' ').filter(x=>x.length>=3&&!['fresh','large','whole','receipt','item'].includes(x));return terms.some(t=>n.includes(t))}
function priceNum(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null}
function addHistory(item,store,offer){const last=history.at(-1);history.push({at:now,item:item.id,store,price:offer.price,promo_price:offer.promo_price??null,unit_price:offer.unit_price??null,unit:offer.unit??item.comparison_unit,source_type:offer.deal_type||'price',verified:true})}
async function flipp(){
 const url=`https://backflipp.wishabi.com/flipp/items/search?locale=en-us&postal_code=${ZIP}&q=grocery`;
 try{
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 GroceryTracker/1.0'}});
  checks.push({source:'Flipp/Wishabi',status:r.status,checked_at:now});
  if(!r.ok)return 0;
  const j=await r.json(), rows=j?.items??(Array.isArray(j)?j:[]);
  let matched=0; const out={Safeway:[],Albertsons:[],Walmart:[]};
  for(const row of rows){
   const merchant=clean(row.merchant_name);
   const store=merchant.includes('safeway')?'Safeway':merchant.includes('albertsons')?'Albertsons':merchant.includes('walmart')?'Walmart':null;
   if(!store)continue;
   const p=priceNum(row.current_price??row.price); if(!p)continue;
   const deal={name:row.name,price:p,regular_price:priceNum(row.original_price),valid_from:row.valid_from??null,valid_to:row.valid_to??null,type:'weekly_ad',source:'Flipp/Wishabi',source_url:row.flyer_url??url};
   out[store].push(deal);
   for(const item of data.items){
    if(!relevant(row.name,item))continue;
    const idx=storeIndex[store], old=item.offers[idx];
    const regular=deal.regular_price&&deal.regular_price>p?deal.regular_price:p;
    const offer={...(old||{}),price:regular,promo_price:deal.regular_price&&deal.regular_price>p?p:null,unit_price:null,unit:item.comparison_unit,label:String(row.name).slice(0,100),sale:true,deal_type:'weekly_ad',deal_ends:deal.valid_to,source:`Flipp weekly ad — ${store}`,source_url:deal.source_url,observed:now.slice(0,10),observed_at:now,automated:true};
    item.offers[idx]=offer; addHistory(item,store,offer); matched++; break;
   }
  }
  for(const store of ['Safeway','Albertsons','Walmart']){let rec=deals.stores.find(x=>x.store===store);if(!rec){rec={store,deals:[]};deals.stores.push(rec)}rec.deals=out[store]}
  return matched;
 }catch(e){checks.push({source:'Flipp/Wishabi',status:'error',checked_at:now,error:e.message});return 0}
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
async function legacyPages(){
 const srcs=[["Sam's Club",0,'https://www.samsclub.com/club/6347/grocery'],['Walmart',1,'https://www.walmart.com/store/3428-farmington-nm/shopping-services']];
 for(const [name,idx,url] of srcs)try{const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 GroceryTracker/1.0'}});const body=await r.text();checks.push({source:name,status:r.status,checked_at:now,blocked:/robot or human|captcha/i.test(body)});}catch(e){checks.push({source:name,status:'error',checked_at:now,error:e.message})}
}
const [fm,km]=await Promise.all([flipp(),kroger(),legacyPages().then(()=>0)]);
data.meta.automation={last_run:now,matched:fm+km,schedule:'daily',source_checks:checks,policy:'Public weekly-ad deals via Flipp; Smith\'s full catalog via official Kroger API when credentials are configured. Preserve prior verified values when a source fails.'};
if(fm+km>0)data.meta.updated_at=now;
deals.meta.updated_at=now;deals.meta.source_checks=checks;
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');
await fs.writeFile(HISTORY,JSON.stringify(history.slice(-5000),null,2)+'\n');
await fs.writeFile(DEALS,JSON.stringify(deals,null,2)+'\n');
console.log('verified matches',fm+km,'flipp',fm,'kroger',km);
