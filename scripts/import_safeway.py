from import_albertsons import parse as _parse
def parse(row, source_file, sheet, row_number):
    value=_parse(row,source_file,sheet,row_number)
    if value: value["retailer"]="Safeway"
    return value
