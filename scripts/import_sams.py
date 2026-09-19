from urllib.parse import urlparse, parse_qs, unquote
from normalize import first, money, clean, normalized_observation

def parse(row, source_file, sheet, row_number):
    raw=clean(first(row,"w-100 href","href","url","URL"))
    if not raw: return None
    parsed=urlparse(raw)
    rd=parse_qs(parsed.query).get("rd")
    url=unquote(rd[0]) if rd else raw
    sku=urlparse(url).path.rstrip("/").split("/")[-1]
    name=clean(first(row,"normal","name","title","Product"))
    current=clean(next((v for v in row.values() if str(v).startswith("current price")),""))
    price=money(current) or money(first(row,"price","Price","current_price","Current Price","f2"))
    if not (sku and name and price): return None
    return normalized_observation(retailer="Sam's Club",retailer_sku=sku,name=name,package=clean(first(row,"package","Package","size","Size") or name),price=price,regular_price=money(first(row,"regular_price","Regular Price","f5","strike")),unit_price=None,unit=None,source_url=url,source_file=source_file,source_sheet=sheet,source_row=row_number)
