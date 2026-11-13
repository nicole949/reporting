/* JENTIS Reporting — where every number comes from.
   One entry per metric / chart:  m = start of the label on the page (case-insensitive),
   calc = how it is calculated, src = where the data comes from (a key of S below or free text), note = caveats.
   A label without an entry simply gets no "?" — add the entry here, no page change needed. */
(function () {
  const H = R.help;
  const FRESH = ' Copied into the reporting database every morning at 07:40, so the numbers are as of this morning.';
  const S = H.sources = {
    lifecycle: 'Lifecycle stage entries per company — worked out every night (04:00) by the n8n workflow “Lifecycle Cohort Reporting” from HubSpot: the company\'s lifecycle-stage history plus evidence (meetings, calls, replies, deals). Manual corrections live in the “Overrides” tab of the lifecycle Google Sheet.' + FRESH,
    calls: 'HubSpot calls (object “Calls”) with outcome, owner and the called contact, synced every morning.' + FRESH,
    discoveries: 'HubSpot meetings with activity type “Discovery”, synced every morning.' + FRESH,
    deals: 'HubSpot deals of all pipelines, including the values of their quotes, synced every morning.' + FRESH,
    email: 'HubSpot sequence emails (sends, opens, replies per day) and Instantly campaigns (Instantly API), brought in by the outreach sync.' + FRESH,
    linkedin: 'LaGrowthMachine: LinkedIn messages, connection requests and replies, synced into the reporting database.' + FRESH,
    responded: 'HubSpot contact property “Lead status”: the day a contact was set to Responded (from the property history), plus email replies, connected calls and LinkedIn replies.' + FRESH,
    goals: 'Targets come from the goals sheet (synced every morning); the actual values are the lifecycle stage entries of the quarter.' + FRESH,
    cs: 'HubSpot: customer companies, their won deals (licence dates, MRR, usage limit) and renewal deals — synced by the Customer Success workflows.' + FRESH,
    usage: 'JENTIS product database (DCP): traffic, consent, logins, containers and feature usage per customer, mirrored every night and matched to the HubSpot company.' + FRESH,
    tickets: 'HubSpot Service Hub tickets, synced every morning. Tickets carry no owner in HubSpot, so the owner shown is the owner of the company.' + FRESH,
    journeys: 'Built once per customer by the customers sync from HubSpot: the won deal, the company\'s contacts, their emails, calls, meetings, form submissions and original source. Existing journeys are not rebuilt.' + FRESH,
    ps: 'HubSpot Services (professional-service packages and monthly allowances) with their line items, logged hours and open professional-service deals. Team capacity is the number typed into “Assumptions”.',
    quotes: 'HubSpot quotes (draft and open) with their line items and the linked deal and company — reloaded from HubSpot when you run a check.'
  };
  const STAGE = 'One entry per company and stage, on the corrected date (the day the stage was really reached: meeting entered, call connected, reply received, deal created) — not the day somebody changed the field in HubSpot.';
  const PREV = ' The small arrow compares with the period of the same length directly before.';
  const NBDEF = 'New business = deal type “Full License (New Business)” or “JENTIS Light”.';

  // ---------------------------------------------------------------- Commercial overview
  H.add('overview', [
    { m: 'Marketing', calc: 'The top of the funnel in the chosen period: new leads, outreach volume and the responses it produced.' + PREV, src: 'lifecycle' },
    { m: 'New leads', calc: 'Companies that entered the stage Lead in the period. ' + STAGE + PREV, src: 'lifecycle' },
    { m: 'Outreach emails sent', calc: 'Emails sent in the period: HubSpot sequence emails plus Instantly campaign emails, added up per day. Counts emails, not people. The bars are stacked by sequence; Instantly is one block because Instantly reports per day, not per campaign and day. “New recipients” in the list = contacts who got their first email of that sequence in the period.' + PREV, src: 'email' },
    { m: 'LinkedIn actions', calc: 'Everything LaGrowthMachine did on LinkedIn in the period: connection requests, messages and follows that went through successfully. The bars are stacked by these three types.' + PREV, src: 'linkedin' },
    { m: 'Responses', calc: 'Responses we got in the period, stacked by type: connected calls (outcome Connected), email replies to a sequence and LinkedIn replies. Replies only count when the AI check rated them positive or neutral — auto-replies and “not interested, remove me” do not. One contact can appear several times.' + PREV, src: 'responded', note: 'Same counting as the Responses page. Until 13.11.2026 this tile showed contacts set to lead status Responded instead.' },
    { m: 'Engaged → Responded', calc: 'Companies that entered the stage Responded in the period. ' + STAGE + PREV, src: 'lifecycle', note: 'Counts companies; “Responses” next to it counts single responses.' },
    { m: 'Business Development', calc: 'From response to discovery: call activity and the discovery meetings it leads to.' + PREV, src: 'calls' },
    { m: 'Calls', calc: 'All calls logged in HubSpot with a date in the period, whatever the outcome.' + PREV, src: 'calls' },
    { m: 'Connected calls', calc: 'Calls in the period where we reached a person: outcome Connected, Meeting Booked, Not interested or another rejection. No answer, wrong number and voicemail do not count.' + PREV, src: 'calls' },
    { m: 'Discoveries booked', calc: 'Discovery meetings created (booked) in the period, without cancelled ones. If a meeting has no creation date, its start date is used.' + PREV, src: 'discoveries' },
    { m: 'Discoveries held', calc: 'Discovery meetings that took place in the period and have the outcome Completed.' + PREV, src: 'discoveries' },
    { m: 'Entered Discovery', calc: 'Companies that entered the stage Discovery in the period: the day their first Discovery meeting was entered in HubSpot. Cancelled and no-show meetings and discoveries of existing customers do not count.' + PREV, src: 'lifecycle' },
    { m: 'Sales pipeline', calc: 'From qualified account to closed-won new business.' + PREV, src: 'deals' },
    { m: 'Qualified accounts', calc: 'Companies that entered the stage Qualified in the period. ' + STAGE + PREV, src: 'lifecycle' },
    { m: 'Opportunities', calc: 'Companies that entered the stage Opportunity in the period. ' + STAGE + PREV, src: 'lifecycle' },
    { m: 'Deals created', calc: 'Deals created in the period with deal type Full License (New Business), JENTIS Light or POC. Renewals, upsells and professional services are left out.' + PREV, src: 'deals' },
    { m: 'Won new business', calc: 'New-business deals closed won with a close date in the period; the line below is the sum of their amounts. ' + NBDEF + PREV, src: 'deals' },
    { m: 'Open NB pipeline', calc: 'Sum of the amounts of all new-business and POC deals that are open today. A snapshot — the period filter does not change it.', src: 'deals' },
    { m: 'Customer Success', calc: 'After the signature: new customers, renewals, expansion, services and support load.' + PREV, src: 'cs' },
    { m: 'Customers signed', calc: 'Companies that entered the stage Customer in the period = first won Full License (New Business) or JENTIS Light deal. Renewals, upsells, POCs and services never count.' + PREV, src: 'lifecycle' },
    { m: 'In onboarding', calc: 'New-business deals won in the 90 days before the end of the chosen period — a simple stand-in for “currently onboarding”.', src: 'deals', note: 'A proper onboarding status per customer follows with the Projects page.' },
    { m: 'Renewals due', calc: 'Renewals whose licence ends in the period.' + PREV, src: 'cs' },
    { m: 'Renewals won', calc: 'Deals of type Renewal or Early Renewal closed won with a close date in the period.' + PREV, src: 'deals' },
    { m: 'Professional services sold', calc: 'Deals of type Professional Service closed won in the period; the line below is the sum of their amounts.' + PREV, src: 'deals' },
    { m: 'Tickets opened', calc: 'Support tickets created in the period.' + PREV, src: 'tickets' },
    { m: 'Open tickets', calc: 'Tickets that are not resolved or closed today. A snapshot — the period filter does not change it.', src: 'tickets' }
  ]);

  // ---------------------------------------------------------------- personal page
  H.add('me', [
    { m: 'My open tasks', calc: 'Placeholder: HubSpot tasks are not synced yet.', src: 'Will come from HubSpot tasks (owner, due date, linked record).' },
    { m: 'Upcoming renewals', calc: 'Renewals whose licence ends in the card\'s timeframe, soonest first. With your name set, only customers you own.', src: 'cs' },
    { m: 'Upcoming discoveries', calc: 'Discovery meetings that start in the card\'s timeframe and are not cancelled — the whole team\'s.', src: 'discoveries' },
    { m: 'Customers needing attention', calc: 'Customers with at least one of: cancellation period, licence ended without renewal, renewal without a deal, usage over the contract, a feature used but not contracted, an open ticket. With your name set, only customers you own.', src: 'cs', note: 'Same rule as the “Needs attention” filter on the Customers page.' },
    { m: 'Quarter goals', calc: 'Stage entries since the start of the current quarter against the quarter\'s target.', src: 'goals' },
    { m: 'My calls', calc: 'Calls in the card\'s timeframe; “connected” = a person was reached (connected or rejected). With your name set, only calls you own.', src: 'calls' },
    { m: 'My discoveries booked', calc: 'Discovery meetings created in the card\'s timeframe, without cancelled ones. With your name set, only meetings you own.', src: 'discoveries' },
    { m: 'Won deals', calc: 'All deals closed won with a close date in the card\'s timeframe, whole team, any deal type; the amount is the sum of the deal amounts.', src: 'deals' },
    { m: 'Open tickets', calc: 'Tickets that are not resolved or closed. With your name set, only tickets of customers you own.', src: 'tickets' },
    { m: 'Unread change notes', calc: 'Change notes published since you last opened the Change notes page (remembered in this browser).', src: 'The change log of this site.' },
    { m: 'Latest celebrations', calc: 'The five most recently won deals.', src: 'deals' }
  ]);

  // ---------------------------------------------------------------- full funnel
  H.add('funnel', [
    { m: 'Funnel conversion', calc: '<b>Cohort</b> (default): take the companies that entered the start stage in the chosen period and count how many of them have reached each later stage until today. The percentage on the right is the conversion from the level above; “Ø days” is the average time between two stages. <b>Activity</b>: count every stage entry that happened in the period, whichever cohort the company belongs to. Click a level to leave it out, click a number for the companies.', src: 'lifecycle', note: 'Young cohorts look weak because their companies have not had time to move on — pick an earlier period for mature rates. Discoveries of existing customers are excluded; partners and agencies are hidden unless you untick the box.' },
    { m: 'Compare funnels by conversion type', calc: 'The same funnel (same period, basis, start stage and filters) split by conversion type. The bar is the share of the start stage, the big number the conversion from the previous level.', src: 'Conversion type = HubSpot contact property “Conversion Type” of the company\'s converting contact: the first contact that responded, otherwise the earliest contact with a type. Inbound = Inbound, Download, Newsletter, Referral, Event. Outbound = Outreach, Prospecting.' + FRESH }
  ]);

  // ---------------------------------------------------------------- marketing overview
  H.add('mkt-overview', [
    { m: 'To-dos & targets', calc: 'A shared list for the Go-To-Market team: everyone who opens this page sees and edits the same items. Tick an item when it is done; done items stay under “Show done”. A to-do with “KPI target” tracks a number by itself: the bar fills with the same numbers as the tiles below, the thin mark shows where you should be by today (share of the period that has passed), “ahead / behind” compares the two.', src: 'Entered on this page; stored in the reporting database (table app.todos). The numbers of a target come from the same sources as the tile of that metric.', note: 'There is no login yet: anyone with access to the dashboard can change or delete items. “Every week / month / quarter” targets start again with each new period.' },
    { m: 'Goals', calc: 'The goals of the chosen quarter (and the year) and how far we are. The orange bar fills with the actual number; “Time elapsed” shows how much of the quarter has passed, and “ahead / behind” compares the two (5 points either way count as on track). Pick another quarter in the drop-down to see its final result. Click a goal for the companies or contacts behind it.', src: 'goals' },
    { m: 'days left in the quarter', calc: 'Calendar days until the end of the quarter shown.', src: 'Calendar.' },
    { m: 'Goal: discoveries', calc: 'Companies that entered the lifecycle stage Discovery in the goal period. ' + STAGE, src: 'goals' },
    { m: 'Goal: qualified', calc: 'Companies that entered Qualified in the goal period — but only if their discovery was in the same period. Conversions until the end of the following month still count (e.g. January for a Q4 goal) to allow for the delay between discovery and qualification.', src: 'goals', note: 'Builds on the Discoveries goal: a company qualified this quarter whose discovery was last quarter does not count here.' },
    { m: 'Goal: responded', calc: 'Unique contacts whose HubSpot lead status was set to Responded in the goal period, each counted once (first time).', src: 'goals' },
    { m: 'Goal: opportunities', calc: 'Companies that entered the lifecycle stage Opportunity in the goal period. ' + STAGE, src: 'goals' },
    { m: 'Goal: customers', calc: 'New customers: won deals of type Full License (New Business) in the goal period. Renewals, upsells and agency deals do not count; several deals of one company in the same week count once.', src: 'goals' },
    { m: 'Goal: calls', calc: 'Calls logged in HubSpot in the goal period, whatever the outcome.', src: 'goals' },
    { m: 'Goal: won value', calc: 'Sum of the amounts of new-business deals closed won in the goal period. ' + NBDEF, src: 'goals' },
    { m: 'Goal: stage', calc: 'Companies that entered this lifecycle stage in the goal period.', src: 'goals' },
    { m: 'Projects', calc: 'A shared project list for the Go-To-Market team: name, status, owner, timeframe, a description and subtasks (both open as drop-downs). Change the status right in the list with the coloured pill; tick subtasks off, double-click a subtask to rename it. Open projects are sorted by status (in progress, blocked, planned, on hold, idea) and then by end date; finished ones sit under “Show done”.', src: 'Entered on this page; stored in the reporting database (tables app.projects and app.project_tasks).', note: 'There is no login yet: anyone with access to the dashboard can change or delete projects. “Overdue” = the end date has passed and the project is not done.' },
    { m: 'Outreach & responses', calc: 'The top of the funnel in the chosen period: new leads, contact form submissions, outreach volume and the responses it produced, each compared with the period of the same length before. The bars show how the number developed: solid = the chosen period, pale = the time before it (“Charts go back”). Click a tile for the records.', src: 'lifecycle' },
    { m: 'Calls & discoveries', calc: 'From response to discovery: call activity and the discovery meetings it leads to, compared with the period of the same length before. Click a tile for the records.', src: 'calls' },
    { m: 'Contact form submissions', calc: 'Submissions of the website contact form in the period, one per submission, stacked by form.' + PREV, src: 'HubSpot form submissions.', note: 'Not connected yet: the data source for this number is still being built, so the tile shows “—” until then.' },
        { m: 'Contacts → lead status Responded', calc: 'Contacts whose HubSpot lead status was set to Responded in the period — one per contact, dated by the first time.' + PREV, src: 'responded' },
    { m: 'Outreach emails sent', calc: 'Emails sent per day by HubSpot sequences (stacked by sequence) and Instantly (one block, Instantly reports per day only). Counts emails, not people. Click a bar or “Records” for the sequences with emails sent and new recipients.' + PREV, src: 'email' },
    { m: 'LinkedIn actions', calc: 'Connection requests, messages and follows that LaGrowthMachine sent successfully, stacked by type.' + PREV, src: 'linkedin' },
    { m: 'Responses', calc: 'Connected calls, email replies to a sequence and LinkedIn replies, stacked by type. Replies only count when the AI check rated them positive or neutral.' + PREV, src: 'responded' }
  ].concat(H.pages.overview.filter(e => /^(New leads|Engaged|Entered Discovery|Calls$|Connected calls|Discoveries booked|Discoveries held)/.test(e.m))));

  // ---------------------------------------------------------------- leads
  const TREND = st => ({ m: st + ' ·', calc: 'Companies entering the stage ' + st + ' per period (the grouping chosen in the filter bar) for the periods in view. “in view” is their total.', src: 'lifecycle' });
  H.add('leads', [
    { m: 'Entries ·', calc: 'Stage entries (all stages together) in the newest period in view, after the filters.', src: 'lifecycle' },
    { m: 'Restatements', calc: 'Stage entries whose date was changed by the last nightly run because better evidence turned up (for example a meeting that was entered late).', src: 'lifecycle' },
    { m: 'Median lag', calc: 'For every entry: days between the day the stage was really reached and the day it was set in HubSpot. The median over all entries in view.', src: 'lifecycle' },
    { m: 'Unverified', calc: 'Share of the entries in the four newest periods that rest only on the HubSpot field (no meeting, call, reply or deal confirms the date).', src: 'lifecycle' },
    { m: 'Entries by', calc: 'Rows = weeks / months / quarters, columns = stages. Each cell is the number of companies that entered that stage in that period; darker = more. A dot marks cells that were restated in the last run. Click a cell for the companies.', src: 'lifecycle', note: 'Discovery = first Discovery meeting entered (from 2025). Customer = first new-business win. Partners and agencies are hidden unless the box is unticked.' },
    { m: 'Companies', calc: 'The companies behind the selected cell, with the evidence that dates their entry (meeting, call, reply, deal, HubSpot field).', src: 'lifecycle' },
    TREND('Lead'), TREND('Engaged'), TREND('Responded'), TREND('Discovery'), TREND('Qualified'), TREND('Opportunity'), TREND('Customer'),
    { m: 'Stage entries over time', calc: 'One small chart per stage: companies entering that stage per period, for the periods in view.', src: 'lifecycle' }
  ]);

  // ---------------------------------------------------------------- email outreach
  H.add('email', [
    { m: '🤖 AI analysis', calc: 'A written summary of what works: who responds, which sequences and steps perform. Claude writes it from the sequence statistics on this page whenever the outreach sync runs — the date shows when.', src: 'email', note: 'AI-written: read it as a pointer to look at, not as a number.' },
    { m: 'Sequences', calc: 'HubSpot sequences and Instantly campaigns that pass the filters. With a period chosen: those that sent at least one email in it.', src: 'email' },
    { m: 'Contacts enrolled', calc: 'Contacts enrolled in the sequences in view (Instantly: leads in the campaign). With an ICP, persona or seniority filter: only contacts of that segment.', src: 'email' },
    { m: 'Real replies', calc: 'Incoming answers to the sequence emails; out-of-office and other automatic replies are filtered out.', src: 'email' },
    { m: '📅 → 💼 → 🏆', calc: 'Companies with a discovery meeting / a deal / a customer win <i>after</i> the sequence first reached them (added up over the sequences in view).', src: 'email', note: 'A company reached by several sequences is counted for each of them.' },
    { m: 'Sequences ·', calc: 'One row per sequence: enrolled, open rate, reply rate, real replies and what followed. ▸ opens the steps (distinct emails in the order they were first sent); a click on the row shows who engaged.', src: 'email', note: 'Open rates are directional only — Apple Mail Privacy Protection inflates them. CTA and collateral are read from the email bodies by AI.' },
    { m: 'Details', calc: 'Engagers and outcomes of the selected sequence.', src: 'email' }
  ]);
  H.add('email-subjects', [
    { m: '🤖 AI analysis', calc: 'A written summary of which subject lines work for which ICP type and persona. Claude writes it from the statistics on this page when the outreach sync runs.', src: 'email', note: 'AI-written: read it as a pointer, not as a number.' },
    { m: '🏅 Best performers', calc: 'The three subject lines with the highest open rate (ties: reply rate) among those sent in the last 90 days with at least 100 sends (or “Min sends”, if that is higher). Always the last 90 days, whatever the period filter says.', src: 'email' },
    { m: 'Subject lines in view', calc: 'Distinct subject lines sent in the chosen period with at least “Min sends” emails.', src: 'email' },
    { m: 'Sends', calc: 'Emails sent with the subject lines in view.', src: 'email' },
    { m: 'Median open rate', calc: 'The middle value of the open rates of the subject lines in view.', src: 'email', note: 'Directional only — Apple Mail Privacy Protection counts opens that never happened, for all subject lines alike.' },
    { m: 'Real replies', calc: 'Incoming answers to emails with these subject lines; out-of-office and automatic replies are filtered out.', src: 'email' },
    { m: 'Subject line performance', calc: 'One row per subject line: sends, open rate, reply rate, real replies. Click a row for its segments.', src: 'email' },
    { m: 'Segments', calc: 'The selected subject line split by ICP type (from the recipient\'s company) and seniority (derived from the job title).', src: 'email' }
  ]);

  // ---------------------------------------------------------------- responses
  H.add('responses', [
    { m: 'Companies responded', calc: 'Companies with a response signal in the period: the lifecycle stage Responded, a contact set to lead status Responded, or a LinkedIn reply. “Lifecycle Responded only” hides companies whose only signal is LinkedIn or a lead status.', src: 'responded' },
    { m: '🏷️ Contacts', calc: 'Contacts of these companies whose HubSpot lead status was set to Responded in the period. This is the number the Responded goal counts (minus contacts without a company).', src: 'responded' },
    { m: '✉️ Email replies', calc: 'Real email replies of these companies within three weeks before or after their response date.', src: 'email' },
    { m: '📞 Connected calls', calc: 'Calls with the outcome Connected for these companies within three weeks before or after their response date.', src: 'calls' },
    { m: '🔗 LinkedIn replies', calc: 'LinkedIn replies received through LaGrowthMachine in the period.', src: 'linkedin', note: 'LinkedIn replies do not make a company “Responded” in the lifecycle on purpose.' },
    { m: 'Responses ·', calc: 'One row per company with who answered, through which channel and what they said.', src: 'responded' }
  ]);

  // ---------------------------------------------------------------- calls
  H.add('calls', [
    { m: '🏆 Champions League', calc: 'Calls in the period with the outcome “Meeting Booked” — the meeting was booked directly on the call. One badge per company.', src: 'calls' },
    { m: '📅 Discoveries booked', calc: 'Calls-assisted discoveries: the company had a connected call in the three months before its discovery meeting was booked, and that call lies in the period.', src: 'calls', note: 'Attribution by company, not by person.' },
    { m: 'Results', calc: 'What the calls of the period led to: discoveries, deals and customers of companies that had a connected call in the three months before.', src: 'calls' },
    { m: 'Calls', calc: 'Calls logged in the period after the owner and search filters.', src: 'calls' },
    { m: 'Conversations', calc: 'Calls where a person was reached: connected, or connected and rejected.', src: 'calls' },
    { m: 'Connect rate', calc: 'Conversations ÷ calls. Green from 15 %.', src: 'calls' },
    { m: 'Meetings booked', calc: 'Calls with the outcome “Meeting Booked”.', src: 'calls' },
    { m: 'Call volume by outcome', calc: 'Calls per day or week, stacked: connected, connected but rejected, no contact. The dashed line is the connect rate.', src: 'calls' },
    { m: 'Outcome mix', calc: 'Share of each call outcome (as logged in HubSpot) among the calls of the period.', src: 'calls' },
    { m: 'Outcomes over time', calc: 'Per week: the share of calls with each outcome. Weeks with fewer than five calls are hidden. Has its own period and ICP / persona / region filters.', src: 'calls' },
    { m: 'By ICP type', calc: 'Calls of the period grouped by the ICP type of the called company and the persona of the called contact, with connect rate and outcomes.', src: 'calls' }
  ]);

  // ---------------------------------------------------------------- discoveries
  H.add('discoveries', [
    { m: 'Upcoming', calc: 'Discovery meetings that have not taken place yet. Always shown, whatever the period.', src: 'discoveries' },
    { m: 'Completed (in view)', calc: 'Discovery meetings from the start of the period on with the outcome Completed.', src: 'discoveries' },
    { m: 'No-show rate', calc: 'No-shows ÷ (completed + no-shows) among the meetings in view. Amber above 20 %.', src: 'discoveries' },
    { m: '→ Deal created', calc: 'Completed discoveries after which a deal was created for the company.', src: 'deals' },
    { m: 'Completed & past', calc: 'Past discovery meetings in view. Source = the journey before the meeting (first touch as the big icon). Tinted rows: a deal was created afterwards; stronger tint: won; red: lost.', src: 'discoveries', note: 'Outcome and TODO are condensed by AI from the meeting notes.' }
  ]);

  // ---------------------------------------------------------------- journeys
  H.add('journeys', [
    { m: 'Customers', calc: 'Customers in view: companies with a won new-business deal closed in the chosen period, after the ICP, pain and region filters.', src: 'journeys' },
    { m: 'Churned', calc: 'Customers in view whose lifecycle stage is a churn stage today.', src: 'journeys' },
    { m: 'Median deal cycle', calc: 'Days from the creation of the won deal to its close date; the middle value over the customers in view.', src: 'journeys' },
    { m: 'Median journey', calc: 'Days from the first recorded touch (call, email, download, form, event, website) to the close date; the middle value over the customers in view.', src: 'journeys' }
  ]);

  // ---------------------------------------------------------------- sales overview
  H.add('sales-overview', [
    { m: 'Qualified accounts', calc: 'Companies that entered the stage Qualified in the period. ' + STAGE + PREV, src: 'lifecycle', note: 'Company-level, so the owner filter does not apply to this tile.' },
    { m: 'Opportunities', calc: 'Companies that entered the stage Opportunity in the period.' + PREV, src: 'lifecycle', note: 'Company-level, so the owner filter does not apply to this tile.' },
    { m: 'Deals created', calc: 'Deals created in the period with deal type Full License (New Business), JENTIS Light or POC.' + PREV, src: 'deals' },
    { m: 'Won new business', calc: 'New-business deals closed won with a close date in the period; below: the sum of their amounts. ' + NBDEF + PREV, src: 'deals' },
    { m: 'Open pipeline', calc: 'Sum of the amounts of new-business and POC deals that are open today. A snapshot — the period does not change it.', src: 'deals' },
    { m: 'Ø deal size won', calc: 'Sum of the amounts of the new-business deals won in the period ÷ their number.', src: 'deals' },
    { m: 'Open new-business pipeline', calc: 'The open new-business and POC deals of today, grouped by deal stage: number of deals and sum of amounts.', src: 'deals' },
    { m: 'Won in the period', calc: 'The new-business deals behind “Won new business”, newest first.', src: 'deals' }
  ]);

  // ---------------------------------------------------------------- deals
  H.add('deals', [
    { m: 'Deals in view', calc: 'Deals that pass the filters (owner, status, partner, created in the period, search).', src: 'deals' },
    { m: 'Open value', calc: 'Sum of the amounts of the open deals in view. Where a deal has a quote, the quote\'s monthly subscription value is used instead of the amount field (marked /mo).', src: 'deals' },
    { m: 'Won this quarter', calc: 'Sum of all deals closed won since the first day of the current quarter — not affected by the filters.', src: 'deals' },
    { m: '🔴 At risk', calc: 'Open deals in view without any activity for more than 30 days (measured from the last activity, otherwise from creation).', src: 'deals', note: 'Health per deal: 🟢 under 14 days, 🟡 14–30 days, 🔴 over 30 days without activity.' },
    { m: '🏆 Closed won', calc: 'All deals closed won, grouped by quarter and by new business / renewals / other, with their value.', src: 'deals' }
  ]);

  H.add('quotes', [
    { m: 'What the customer sees', calc: 'The quote settings as stored in HubSpot: which columns, totals and terms appear on the quote the customer opens.', src: 'quotes' },
    { m: 'Column setup', calc: 'Which line-item columns and totals are switched on for this quote, checked against rule T-03.', src: 'quotes' },
    { m: 'Checked and fine', calc: 'The rules this quote passed. The check recalculates the billing schedule (quantity × unit price × periods), runs fixed rule checks and then lets Claude review the quote against the full Quote & licence rule set. Score = 100 − 25 per red − 10 per amber finding.', src: 'quotes', note: 'AI-assisted: every result records the documentation version it was checked against.' }
  ]);

  // ---------------------------------------------------------------- CS overview
  H.add('cs-overview', [
    { m: 'Customers · now', calc: 'Companies that are a customer today (of the selected owners) and the sum of their MRR. A snapshot — the period does not change it.', src: 'cs', note: 'MRR = monthly value of every live won deal of the customer.' },
    { m: 'Customers signed', calc: 'New-business deals closed won in the period. ' + NBDEF + PREV, src: 'deals' },
    { m: 'Renewals due', calc: 'Renewals whose licence ends in the period; below: their value and how many already have a renewal deal.' + PREV, src: 'cs' },
    { m: 'Renewals won', calc: 'Deals of type Renewal or Early Renewal closed won in the period, with the sum of their amounts.' + PREV, src: 'deals' },
    { m: 'Upsell & expansion won', calc: 'Deals of type Upsell or Expansion closed won in the period, with the sum of their amounts.' + PREV, src: 'deals' },
    { m: 'Professional services sold', calc: 'Deals of type Professional Service closed won in the period, with the sum of their amounts.' + PREV, src: 'deals' },
    { m: 'Tickets opened', calc: 'Support tickets created in the period. With an owner selected: tickets of that owner\'s customers.' + PREV, src: 'tickets' },
    { m: 'Open tickets', calc: 'Tickets not resolved or closed today.', src: 'tickets' },
    { m: 'Renewals due in the period', calc: 'The renewals behind the tile, by licence end date.', src: 'cs' },
    { m: 'Customers needing attention', calc: 'Customers with at least one of: cancellation period, licence ended without renewal, renewal without a deal, usage over the contract, a feature used but not contracted, an open ticket.', src: 'cs', note: 'Same rule as the “Needs attention” filter on the Customers page.' }
  ]);

  // ---------------------------------------------------------------- customers
  H.add('customers', [
    { m: 'Customers', calc: 'Customers that pass the filters. Click a tile to filter the list by it.', src: 'cs' },
    { m: 'MRR', calc: 'Sum of the MRR of the customers in view. MRR = monthly value of every live won deal (HubSpot MRR for Revenue Hub deals, the amount for older deals).', src: 'cs' },
    { m: 'Renewal ≤ 120d', calc: 'Customers whose licence ends within the next 120 days.', src: 'cs' },
    { m: '🚫 Cancellation period', calc: 'Customers in the 30 days before their licence end.', src: 'cs' },
    { m: '🔴 Usage over contract', calc: 'Customers whose usage is above 110 % of the contracted limit. Usage follows the deal\'s usage timeframe: monthly = last full month against the monthly limit; longer periods = usage so far plus a projection to the end of the period.', src: 'usage', note: '🟢 70–110 % · 🔵 under 70 % · 🔴 over 110 % · ⚪ no limit or no usage data.' },
    { m: '⚙️ Setup issues', calc: 'Customers with at least one active container whose DNS status is 0, or whose tracking code is neither detected nor delivering data.', src: 'usage' },
    { m: '🎫 Open tickets', calc: 'Customers with at least one unresolved ticket.', src: 'tickets' }
  ]);
  H.add('renewals', [
    { m: 'Renewals (in view)', calc: 'Renewals that pass the filters (owner, status, licence end in the period).', src: 'cs' },
    { m: '≤ 30 days', calc: 'Open renewals whose licence ends within the next 30 days.', src: 'cs' },
    { m: '≤ 90 days', calc: 'Open renewals whose licence ends within the next 90 days.', src: 'cs' },
    { m: 'Value ≤ 90d', calc: 'Sum of the MRR (or, where there is none, the amount) of the open renewals ending within 90 days.', src: 'cs' },
    { m: '⚠️ Overdue', calc: 'Open renewals whose licence end date has already passed.', src: 'cs' },
    { m: 'Renewals ·', calc: 'One row per renewal: licence end, days left, MRR, deal stage, owner. Amber rows end within 30 days, red rows are overdue.', src: 'cs' }
  ]);
  H.add('tickets', [
    { m: 'Tickets (in view)', calc: 'Tickets that pass the filters (owner of the company, status, created in the period).', src: 'tickets' },
    { m: 'Open', calc: 'Tickets in view that are not resolved or closed.', src: 'tickets' },
    { m: 'High priority', calc: 'Open tickets in view with priority High or Urgent.', src: 'tickets' },
    { m: '😴 Quiet 7d+', calc: 'Open tickets in view without any activity for seven days or more.', src: 'tickets' },
    { m: 'Tickets ·', calc: 'One row per ticket; age counts from creation. Red rows are open and quiet for seven days or more.', src: 'tickets' }
  ]);

  // ---------------------------------------------------------------- professional services (capacity)
  H.add('ps', [
    { m: 'Team capacity', calc: 'Hours per week from “Assumptions” × the weeks in the view.', src: 'ps', note: 'A manual number until the capacity sheet is linked.' },
    { m: 'Sold · committed', calc: 'Hours we have sold for the view: one-time packages spread evenly over their term, monthly allowances per month.', src: 'ps' },
    { m: 'Max ·', calc: 'Committed hours plus what could come on top: packages and stackable allowances drawn faster than planned (up to the overusage factor × the period\'s share) and open professional-service deals.', src: 'ps' },
    { m: 'Used', calc: 'Hours already logged against the services in the view.', src: 'ps' },
    { m: 'Remaining · min', calc: 'Team capacity − the maximum case.', src: 'ps' },
    { m: 'Remaining · max', calc: 'Team capacity − the committed hours.', src: 'ps' },
    { m: 'Sellable', calc: 'Hours that can still be sold in the view without exceeding the team capacity.', src: 'ps' },
    { m: 'Customers in view', calc: 'Customers with a service or an open professional-service deal that overlaps the view.', src: 'ps' },
    { m: 'Series', calc: 'The parts of each bar: used, committed, potential overusage, open deals, free capacity. Click one to hide or show it.', src: 'ps' },
    { m: 'Assumptions', calc: 'The numbers the chart is built on: team capacity per week, the overusage factor and the hourly value. Change them to see the effect; they are remembered in this browser.', src: 'Typed in here.' },
    { m: 'Plan an offer', calc: 'Enter a possible package or allowance (start, expiry, hours, stackable or not). The chart shows it on top of the sold hours and flags periods where it would not fit the capacity.', src: 'ps' },
    { m: 'Per period', calc: 'The chart as a table: capacity, committed, maximum, used and remaining hours for each period of the grid.', src: 'ps' }
  ]);
})();
