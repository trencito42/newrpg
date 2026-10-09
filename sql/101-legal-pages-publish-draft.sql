-- Publish seeded legal placeholders so /terms, /privacy, /refund, /cookies are reachable.
-- Staff can replace content via panel CMS; this only flips visibility from draft to published.
UPDATE panel_legal_pages
SET status = 'published', updated_at = NOW()
WHERE page_key IN ('terms', 'privacy', 'refund', 'cookies')
  AND status = 'draft';
