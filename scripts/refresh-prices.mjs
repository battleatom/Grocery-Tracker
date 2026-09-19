import fs from'node:fs/promises';
const FILE='public/data/prices.json',HISTORY='public/data/history.json',DEALS='public/data/deals.json';
const data=JSON.parse(await fs.readFile(FILE,'utf8'));let deals={meta:{location:'Farmington, NM'},stores:[]};try{deals=JSON.parse(await fs.readFile(DEALS,'utf8'))}catch{}
const sources=[
 {store:0,url:'https://www.samsclub.com/club/6347/grocery',name:"Sam's #6347"},
 {store:1,url:'https://www.walmart.com/store/3428-farmington-nm/shopping-services',name:'Walmart #3428'},
 {store:2,url:'https://local.albertsons.com/nm/farmington/4909-e-main-st.html',name:'Albertsons 4909 E Main'},
 {store:3,url:'https://local.safeway.com/safeway/nm/farmington/3540-e-main-st.html',name:'Safeway 3540 E Main'},
 {store:4,url:'https://www.smithsfoodanddrug.com/?cid=loc_70600376_order&setModalityTo=PICKUP_70600376',name:"Smith's Farmington pickup"}
];
const rules={
 0:[
  ['bananas',/Bananas, 3 lbs[\s\S]{0,900}?\$1[ .]?47[\s\S]{0,300}?\$0[ .]?49\/lb/i,1.47,.49,'lb'],
  ['chicken-nuggets',/Tyson Breaded Chicken Nuggets[\s\S]{0,1200}?\$9[ .]?97[\s\S]{0,500}?\$1[ .]?99\/lb/i,9.97,1.99,'lb'],
  ['red-grapes',/Red Seedless Grapes, 3 lbs[\s\S]{0,900}?\$5[ .]?97[\s\S]{0,300}?\$1[ .]?99\/lb/i,5.97,1.99,'lb'],
  ['paper-plates',/Ultra Dinner Paper Plates[\s\S]{0,900}?\$18[ .]?98[\s\S]{0,300}?\$0[ .]?09\/ea/i,18.98,.09,'each'],
  ['crunchable-variety',/Crunchable Variety Pack[\s\S]{0,900}?\$11[ .]?48[\s\S]{0,300}?\$0[ .]?64\/ea/i,11.48,.64,'each'],
  ['mini-rice-cakes',/Mini Rice Cakes Variety Pack[\s\S]{0,900}?\$14[ .]?98[\s\S]{0,300}?\$0[ .]?63\/oz/i,14.98,.63,'oz']
 ],
 1:[
  ['eggs-18',/Marketside Cage Free Large Brown Eggs 18 Count[\s\S]{0,1200}?\$3[ .]?93[\s\S]{0,400}?21[ .]?8.{0,8}\/ea/i,3.93,.218,'each'],
  ['gala-apples',/Fresh Gala Apples, 3 lb Bag[\s\S]{0,1200}?\$3[ .]?24[\s\S]{0,400}?\$1[ .]?08\/lb/i,3.24,1.08,'lb'],
  ['red-grapes',/Red Seedless Grapes[\s\S]{0,1400}?\$3[ .]?76[\s\S]{0,500}?\$1[ .]?67\/lb/i,3.76,1.67,'lb'],
  ['pineapple',/Fresh Pineapple, Each[\s\S]{0,1000}?\$1[ .]?98/i,1.98,1.98,'each'],
  ['jalapeno',/Fresh Jalapenos, Each[\s\S]{0,1200}?\$0[ .]?18[\s\S]{0,500}?\$1[ .]?32\/lb/i,.18,1.32,'lb'],
  ['texas-toast',/Five Cheese Texas Toast[\s\S]{0,1200}?\$2[ .]?08[\s\S]{0,500}?15[ .]?4.{0,8}\/oz/i,2.08,.154,'oz'],
  ['pizza-rolls',/Totino.{0,20}Pizza Rolls[\s\S]{0,1400}?\$10[ .]?67[\s\S]{0,500}?16[ .]?8.{0,8}\/oz/i,10.67,.168,'oz'],
  ['bread',/Nature.{0,10}Own Honey Wheat[\s\S]{0,1400}?\$3[ .]?37[\s\S]{0,500}?16[ .]?9.{0,8}\/oz/i,3.37,.169,'oz'],
  ['chocolate-chip-muffins',/Chocolate Chip Muffins[\s\S]{0,1200}?\$3[ .]?98[\s\S]{0,500}?28[ .]?4.{0,8}\/oz/i,3.98,.284,'oz']
 ],
 2:[],
 3:[],
 4:[
  ['ground-beef-80',/3 lb.{0,20}80\/20 ground beef[\s\S]{0,500}?\$3[ .]?99\/lb/i,11.97,3.99,'lb'],
  ['chicken-breast',/Boneless Chicken Breast[\s\S]{0,500}?\$2[ .]?99\/lb/i,2.99,2.99,'lb'],
  ['avocado-large',/large avocados? for 99/i,.99,.99,'each'],
  ['honeycrisp-apples',/honey crisp apples for \$1[ .]?99\/lb/i,1.99,1.99,'lb'],
  ['mandarins-3lb',/3 lb.{0,10}mandarins for \$2[ .]?99/i,8.97,2.99,'lb']
 ]
};
let history=[];try{history=JSON.parse(await fs.readFile(HISTORY,'utf8'))}catch{}
let changed=0;const now=new Date().toISOString();
const checks=[];for(const src of sources){try{const res=await fetch(src.url,{headers:{'user-agent':'Mozilla/5.0 GroceryTracker/1.0'}});checks.push({store:src.name,status:res.status,checked_at:now,url:src.url});if(!res.ok)continue;const html=(await res.text()).replace(/&cent;/g,'¢').replace(/&amp;/g,'&');for(const [id,re,price,unit_price,unit] of (rules[src.store]||[])){if(!re.test(html))continue;const item=data.items.find(x=>x.id===id);if(!item)continue;const old=item.offers[src.store];item.offers[src.store]={...(old||{}),price,unit_price,unit,source:src.name,observed:now.slice(0,10),automated:true};history.push({at:now,item:id,store:data.meta.stores[src.store],price,unit_price,unit});changed++}}catch(e){checks.push({store:src.name,status:'error',checked_at:now,error:e.message,url:src.url});console.error(src.name,e.message)}}
data.meta.automation={last_run:now,matched:changed,schedule:'daily',source_checks:checks,policy:'retain last verified value when a source cannot be parsed; last_run is a check time, not a price freshness claim'};deals.meta.updated_at=now;deals.meta.source_checks=checks;if(changed>0)data.meta.updated_at=now;
await fs.writeFile(FILE,JSON.stringify(data,null,2)+'\n');await fs.writeFile(HISTORY,JSON.stringify(history.slice(-5000),null,2)+'\n');await fs.writeFile(DEALS,JSON.stringify(deals,null,2)+'\n');console.log('verified matches',changed);