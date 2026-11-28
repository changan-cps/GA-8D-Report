#!/bin/sh
# Builds index.html for GitHub Pages: the page from 8d-report.html plus the runtimes.
#   config.js filled in  -> shared-shim.js: reports shared through Supabase, sign-in required.
#   config.js left empty -> standalone-shim.js: reports kept in this browser only.
# config.js is loaded as its own file, so the settings can be changed without rebuilding.
set -e
{
  printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%%}[hidden]{display:none!important}</style><script src="config.js"></script></head><body>\n'
  awk 'BEGIN{done=0} /^<script>$/ && !done {print "<script>"; while((getline line < "shared-shim.js")>0) print line; print "</script>"; print "<script>"; while((getline line < "standalone-shim.js")>0) print line; print "</script>"; done=1} {print}' 8d-report.html
  printf '\n</body></html>\n'
} > index.html
echo "index.html built"
