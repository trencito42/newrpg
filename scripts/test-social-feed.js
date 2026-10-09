const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const domain = read('resources/[sunset]/sunset_social/server/domain.lua');
const panelFeed = read('panel/src/lib/social-feed.ts');
const route = read('panel/src/app/api/feed/posts/route.ts');
const phoneJs = read('resources/[sunset]/sunset_ui/web/js/phone.js');

test('FetchFeed binds viewerCharId before IN/cursor placeholders', () => {
  assert.match(domain, /Social\.FEED_SELECT[\s\S]*LEFT JOIN social_post_likes vl ON vl\.post_id = p\.id AND vl\.character_id = \?/);
  const fn = domain.slice(domain.indexOf('function Social.FetchFeed'));
  assert.match(fn, /local params = \{ viewerCharId or 0 \}/);
  assert.doesNotMatch(fn, /params\[#params \+ 1\] = viewerCharId/);
  const firstAppend = fn.match(/params\[#params \+ 1\] =/);
  assert.ok(firstAppend, 'expects dynamic param appends after viewer seed');
});

test('panel fetchSocialFeedPosts uses viewer-first parameter order', () => {
  assert.match(panelFeed, /const params: \(number \| string\)\[\] = \[viewerCharId \?\? 0\]/);
  assert.match(panelFeed, /LEFT JOIN social_post_likes vl ON vl\.post_id = p\.id AND vl\.character_id = \?/);
  const afterViewer = panelFeed.indexOf('params.push(...characterIds)');
  const viewerLine = panelFeed.indexOf('[viewerCharId ?? 0]');
  assert.ok(viewerLine > 0);
  if (afterViewer > 0) assert.ok(viewerLine < afterViewer);
});

test('feed API route delegates to shared fetchSocialFeedPosts', () => {
  assert.match(route, /fetchSocialFeedPosts/);
  assert.doesNotMatch(route, /async function buildFeedQuery/);
});

test('domain feed and comments expose author_skin and clan fields', () => {
  assert.match(domain, /author_skin/);
  assert.match(domain, /clan_tag/);
  assert.match(domain, /Social\.COMMENT_SELECT/);
  assert.match(domain, /Social\.FetchPostById/);
});

test('phone feed uses ped avatars and pending like state', () => {
  assert.match(phoneJs, /_pedAvatarUrl/);
  assert.match(phoneJs, /docs-backend\.fivem\.net\/peds\//);
  assert.match(phoneJs, /_feedLikePending/);
  assert.match(phoneJs, /feedRefresh/);
  assert.match(phoneJs, /_mergeFeedRefresh/);
});

test('phone like handler sends seq for stale response guard', () => {
  assert.match(phoneJs, /payload\.seq !== pending\.seq/);
  assert.match(phoneJs, /op: 'feedRefresh'/);
});
