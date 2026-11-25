#!/bin/sh
# Builds index.html for GitHub Pages: the page from 8d-report.html plus standalone-shim.js (browser storage).
set -e
{
  printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style></head><body>\n'
  awk 'BEGIN{done=0} /^<script>$/ && !done {print "<script>"; while((getline line < "standalone-shim.js")>0) print line; print "</script>"; done=1} {print}' 8d-report.html
  printf '\n</body></html>\n'
} > index.html
echo "index.html built"
