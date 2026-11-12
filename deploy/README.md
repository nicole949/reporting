# Staging password
`staging.htpasswd` is created once with `htpasswd -c deploy/staging.htpasswd jentis` (or https://hostingcanada.org/htpasswd-generator/ , bcrypt) and committed — it only protects the staging folder.
Check the absolute path in `staging.htaccess` (AuthUserFile) against the ALL-INKL document root of the domain; ALL-INKL shows it under "Webspace".
