CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  retailer TEXT,
  imported_at TEXT NOT NULL,
  parser_version TEXT NOT NULL DEFAULT 'v2',
  accepted_rows INTEGER NOT NULL DEFAULT 0,
  rejected_rows INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS retailer_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer TEXT NOT NULL,
  retailer_sku TEXT NOT NULL,
  upc TEXT,
  name TEXT NOT NULL,
  package_text TEXT,
  source_url TEXT,
  canonical_product_id TEXT,
  UNIQUE(retailer, retailer_sku)
);

CREATE TABLE IF NOT EXISTS price_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer_product_id INTEGER NOT NULL,
  import_id INTEGER,
  price REAL,
  regular_price REAL,
  promo_price REAL,
  unit_price REAL,
  unit TEXT,
  observed_at TEXT,
  imported_at TEXT NOT NULL,
  source_file TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  FOREIGN KEY(retailer_product_id) REFERENCES retailer_products(id),
  FOREIGN KEY(import_id) REFERENCES imports(id)
);

CREATE INDEX IF NOT EXISTS idx_price_product_time ON price_observations(retailer_product_id, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_sku ON retailer_products(retailer, retailer_sku);
