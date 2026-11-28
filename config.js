/* Shared storage settings for the GitHub Pages site.
   Leave both empty to keep the standalone version (reports saved in each browser only).
   Fill in both to share reports through your Supabase project (see SETUP-SHARED.md).
   These two values are meant to be public. Access is controlled by the team key,
   which lives only in your Supabase database and in the team link, never in this repository. */
window.GA8D_CONFIG = {
  supabaseUrl: "",      /* Project Settings > Data API > Project URL, e.g. "https://abcdefghijklm.supabase.co" */
  supabaseAnonKey: ""   /* Project Settings > API Keys > anon public (or the "publishable" key) */
};
