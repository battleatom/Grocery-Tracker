import puppeteer from '@cloudflare/puppeteer';

export const ESSENTIAL_SEARCHES=[
 'ground beef 80/20','ground beef 93/7','chicken breast','chicken thighs','chicken drumsticks','pork chops','pork loin','pork shoulder','bacon','italian sausage','ground turkey','hot dogs',
 'whole milk','2% milk','coffee creamer','butter','shredded cheese','sliced cheese','cream cheese','sour cream','eggs',
 'white bread','wheat bread','hamburger buns','hot dog buns','flour tortillas',
 'spaghetti pasta','pasta sauce','taco shells','taco seasoning','rice','black beans','pinto beans','canned tomatoes','tomato sauce','chicken broth','flour','sugar','vegetable oil',
 'potatoes','onions','tomatoes','lettuce','bell peppers','bananas','apples','oranges',
 'cereal','oatmeal','pancake mix','syrup','coffee','peanut butter','jelly','frozen vegetables','french fries','frozen pizza'
];

const STORES={
 Walmart:{host:'www.walmart.com',search:q=>'https://www.walmart.com/search?q='+encodeURIComponent(q),prefix:'walmart-'},
 "Smith's":{host:'www.smithsfoodanddrug.com',search:q=>'https://www.smithsfoodanddrug.com/search?query='+encodeURIComponent(q),prefix:'smiths-'},
 "Sam's Club":{host:'www.samsclub.com',search:q=>'https://www.samsclub.com/s/'+encodeURIComponent(q),prefix:'sams-'}
};
const money=x=>{const m=String(x||'').match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);return m?Number(m[1]):null};
const sku=(href,store)=>{try{const u=new URL(href);const m=decodeURIComponent(u.pathname+u.search).match(/(?:\/|productId=|sku=)(\d{5,})(?:[/?&]|$)/i);return m?.[1]||null}catch{return null}};
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();

async function scrapeSearch(page,store,query){
 const cfg=STORES[store];await page.goto(cfg.search(query),{waitUntil:'domcontentloaded',timeout:30000});await new Promise(r=>setTimeout(r,1800));
 for(let i=0;i<3;i++){await page.evaluate(()=>scrollBy(0,innerHeight*1.7));await new Promise(r=>setTimeout(r,500))}
 return await page.evaluate(({host})=>{
  const out=[];for(const a of document.querySelectorAll('a[href]')){
   let u;try{u=new URL(a.href)}catch{continue}if(!u.hostname.endsWith(host.replace(/^www\./,'')))continue;
   const box=a.closest('article,li,[data-item-id],[data-testid*="item"],[class*="product"],div')||a;
   const text=(box.innerText||a.innerText||'').replace(/\s+/g,' ').trim();
   if(text.length<8||text.length>900||!(/\$\s*\d/.test(text)))continue;
   const name=(a.getAttribute('aria-label')||a.getAttribute('title')||a.innerText||text.split('$')[0]).replace(/\s+/g,' ').trim();
   if(name.length<3)continue;out.push({href:u.href,name,text});
  }return out.slice(0,80);
 },{host:cfg.host});
}

export async function runEssentialScrape(env,{stores=Object.keys(STORES),queries=ESSENTIAL_SEARCHES,maxQueries=8}={}){
 if(!env.BROWSER)throw Error('Browser Run binding is not configured');
 const browser=await puppeteer.launch(env.BROWSER);const page=await browser.newPage();
 await page.setRequestInterception(true);page.on('request',r=>['image','media','font'].includes(r.resourceType())?r.abort():r.continue());
 const found=new Map(),errors=[];try{
  for(const store of stores.filter(x=>STORES[x])){
   for(const query of queries.slice(0,maxQueries)){
    try{for(const r of await scrapeSearch(page,store,query)){const id=sku(r.href,store);const price=money(r.text);if(!id||!(price>0))continue;
     const key=store+'|'+id;const unitMatch=r.text.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(lb|oz|ct|each)/i);
     found.set(key,{id:STORES[store].prefix+id,sku:id,store,name:clean(r.name),package:clean(r.text.match(/\b\d+(?:\.\d+)?\s*(?:lb|lbs|oz|ct|count|fl oz)\b/i)?.[0]||''),source_url:r.href,observations:[{name:clean(r.name),price,regular_price:null,promo_price:null,unit_price:unitMatch?Number(unitMatch[1]):null,unit:unitMatch?.[2]?.toLowerCase()||null,source:{source_url:r.href,collector:'browser-run',query},observed_at:new Date().toISOString(),imported_at:new Date().toISOString(),scope:'Farmington essential-grocery browser discovery; verify retailer location context'}]});
    }}catch(e){errors.push({store,query,error:String(e.message||e)})}
   }
  }
 }finally{await browser.close()}
 return{products:[...found.values()],errors,queries:Math.min(maxQueries,queries.length),stores};
}
