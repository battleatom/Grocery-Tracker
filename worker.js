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
 ['Meat & Seafood',/\b(beef|steak|ground beef|chicken|turkey|pork|bacon|sausage|ham|fish|salmon|shrimp|seafood|meat)\b/],
 ['Milk & Dairy',/\b(milk|half and half|creamer)\b/],
 ['Bread & Bakery',/\b(bread|bun|roll|tortilla|bagel|english muffin|bakery)\b/],
 ['Eggs',/\b(egg|eggs)\b/],
 ['Butter & Margarine',/\b(butter|margarine)\b/],
 ['Cheese',/\b(cheese|cheddar|mozzarella|parmesan|colby|swiss|provolone)\b/],
 ['Produce',/\b(apple|banana|orange|lemon|lime|berry|berries|strawberry|grape|potato|onion|carrot|broccoli|spinach|lettuce|pepper|cucumber|tomato|avocado|produce|fruit|vegetable)\b/],
 ['Coffee & Tea',/\b(coffee|espresso|k cup|k-cup|tea|cold brew)\b/],
 ['Breakfast',/\b(cereal|oatmeal|pancake|waffle|syrup|breakfast)\b/],
 ['Pantry',/\b(pasta|rice|bean|beans|sauce|flour|sugar|oil|peanut butter|jelly|jam|spice|seasoning|canned)\b/],
 ['Frozen',/\b(frozen|ice cream|pizza)\b/],
 ['Snacks',/\b(chip|cracker|cookie|snack|popcorn|granola)\b/],
 ['Beverages',/\b(water|juice|soda|drink|beverage)\b/],
 ['Prepared Foods',/\b(deli|prepared|rotisserie|meal|taquito|bowl)\b/]
];
function categoryFor(p){const t=norm((p.name||'')+' '+(p.package||''));for(const [name,re] of CATEGORY_RULES)if(re.test(t))return name;return 'Other Grocery'}
function canonicalize(products){
 const groups=[];
 for(const p of products){
  const sig=signature(p);let best=null,bestScore=0;
  for(const g of groups){
   const gs=g.signature;
   if(sig.lean&&gs.lean&&sig.lean!==gs.lean)continue;
   if(sig.size&&gs.size&&sig.size!==gs.size)continue;
   const score=similarity(sig,gs);
   const crossStore=!g.products.some(x=>x.store===p.store);
   if(crossStore&&score>bestScore){bestScore=score;best=g}
  }
  if(!best||bestScore<0.72){best={id:'group-'+groups.length,signature:sig,name:p.name,products:[]};groups.push(best)}
  best.products.push(p);
 }
 return groups.map(g=>({id:g.id,name:g.name,variant:{lean:g.signature.lean,size:g.signature.size},stores:Object.fromEntries(g.products.map(p=>[p.store,p])),products:g.products}));
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

export default {async fetch(request,env){
 const url=new URL(request.url);



 if(url.pathname==='/api/catalog'){
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