from normalize import first, money, clean, normalized_observation

def parse(row, source_file, sheet, row_number):
    url=clean(first(row,"citrus-Link href","href","url","URL"))
    sku=url.split("?")[0].rstrip("/").split("/")[-1] if url else ""
    name=clean(first(row,"color-text-primary","name","normal","title"))
    price=money(first(row,"citrus-Price--current-price","citrus-RelativePrice--current-price-value","price"))
    regular=money(first(row,"citrus-Price--original-price-value"))
    package=clean(first(row,"color-text-neutral-primary 2","color-text-neutral-primary","package"))
    if not (sku and name and price): return None
    return normalized_observation(retailer="Smith's",retailer_sku=sku,name=name,package=package,price=price,regular_price=regular,unit_price=None,unit=None,source_url=url,source_file=source_file,source_sheet=sheet,source_row=row_number)
