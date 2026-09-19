# Grocery Tracker v2 data model

## Canonical product
A household grocery concept used for comparison, e.g. Ground Beef 80/20.

## Retailer product
A retailer-specific SKU/UPC mapped to a canonical product.

## Price observation
An immutable price observation from an API or spreadsheet source. New imports append observations rather than overwriting history.

## Import
Tracks source filename/hash, retailer, imported time, accepted rows, rejected rows and parser version.

## Matching
Retailer products can be mapped to canonical products by UPC/GTIN first, explicit aliases second, and reviewed normalized-name/package rules last.

The website consumes generated JSON/API responses and contains no retailer spreadsheet parsing rules.
