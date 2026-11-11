Every pull request that changes a page adds an entry at the TOP of `docs/changelog.json`:
`version` = YYYY.MM.DD-n (sorts as a string), `items[].section` / `page` = keys from `R.NAV` in site/assets/app.js.
The deploy copies the file to `site/assets/changelog.json`; the shell shows unread entries until the reader opens the panel.
