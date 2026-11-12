// Filled by the deploy workflow (__BUILD__, __ENV__).
window.RCONFIG = {
  ENV: '__ENV__',                       // 'staging' | 'live'
  BUILD: '__BUILD__',
  // v2 database (self-hosted PostgREST, schema "api", anonymous read-only). Pages read it with R.fetchAll('api/<view>?…').
  API_URL: 'https://n8n.rec.jentis.com',
  API_KEY: '',
  // v1 views on Supabase — still used by pages that haven't moved yet (R.fetchAll('<view>?…') without 'api/'). Remove once all pages read 'api/'.
  LEGACY_API_URL: 'https://evaaqpmornjbdfiyddtu.supabase.co/rest/v1',
  LEGACY_API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2YWFxcG1vcm5qYmRmaXlkZHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNTEzMjMsImV4cCI6MjEwMzgyNzMyM30.BYUKI3B57ukEqo1pWH0wRdIrWjEIWAScPUOtNHG0jeo',
  V1_URL: 'https://vibe-reports.jentis.info',
  HUBSPOT_PORTAL: '144226702',
  FEEDBACK_WEBHOOK: 'https://jentis.app.n8n.cloud/webhook/reporting-feedback',
  SITE_BASE: location.pathname.indexOf('/v2-staging/') === 0 ? '/v2-staging/' : location.pathname.indexOf('/v2/') === 0 ? '/v2/' : '/'
};
window.RCONFIG.ASSET_BASE = window.RCONFIG.SITE_BASE + 'assets/';
