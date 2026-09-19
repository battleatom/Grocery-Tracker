from normalize import first, money, clean, normalized_observation

def parse(row, source_file, sheet, row_number):
    url=clean(first(row,"w-100 href","href","url","URL"))
    sku=url.split("?")[0].rstrip("/").split("/")[-1] if url else ""
    name=clean(first(row,"normal","name","title","Product"))
    current=clean(next((v for v in row.values() if str(v).startswith("current price")),""))
    price=money(current)
    if price is None:
        dollars=money(first(row,"price","Price","current_price","Current Price","f2"))
        cents=money(first(row,"f6 2"))
        price=(dollars+(cents/100)) if dollars is not None and cents is not None and cents<100 else dollars
    if not (sku and name and price): return None
    return normalized_observation(retailer="Walmart",retailer_sku=sku,name=name,package=clean(first(row,"package","Package","size","Size") or name),price=price,regular_price=money(first(row,"regular_price","Regular Price","f5","strike")),unit_price=None,unit=None,source_url=url,source_file=source_file,source_sheet=sheet,source_row=row_number)
