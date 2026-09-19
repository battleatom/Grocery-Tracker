import re
from urllib.parse import urlparse, parse_qs
from normalize import first, money, clean, normalized_observation

def _sku(url):
    text=urlparse(url).path+"?"+urlparse(url).query
    m=re.search(r"product-details[/.]([A-Za-z0-9._-]+)",text,re.I)
    if m: return m.group(1)
    q=parse_qs(urlparse(url).query)
    for k in ("productId","sku","upc"):
        if q.get(k): return q[k][0]
    nums=re.findall(r"\d{6,}",urlparse(url).path)
    return nums[-1] if nums else ""

def parse(row, source_file, sheet, row_number):
    url=clean(first(row,"href","url","URL","product_url","Product URL","link","w-100 href"))
    sku=_sku(url) if url else ""
    name=clean(first(row,"title-xxs 2","title-xxs","name","normal","title","Product"))
    price=money(first(row,"color-neutral-90","sr-only","price","Price","current_price","Current Price"))
    regular=money(first(row,"body-text-xxs 2","sr-only 3","regular_price","Regular Price"))
    unit_text=clean(first(row,"body-text-xxs","sr-only 2"))
    unit_price=money(unit_text)
    if not (sku and name and (price or unit_price)): return None
    return normalized_observation(retailer="Albertsons",retailer_sku=sku,name=name,package=name,price=price or unit_price,regular_price=regular,unit_price=unit_price,unit=None,source_url=url,source_file=source_file,source_sheet=sheet,source_row=row_number)
