# JENTIS Reporting — Handover (Stand 07.09.2026, Site v24)

## Infra
- Supabase: project evaaqpmornjbdfiyddtu (Frankfurt); anon key in reporting/assets/config.js; alle Tabellen/Views/Policies in sql/reporting-views.sql (immer komplett re-runnable).
- HubSpot Portal 144226702. n8n Credentials: "Hubspot Admin" (Uv4k2RMMsWPZCuS2), "Postgres account" (nvtjRzdnFqttOZDI), "Anthropic Admin" (FYCg4BhREROic6UN). Model: claude-sonnet-5.
- Site: statischer Ordner reporting/ (v24), deployed von Seidl. Cache-Busting: BUILD in config.js + ?v=NN in allen Pages.

## Pipelines (n8n, JSON-Dateien)
- calls-sync 06:30 · deals-sync 06:40 (inkl. license_start, source, partner, MRR/quote) · discoveries-sync 06:50 (inkl. contact conversions) · goals-sync 07:00 · outreach-sync Di 06:00 (Sequenzen, Subjects, Insights ===OUTREACH===/===SUBJECTS===, reply_snippet NEU — Lauf ausstehend?) · customers-sync Mi 06:20 (Journeys; inkrementell, NIE bestehende Rows; Änderungen brauchen TRUNCATE customer_journeys + Run) · Lifecycle v7 Mo (Transient-Filter 60min, Merge-Hygiene via hs_merged_object_ids, 14d-Dedupe).

## Gelernte Fallen (wichtig!)
1. HubSpot liefert bei falschen Property-Namen SILENT LEERE Werte — Namen IMMER via MCP search_properties verifizieren. Bekannte Fälle: geoplitical_region (Tippfehler im Portal!), hs_sequence_id (nicht hs_email_sequence_id), hs_v2_date_entered_customer (Companies = v2!), license_start_date__c, **linkedin_profile__c** (NICHT `hs_linkedin_url` — existiert in diesem Portal gar nicht).
2. Stage-Downgrades kaskadieren durch Zwischenstufen (Sekunden-Phantome) → Lifecycle filtert <60min.
3. Merges: hs_merged_object_ids am Survivor; unsere Tabellen sind append-only → Hygiene im Lifecycle-Run.
4. customer = lifecyclestage 'customer'; churned = Stage-Label /churn/i (Wert 862115310). Kohorten-Regel: Kunde vor 2026 (won/renewal/license_start < 2026) → NICHT im Journeys-Report.
5. Patch-Disziplin: rep() mit assert (keine silent no-ops), node --check reicht NICHT → ausführbare Smoke-Tests mit gestubbtem $() für Pipeline-Nodes; Python-Heredocs: Unicode als \U-Escapes, Datei-Writes erst NACH allen reps (Crash = nichts geschrieben, prüfen!).
6. HubSpot Rate Limit 4 req/s pro Token über ALLE Executions — Backfills solo laufen lassen.

## Offene Punkte / Nächstes
1. **LaGrowthMachine/LinkedIn-Sync** — GEBAUT (`reporting-lgm-sync.json`, Site v25). Vorab geprüft und damit erledigt: LGM hängt **keine** Notes an Kontakte — `notes/search` auf 'LaGrowthMachine' und 'Replied LinkedIn Direct Message' liefert 0 Treffer im Portal (8.697 Notes gesamt). Der Parse-Plan entfällt deshalb; LGM pusht stattdessen per Webhook (`POST /webhook/lgm-response`) in n8n. Der Workflow schreibt: Note mit "LGM Response" als erster Zeile, die `lgm_*`-Contact-Properties (für HubSpot-Workflows) und `linkedin_replies` (note_id PK, `lgm_event_id` UNIQUE gegen Webhook-Retries). Page `responded/`: 🔗-Kanal hängt drin. **Offen:** Webhook-URL in den LGM-Kampagnen eintragen (bis dahin kommen keine Daten) und `WEBHOOK_SECRET` im Config-Node setzen — der Endpoint schreibt ins CRM und ist ohne Secret offen für jeden, der die URL kennt, Journeys `activityQuery` UNION-Arm.
2. Responded-Trend: aktuell nach Stage-Entry-Datum; auf "actual connection date" umstellen. LinkedIn-Replies bringen das echte Antwortdatum bereits mit (`linkedin_replies.date`), Email/Calls noch nicht.
3. Email replies = 0 auf Responded-Page → nach outreach-sync-Lauf prüfen; wenn weiter 0: company_id-Lücken in email_replies debuggen.
4. Geparkt: Metabase, inkrementelles Outreach-Aggregat, offizielles Logo, personenscharfe Call-Attribution (braucht contact_ids an discoveries), Cluster-Kategorien pinnen.

## Arbeitsweise mit Sebastian
Deutsch/Englisch gemischt; nur geänderte Dateien liefern (TSV-Tabellen in Codeblöcken); ehrliche Caveats erwünscht; Screenshots als Bug-Reports; Team-Shoutout auf Overview nicht anfassen. 🤖
