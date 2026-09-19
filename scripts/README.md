# Grocery Tracker data pipeline

This folder is the maintainable import layer for Grocery Tracker.

Retailer spreadsheets are inputs, not application state. Importers convert source rows into one normalized schema. The catalog builder then deduplicates retailer SKUs and emits JSON consumed by the website.

## Normalized product observation
- retailer
- retailer_sku
- name
- package
- price
- regular_price
- unit_price
- unit
- source_url
- source_file
- source_sheet
- source_row
- imported_at

Retailer-specific parsing belongs in its own importer. Do not add retailer column rules to the React UI.
