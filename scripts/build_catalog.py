"""Build canonical JSON from normalized observation JSON files.

Usage:
  python scripts/build_catalog.py normalized/*.json public/data/generated-catalog.json
"""
from __future__ import annotations
import json, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

def key(row):
    return (row["retailer"], row["retailer_sku"])

def main(inputs, output):
    observations=[]
    for pattern in inputs:
        for path in Path(".").glob(pattern):
            payload=json.loads(path.read_text())
            observations.extend(payload if isinstance(payload,list) else payload.get("observations",[]))
    by_product=defaultdict(list)
    for row in observations: by_product[key(row)].append(row)
    products=[]
    for (retailer,sku), rows in sorted(by_product.items()):
        latest=rows[-1]
        products.append({"id":f"{retailer.lower().replace(' ','-')}-{sku}","retailer":retailer,"retailer_sku":sku,"name":latest["name"],"package":latest.get("package"),"latest":latest,"history":rows})
    result={"meta":{"generated_at":datetime.now(timezone.utc).isoformat(),"products":len(products),"observations":len(observations)},"products":products}
    Path(output).write_text(json.dumps(result,indent=2))
if __name__=="__main__":
    if len(sys.argv)<3: raise SystemExit("Provide input glob(s) and output file")
    main(sys.argv[1:-1],sys.argv[-1])
