# RACKET panel SEO and social previews

The App Router emits metadata in the initial server response. Public pages use canonical `https://racket.cat` URLs, while account, staff, search and private forum routes are excluded from indexing. The sitemap uses the same anonymous forum ACL evaluation as forum reads, so faction, clan and staff topics are never listed.

Discord caches link previews independently of the site. After changing metadata, append a temporary query string such as `?preview=2` when validating a preview in Discord. Keep published links and canonical metadata clean; the query string is only a cache bypass for testing.

Validate production output by inspecting the server-rendered `<head>`, `/robots.txt`, `/sitemap.xml`, the default `/opengraph-image`, a public topic and an unauthorized private topic. A private topic must return the private-route behavior and must never reveal its title in metadata.
