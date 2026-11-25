# GA 8D Report

A shared 8D (Eight Disciplines) problem-solving report system for a quality team: a register of reports, a D0–D8 roadmap per report, actions with permanent IDs, automatic quality checks, an edit history, and PDF / Excel export.

## Two ways to run it

**Standalone (GitHub Pages): `index.html`.** Works in any browser with no account. Reports are saved in that browser on that device only. Use *Export all (JSON)* and *Import* in the bar at the top to back up or move reports between devices. It is not shared between people.

To switch it on: Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`. The page is then at `https://changan-cps.github.io/GA-8D-Report/`.

**Shared team version (claude.ai artifact): `8d-report.html`.** One database for the whole team, with names, roles and edit history. It needs the claude.ai artifact runtime (`db`, `user` and `downloads` capabilities), so opened as a plain file it shows only the empty state.

`index.html` is built from `8d-report.html` plus `standalone-shim.js` (browser storage, a local user, file downloads). Rebuild it with `sh build.sh` after changing `8d-report.html`.
