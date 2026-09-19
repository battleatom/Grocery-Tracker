const RETAILERS=[
 {store:'Walmart',prefix:'walmart-',hosts:['walmart.com']},
 {store:"Sam's Club",prefix:'sams-',hosts:['samsclub.com']},
 {store:"Smith's",prefix:'smiths-',hosts:['smithsfoodanddrug.com']},
 {store:'Albertsons',prefix:'albertsons-',hosts:['albertsons.com']},
 {store:'Safeway',prefix:'safeway-',hosts:['safeway.com']}
];

const numberFrom=value=>{const m=String(value??'').match(/\$?([0-9]+(?:\.[0-9]+)?)/);return m?Number(m[1]):null};
const first=(row,names)=>{for(const name of names)if(row[name]!=null&&String(row[name]).trim())return row[name];return null};

function retailerFromUrl(raw){
 try{
  let url=new URL(raw);
  const redirected=url.searchParams.get('rd');
  if(redirected)url=new URL(redirected);
  const retailer=RETAILERS.find(r=>r.hosts.some(h=>url.hostname===h||url.hostname.endsWith('.'+h)));
  return retailer?{retailer,url}:null;
 }catch{return null}
}

function skuFromUrl(url,store){
 const text=decodeURIComponent(url.pathname+url.search);
 if(store==='Albertsons'||store==='Safeway'){
  return text.match(/product-details[/.]([A-Za-z0-9._-]+)/i)?.[1]
    || text.match(/(?:productId|sku|upc)=([A-Za-z0-9._-]+)/i)?.[1]
    || text.match(/(?:^|\/)(\d{6,})(?:[/.?]|$)/)?.[1]
    || null;
 }
 return text.match(/\/(\d+)(?:\?|$)/)?.[1]||null;
}

export function parseSpreadsheetSheets(sheets,filename,importedAt=new Date().toISOString()){
 const products=new Map(),rows=[];
 for(const {name:sheet,values} of sheets){
  const [headers,...dataRows]=values;if(!headers)continue;
  dataRows.forEach((values,index)=>{
   const row=Object.fromEntries(headers.map((h,i)=>[h,values[i]??null]));
   const strings=values.filter(v=>v!=null).map(String);
   const rawUrl=first(row,['w-100 href','citrus-Link href','href','url','URL','product_url','Product URL','link']);
   const match=retailerFromUrl(rawUrl);
   const sourceUrl=match?.url?.href||rawUrl;
   const store=match?.retailer?.store;
   const sku=match?skuFromUrl(match.url,store):null;

   let productName=store==="Smith's"?first(row,['color-text-primary','name','normal','title']):store==='Albertsons'||store==='Safeway'?first(row,['title-xxs 2','title-xxs','name','normal','title','Product']):first(row,['normal','color-text-primary','name','title','Product']);
   let price=null,regularPrice=null,packageText='';
   if(store==="Smith's"){
    price=numberFrom(first(row,['citrus-Price--current-price','citrus-RelativePrice--current-price-value','price']));
    const sr=String(first(row,['citrus-Price--sr-description'])||'').match(/discounted from \$([\d.]+)/);
    regularPrice=numberFrom(first(row,['citrus-Price--original-price-value']))||(sr?Number(sr[1]):null);
    packageText=String(first(row,['color-text-neutral-primary 2','color-text-neutral-primary','package'])||'').replace(/[ |]+$/,'');
    if(packageText.includes('$')&&packageText.includes('/'))packageText='';
   }else{
    const current=strings.find(v=>v.startsWith('current price'))||'';
    const currentMatch=current.match(/current price (?:Now )?\$([\d.]+)/);
    price=currentMatch?Number(currentMatch[1]):numberFrom(first(row,['price','Price','current_price','Current Price','f2']));
    const was=current.match(/Was \$([\d.]+)/);
    regularPrice=was?Number(was[1]):numberFrom(first(row,['regular_price','Regular Price','f5','strike']));
    packageText=String(first(row,['package','Package','size','Size'])||productName||'');
   }

   const unitText=strings.find(v=>/^(?:\$[\d.]+|[\d.]+\s*¢)\s*\/\s*[a-zA-Z ]+$/.test(v))||null;
   const unitPrice=unitText?numberFrom(unitText)/(unitText.includes('¢')?100:1):null;
   const rowNumber=index+2;
   if(!store||!productName||!sku||!(price>0||unitPrice>0)){
    rows.push({sheet,row:rowNumber,status:'excluded',reason:'No product identity or usable price',raw:row});return;
   }
   const prefix=match.retailer.prefix,id=prefix+sku;
   const observation={name:productName,package:packageText,price,regular_price:regularPrice,promo_price:regularPrice&&price&&regularPrice>price?price:null,unit_price:unitPrice,unit:unitText?unitText.split('/').at(-1).trim():null,unit_price_text:unitText,source:{file:filename,sheet,row:rowNumber,source_url:sourceUrl,original_source_url:rawUrl,raw:row},price_basis:strings.includes('avg price')||strings.includes('Final cost by weight')||row['citrus-RelativePrice--relative-prefix']?'estimated package':'package',observed_at:null,imported_at:importedAt,scope:'Uploaded export; store location and observation time unspecified'};
   if(!products.has(id))products.set(id,{id,sku,store,name:productName,package:packageText,source_url:sourceUrl,observations:[]});
   products.get(id).observations.push(observation);
   rows.push({sheet,row:rowNumber,status:'represented',product_id:id});
  });
 }
 return{products:[...products.values()],rows,filename,usable_rows:rows.filter(r=>r.status==='represented').length};
}
