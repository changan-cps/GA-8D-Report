/* Shared storage settings for the GitHub Pages site.
   Leave supabaseUrl and supabaseAnonKey empty to keep the standalone version (reports saved in each browser only).
   Fill them in to share reports through your Supabase project (see SETUP-SHARED.md).

   teamKey: filled in, the plain site address opens straight into the shared reports for ANYONE who finds it
   (this file is public, so the key is public too). Leave it empty to require the team link (?team=<key>) instead.
   To lock the site again: empty teamKey here, then change the key in Supabase (see SETUP-SHARED.md). */
window.GA8D_CONFIG = {
  supabaseUrl: "https://jwxjnqhcstyknpanoefx.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3eGpucWhjc3R5a25wYW5vZWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU4NDYzMDQsImV4cCI6MjExMTQyMjMwNH0.2SvAaHsPHohttVdQ-fyHwbsv9bIoEXyck9COv-o406o",
  teamKey: "c75b62beb150482eb77afff376c4bb4d"
};
