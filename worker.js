const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

const RETAILERS={
  Walmart:{prefix:'walmart-',hosts:['www.walmart.com','walmart.com']},
  "Smith's":{prefix:'smiths-',hosts:['www.smithsfoodanddrug.com','smithsfoodanddrug.com']},
  "Sam's Club":{prefix:'sams-',hosts:['www.samsclub.com','samsclub.com']},
  Albertsons:{prefix:'albertsons-',hosts:['www.albertsons.com','albertsons.com']},
  Safeway:{prefix:'safeway-',hosts:['www.safeway.com','safeway.com']}
};
const stores=new Set(Object.keys(RETAILERS));

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
    const key=p.store+'|'+p.sku, prior=products.get(key);
    const observations=[...(prior?.observations||[]),...(p.observations||[])];
    products.set(key,{...p,observations});
   }
  }
  return json({products:[...products.values()],batches:r.results.length});
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