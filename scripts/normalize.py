from __future__ import annotations
import re
from decimal import Decimal, InvalidOperation

MONEY_RE = re.compile(r"([0-9]+(?:\.[0-9]+)?)")

def money(value):
    if value is None: return None
    m=MONEY_RE.search(str(value).replace(",",""))
    if not m: return None
    try: return float(Decimal(m.group(1)))
    except InvalidOperation: return None

def first(row, *names):
    for name in names:
        value=row.get(name)
        if value is not None and str(value).strip():
            return value
    return None

def clean(value):
    return re.sub(r"\s+"," ",str(value or "")).strip()

def normalized_observation(**kwargs):
    required=("retailer","retailer_sku","name","price","source_file","source_sheet","source_row")
    missing=[k for k in required if kwargs.get(k) in (None,"")]
    if missing: raise ValueError("Missing: "+", ".join(missing))
    return kwargs
