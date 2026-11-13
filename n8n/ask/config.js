// ===== ASK AI — CONFIG =====
// The dashboard sends { step: 'plan', question, context } and later { step: 'run', id }.
// Plan: Claude picks which data to read (only through the dashboard's own data API = same rights as the browser),
// the workflow reads and aggregates it and computes what the answer will cost. Nothing else is spent before the
// user confirms. Run: Claude answers from exactly that data.
const MODEL = 'claude-sonnet-5-5';            // planner and answer
const API = 'https://n8n.rec.jentis.com/';    // dashboard data API (PostgREST, role anon, read-only)
const CREDIT_EUR = 0.01;                      // 1 credit = 1 euro cent (shown in the dashboard)
const DAILY_BUDGET_EUR = 5;                   // all questions together per 24 h; above that, asking pauses
const MAX_ANSWER_EUR = 0.6;                   // answers estimated above this are refused (ask a narrower question)
const MAX_REQUESTS = 6;                       // data requests per question
const MAX_ROWS = 5000;                        // rows per request
const MAX_DATA_CHARS = 110000;                // data the answer step may read in total (~35k tokens)
const PLAN_MAX_TOKENS = 1500;
const ANSWER_MAX_TOKENS = 1400;
const body = $json.body || {};
return [{ json: { cfg: { MODEL, API, CREDIT_EUR, DAILY_BUDGET_EUR, MAX_ANSWER_EUR, MAX_REQUESTS, MAX_ROWS, MAX_DATA_CHARS, PLAN_MAX_TOKENS, ANSWER_MAX_TOKENS }, body } }];
