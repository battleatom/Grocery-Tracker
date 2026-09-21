import samsAlbuquerqueBeef from './src/data/samsclub-albuquerque-beef-2026-09-20.js';
import samsAlbuquerqueSavings from './src/data/samsclub-albuquerque-grocery-savings-2026-09-19.js';
import safewayFarmingtonDairy from './src/data/safeway-farmington-dairy-new-trending-2026-09-19.js';
import safewayFarmingtonMeat from './src/data/safeway-farmington-meat-2026-09-19.js';
import albertsonsProduce from './imports/manual/albertsons-produce-2026-09-19.json';
import smithsPasted from './src/data/smiths-farmington-pasted-2026-09-19.js';
import walmartScreenRecording from './src/data/walmart-farmington-screenrecording-2026-09-20.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

const RETAILERS={
  Walmart:{prefix:'walmart-',hosts:['www.walmart.com','walmart.com']},
  "Smith's":{prefix:'smiths-',hosts:['www.smithsfoodanddrug.com','smithsfoodanddrug.com']},
  "Sam's Club":{prefix:'sams-',hosts:['www.samsclub.com','samsclub.com']},
  Albertsons:{prefix:'albertsons-',hosts:['www.albertsons.com','albertsons.com']},
  Safeway:{prefix:'safeway-',hosts:['www.safeway.com','safeway.com']}
};
const stores=new Set(Object.keys(RETAILERS));
const STOP=new Set(['the','a','an','and','or','of','with','fresh','all','natural','value','great','kroger','marketside','members','member','mark','brand','pack','ct','oz','lb','lbs','each','priced','per','pound','case','bundle','tray','roll','vacuum','cryovac']);
function positivePrice(n){n=Number(n);return Number.isFinite(n)&&n>0?n:null}
function norm(s){return String(s||'').toLowerCase().replace(/®|™/g,'').replace(/[^a-z0-9%]+/g,' ').trim()}
function tokens(s){return norm(s).split(/\s+/).filter(x=>x.length>1&&!STOP.has(x))}
function signature(p){
 const s=norm((p.name||'')+' '+(p.package||''));
 const lean=s.match(/(\d{2})\s*%?\s*(?:lean)?\s*[\/-]\s*(\d{1,2})\s*%?/);
 const size=s.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|oz|fl oz|ct|count|pk|pack)\b/);
 const kind=tokens(p.name).filter(x=>!/^\d/.test(x)).slice(0,8);
 return {lean:lean?lean[1]+'/'+lean[2]:null,size:size?size[1]+' '+size[2].replace('lbs','lb').replace('count','ct').replace('pack','pk'):null,kind};
}
function similarity(a,b){
 const A=new Set(a.kind),B=new Set(b.kind);let common=0;for(const x of A)if(B.has(x))common++;
 return common/Math.max(1,Math.min(A.size,B.size));
}
const CATEGORY_RULES=[
 ['Meat & Seafood',/\b(beef|steak|chuck|sirloin|ribeye|brisket|roast|tenderloin|round|flank|skirt|short ribs?|ground beef|chicken|turkey|pork|bacon|sausage|ham|fish|salmon|shrimp|seafood|meat)\b/],
 ['Milk & Dairy',/\b(milk|half and half|creamer)\b/],
 ['Bread & Bakery',/\b(bread|bun|tortilla|bagel|english muffin|bakery)\b/],
 ['Eggs',/\b(egg|eggs)\b/],
 ['Butter & Margarine',/\b(butter|margarine)\b/],
 ['Cheese',/\b(cheese|cheddar|mozzarella|parmesan|colby|swiss|provolone)\b/],
 ['Produce',/\b(apple|banana|orange|lemon|lime|berry|berries|strawberry|grape|potato|onion|carrot|broccoli|spinach|lettuce|pepper|cucumber|tomato|avocado|produce|fruit|vegetable)\b/],
 ['Coffee & Tea',/\b(coffee|espresso|k cup|k-cup|tea|cold brew)\b/],
 ['Breakfast',/\b(cereal|oatmeal|pancake|waffle|syrup|breakfast)\b/],
 ['Pantry',/\b(pasta|spaghetti|rice|bean|beans|sauce|flour|sugar|oil|peanut butter|jelly|jam|spice|seasoning|canned)\b/],
 ['Frozen',/\b(frozen|ice cream|pizza)\b/],
 ['Snacks',/\b(chip|cracker|cookie|snack|popcorn|granola)\b/],
 ['Beverages',/\b(water|juice|soda|drink|beverage)\b/],
 ['Prepared Foods',/\b(deli|prepared|rotisserie|meal|taquito|bowl)\b/]
];
function categoryFor(p){const t=norm((p.name||'')+' '+(p.package||''));for(const [name,re] of CATEGORY_RULES)if(re.test(t))return name;return 'Other Grocery'}

const FAMILY_RULES=[
 ['ground-beef',/\bground\s+(beef|chuck|sirloin|round)\b/],
 ['beef-steak',/\b(ribeye|strip steak|new york strip|t-bone|porterhouse|sirloin steak|flank steak|skirt steak|beef steak)\b/],
 ['beef-roast',/\b(chuck roast|beef roast|rump roast|round roast|pot roast)\b/],
 ['brisket',/\bbrisket\b/],['chicken-breast',/\bchicken\b.*\bbreast/],['chicken-thigh',/\bchicken\b.*\bthigh/],
 ['chicken-drumstick',/\bchicken\b.*\bdrumstick/],['whole-chicken',/\b(whole chicken|whole fryer|whole roaster)\b/],
 ['pork-chop',/\bpork\b.*\bchop/],['pork-loin',/\bpork\b.*\bloin/],['pork-shoulder',/\b(pork shoulder|pork butt|boston butt)\b/],
 ['bacon',/\bbacon\b/],['sausage',/\bsausage\b/],['ground-turkey',/\bground turkey\b/],
 ['milk',/\bmilk\b/],['creamer',/\bcreamer\b/],['butter',/\bbutter\b/],['margarine',/\bmargarine\b/],
 ['eggs',/\beggs?\b/],['shredded-cheese',/\b(shredded|shreds)\b.*\bcheese\b|\bcheese\b.*\b(shredded|shreds)\b/],
 ['sliced-cheese',/\b(sliced|slices)\b.*\bcheese\b|\bcheese\b.*\b(sliced|slices)\b/],
 ['cream-cheese',/\bcream cheese\b/],['sour-cream',/\bsour cream\b/],
 ['sandwich-bread',/\b(white|wheat|sandwich)\b.*\bbread\b|\bbread\b.*\b(white|wheat|sandwich)\b/],
 ['hamburger-buns',/\b(hamburger|burger) buns?\b/],['hotdog-buns',/\b(hot dog|hotdog) buns?\b/],
 ['tortillas',/\btortillas?\b/],['spaghetti',/\bspaghetti\b/],['pasta-sauce',/\b(pasta|spaghetti|marinara) sauce\b/],
 ['rice',/\brice\b/],['coffee',/\bcoffee\b/]
];
function familyFor(p){const t=norm((p.name||'')+' '+(p.package||''));for(const [family,re] of FAMILY_RULES)if(re.test(t))return family;return null}
function attrFlag(t,re){return re.test(t)}
function parseQty(t){
 const multi=t.match(/(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(lb|lbs|oz|fl oz|gal|gallon|qt|ct|count)\b/);
 let count=1,value=null,unit=null;
 if(multi){count=Number(multi[1]);value=Number(multi[2]);unit=multi[3]}else{const m=t.match(/(\d+(?:\.\d+)?)\s*(lb|lbs|oz|fl oz|gal|gallon|qt|ct|count)\b/);if(m){value=Number(m[1]);unit=m[2]}}
 if(!value)return {value:null,unit:null,total:null,basis:null};
 unit=unit.replace('lbs','lb').replace('gallon','gal').replace('count','ct');
 let total=value*count,basis=unit;
 if(unit==='lb'){total*=16;basis='oz'}else if(unit==='gal'){total*=128;basis='fl oz'}else if(unit==='qt'){total*=32;basis='fl oz'}
 return {value,unit,total,basis,count};
}
function productIdentity(p){
 const t=norm((p.name||'')+' '+(p.package||'')), family=familyFor(p), qty=parseQty(t);
 const lean=t.match(/\b(73|75|80|81|85|90|93|96)\s*%?\s*(?:lean)?\s*[\/-]\s*(27|25|20|19|15|10|7|4)\b/)||t.match(/\b(73|75|80|81|85|90|93|96)\s*%\s*lean\b/);
 return {family,lean:lean?(lean[2]?lean[1]+'/'+lean[2]:lean[1]+'%'):null,qty,
  frozen:attrFlag(t,/\bfrozen\b/),organic:attrFlag(t,/\borganic\b/),grassFed:attrFlag(t,/\bgrass fed\b/),
  patties:attrFlag(t,/\bpatt(y|ies)\b/),boneless:attrFlag(t,/\bboneless\b/),boneIn:attrFlag(t,/\bbone in\b/),
  whole:attrFlag(t,/\bwhole milk\b/),twoPct:attrFlag(t,/\b2\s*%\b/),onePct:attrFlag(t,/\b1\s*%\b/),skim:attrFlag(t,/\b(skim|fat free)\b/),
  salted:attrFlag(t,/\bsalted\b/)&&!attrFlag(t,/\bunsalted\b/),unsalted:attrFlag(t,/\bunsalted\b/),
  white:attrFlag(t,/\bwhite\b/),wheat:attrFlag(t,/\bwheat\b/),
  tokens:new Set(tokens(p.name).filter(x=>!/^\d/.test(x)))};
}
function hardConflict(a,b){
 if(!a.family||a.family!==b.family)return true;
 for(const k of ['lean','frozen','organic','grassFed','patties','boneless','boneIn','whole','twoPct','onePct','skim','salted','unsalted','white','wheat']){
  if(typeof a[k]==='boolean'&&typeof b[k]==='boolean'&&a[k]!==b[k]&&(a[k]||b[k]))return true;
  if(k==='lean'&&a[k]&&b[k]&&a[k]!==b[k])return true;
 }
 return false;
}
function tokenScore(a,b){let common=0;for(const x of a.tokens)if(b.tokens.has(x))common++;const union=new Set([...a.tokens,...b.tokens]).size;return union?common/union:0}
function relation(a,b){
 if(hardConflict(a,b))return null;
 const sameBasis=a.qty.basis&&a.qty.basis===b.qty.basis;
 const sameSize=sameBasis&&a.qty.total!=null&&b.qty.total!=null&&Math.abs(a.qty.total-b.qty.total)<0.01;
 const score=tokenScore(a,b);
 if(sameSize)return {type:'equivalent',score:Math.max(.9,score)};
 if(sameBasis)return {type:'unit-comparable',score:Math.max(.82,score)};
 if(score>=.62)return {type:'equivalent',score};
 return null;
}
function canonicalize(products){
 const groups=[];
 for(const p of products){
  const identity=productIdentity(p);let best=null,bestRel=null;
  if(!identity.family){groups.push({id:'group-'+groups.length,identity,name:p.name,products:[p],relations:{[p.store]:'unmatched'}});continue}
  for(const g of groups){
   if(g.products.some(x=>x.store===p.store))continue;
   const rel=relation(identity,g.identity);if(rel&&(!bestRel||rel.score>bestRel.score)){best=g;bestRel=rel}
  }
  if(!best){best={id:'group-'+groups.length,identity,name:p.name,products:[],relations:{}};groups.push(best);bestRel={type:'unmatched',score:1}}
  best.products.push(p);best.relations[p.store]=best.products.length===1?'reference':bestRel.type;
 }
 return groups.map(g=>({id:g.id,name:g.name,variant:{family:g.identity.family,lean:g.identity.lean,size:g.identity.qty.total!=null?(g.identity.qty.total+' '+g.identity.qty.basis):null},relations:g.relations,stores:Object.fromEntries(g.products.map(p=>[p.store,p])),products:g.products}));
}


export function validateUpload(body){
 if(!/^[a-f0-9]{64}$/.test(body.hash||'')||typeof body.filename!=='string'||body.filename.length>180||!Array.isArray(body.products)||!body.products.length||body.products.length>3000||!Array.isArray(body.rows)||body.rows.length>10000)throw Error('Invalid spreadsheet payload.');
 for(const p of body.products){
  if(!stores.has(p.store)||typeof p.name!=='string'||!p.name||p.name.length>1500||!/^[A-Za-z0-9._-]+$/.test(p.sku)||!Array.isArray(p.observations)||!p.observations.length)throw Error('Invalid product record.');
  const retailer=RETAILERS[p.store];
  if(p.id!==retailer.prefix+p.sku)throw Error('Invalid product identity.');
  for(const o of p.observations){
   if(![o.price,o.unit_price].some(n=>typeof n==='number'&&Number.isFinite(n)&&n>0))throw Error('Product needs a usable price.');
   for(const k of ['price','regular_price','promo_price','unit_price'])if(o[k]!=null&&(typeof o[k]!=='number'||!Number.isFinite(o[k])||o[k]<=0||o[k]>100000))throw Error('Invalid price.');
   const u=new URL(o.source?.source_url);
   if(u.protocol!=='https:'||!retailer.hosts.includes(u.hostname))throw Error('Invalid retailer source.');
   const urlText=decodeURIComponent(u.pathname+u.search);
   if(!urlText.includes(p.sku))throw Error('Invalid retailer source.');
   if(!Number.isInteger(o.source.row)||o.source.row<2)throw Error('Invalid source row.');
  }
 }
 const usable=body.products.reduce((n,p)=>n+p.observations.length,0);
 if(usable!==body.rows.filter(r=>r.status==='represented').length)throw Error('Source row reconciliation failed.');
 return usable;
}

async function importCollectorSnapshot(env,snapshot){
 if(!env.UPLOADS||!Array.isArray(snapshot?.products))throw Error('Invalid collector snapshot');
 const now=new Date().toISOString(),hash='collector-'+now.replace(/[^0-9]/g,'');
 const products=snapshot.products.filter(p=>stores.has(p.store)&&p.sku&&Array.isArray(p.observations)&&p.observations.some(o=>Number(o.price)>0||Number(o.unit_price)>0));
 const data={hash,filename:'Automated direct/API collectors '+now,imported_at:now,products,rows:[],usable_rows:products.length,source:'direct-api-collectors',checks:snapshot.checks||[]};
 await env.UPLOADS.prepare('INSERT OR REPLACE INTO uploads (hash,filename,imported_at,data) VALUES (?,?,?,?)').bind(hash,data.filename,now,JSON.stringify(data)).run();
 return products.length;
}
export default {async fetch(request,env){
 const url=new URL(request.url);



 if(url.pathname==='/api/collector-import'&&request.method==='POST'){
  if(!env.UPLOADS)return json({error:'Catalog storage unavailable'},503);
  if(!env.COLLECTOR_IMPORT_KEY||request.headers.get('Authorization')!==`Bearer ${env.COLLECTOR_IMPORT_KEY}`)return json({error:'Unauthorized'},401);
  try{const body=await request.json();const saved=await importCollectorSnapshot(env,body);return json({saved:true,products:saved})}catch(e){return json({error:e.message||'Collector import failed'},400)}
 }
 if(url.pathname==='/api/catalog'){
  // Merge retailer page data pasted directly by the user. These observations are Farmington-local.
  if(!env.UPLOADS)return json({error:'Catalog storage unavailable'},503);
  const r=await env.UPLOADS.prepare('SELECT data FROM uploads ORDER BY imported_at, hash').all();
  const products=new Map();
  for(const batch of r.results){
   let data;try{data=JSON.parse(batch.data)}catch{continue}
   for(const p of data.products||[]){
    p.observations=(p.observations||[]).map(o=>({...o,price:o.price>0?o.price:null,promo_price:o.promo_price>0?o.promo_price:null,regular_price:o.regular_price>0?o.regular_price:null,unit_price:o.unit_price>0?o.unit_price:null})).filter(o=>o.price||o.promo_price||o.unit_price);
    if(!p.observations.length)continue;
    const key=p.store+'|'+p.sku, prior=products.get(key);
    const observations=[...(prior?.observations||[]),...(p.observations||[])];
    products.set(key,{...p,observations});
   }
  }
  for(const row of samsAlbuquerqueSavings.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:positivePrice(row.regular_price),promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||null,observed_at:samsAlbuquerqueSavings.captured_at,availability:row.out_of_stock?'out_of_stock':'available',source:{collector:'pasted-retailer-page',source_scope:'new_mexico',store_location:samsAlbuquerqueSavings.location,store_id:samsAlbuquerqueSavings.store_id,source_url:row.source_url||'https://www.samsclub.com/'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'sams-'+sku,sku,store:"Sam's Club",name:row.name,package:'',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const row of samsAlbuquerqueBeef.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:null,promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||'lb',observed_at:samsAlbuquerqueBeef.captured_at,availability:row.out_of_stock?'out_of_stock':'available',source:{collector:'pasted-retailer-page',source_scope:'new_mexico',store_location:samsAlbuquerqueBeef.location,store_id:samsAlbuquerqueBeef.store_id,source_url:'https://www.samsclub.com/browse/beef/1548'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'sams-'+sku,sku,store:"Sam's Club",name:row.name,package:'priced per pound',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const row of safewayFarmingtonDairy.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:positivePrice(row.regular_price),promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||null,observed_at:safewayFarmingtonDairy.captured_at,availability:row.out_of_stock?'out_of_stock':'available',source:{collector:'pasted-retailer-page',source_scope:'farmington',store_location:safewayFarmingtonDairy.location,source_url:row.source_url||'https://www.safeway.com/'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'safeway-'+sku,sku,store:'Safeway',name:row.name,package:'',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const row of safewayFarmingtonMeat.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:positivePrice(row.regular_price),promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||null,observed_at:safewayFarmingtonMeat.captured_at,availability:row.out_of_stock?'out_of_stock':'available',source:{collector:'pasted-retailer-page',source_scope:'farmington',store_location:safewayFarmingtonMeat.location,source_url:row.source_url||'https://www.safeway.com/'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'safeway-'+sku,sku,store:'Safeway',name:row.name,package:'',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const row of albertsonsProduce.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:positivePrice(row.regular_price),promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||null,observed_at:albertsonsProduce.captured_at,availability:row.out_of_stock?'out_of_stock':'available',source:{collector:'pasted-retailer-page',source_scope:'farmington',store_location:albertsonsProduce.location,source_url:'https://www.albertsons.com/'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'albertsons-'+sku,sku,store:'Albertsons',name:row.name,package:row.package||'',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const row of walmartScreenRecording.products||[]){
   const sku=String(row.sku),obs={price:positivePrice(row.price),regular_price:positivePrice(row.regular_price),promo_price:null,unit_price:positivePrice(row.unit_price),unit:row.unit||null,observed_at:walmartScreenRecording.captured_at,availability:'available',source:{collector:'screen-recording',source_scope:'farmington',store_location:walmartScreenRecording.location,source_url:row.source_url||'https://www.walmart.com/search?q=all%20grocery'}};
   if(!obs.price&&!obs.unit_price)continue;const p={id:'walmart-'+sku,sku,store:'Walmart',name:row.name,package:'',observations:[obs]},key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  for(const [i,row] of smithsPasted.products.entries()){
   const [name,price,regular_price,pkg,unit_price,unit]=row;
   const sku='pasted-'+String(i+1).padStart(3,'0')+'-'+norm(name).replace(/\s+/g,'-').slice(0,70);
   const obs={price,regular_price:regular_price>price?regular_price:null,promo_price:regular_price>price?price:null,unit_price,unit,observed_at:smithsPasted.captured,source:{collector:'pasted-retailer-page',source_scope:'farmington',store_location:smithsPasted.location,source_url:'https://www.smithsfoodanddrug.com/',page:'On Sale - 104 results'}};
   const p={id:'smiths-'+sku,sku,store:"Smith's",name,package:pkg||'',observations:[obs]};
   const key=p.store+'|'+p.sku,prior=products.get(key);products.set(key,{...p,observations:[...(prior?.observations||[]),obs]});
  }
  const list=[...products.values()].map(p=>({...p,category:categoryFor(p)}));const groups=canonicalize(list).map(g=>({...g,category:g.products[0]?.category||'Other Grocery'}));return json({products:list,groups,batches:r.results.length,category_order:CATEGORY_RULES.map(x=>x[0]).concat(['Other Grocery'])});
 }
 if(url.pathname==='/api/uploads'){
  if(!env.UPLOADS)return json({error:'Upload storage unavailable'},503);
  if(request.method==='GET'){
   const r=await env.UPLOADS.prepare('SELECT data FROM uploads ORDER BY imported_at, hash').all();
   return json({batches:r.results.map(r=>JSON.parse(r.data))});
  }
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!env.UPLOAD_PASSWORD||request.headers.get('Authorization')!==`Bearer ${env.UPLOAD_PASSWORD}`)return json({error:'Enter the correct upload password.'},401);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Origin not allowed'},403);
  if(Number(request.headers.get('Content-Length'))>5*1024*1024)return json({error:'Upload is too large.'},413);
  try{
   const text=await request.text();if(text.length>5*1024*1024)return json({error:'Upload is too large.'},413);
   const body=JSON.parse(text),usable=validateUpload(body),now=new Date().toISOString();
   if(env.BASELINE_HASHES?.includes(body.hash))return json({saved:true,duplicate:true,usable_rows:usable,excluded_rows:body.rows.length-usable});
   for(const p of body.products)for(const o of p.observations){o.imported_at=now;o.observed_at=null;o.source.file=body.filename;}
   body.imported_at=now;body.usable_rows=usable;
   const result=await env.UPLOADS.prepare('INSERT OR IGNORE INTO uploads (hash,filename,imported_at,data) VALUES (?,?,?,?)').bind(body.hash,body.filename,now,JSON.stringify(body)).run();
   return json({saved:true,duplicate:result.meta.changes===0,usable_rows:usable,excluded_rows:body.rows.length-usable});
  }catch(e){return json({error:e.message||'Could not save spreadsheet.'},400)}
 }
 return env.ASSETS.fetch(request);
}};