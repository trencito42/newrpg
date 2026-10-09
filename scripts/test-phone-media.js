const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const media = read('resources/[sunset]/sunset_phone/server/media.lua');
const tokens = read('resources/[sunset]/sunset_profile_media/server/main.lua');
const sql = read('sql/88-phone-media.sql');
const camera = read('resources/[sunset]/sunset_phone/client/camera.lua');
const phoneJs = read('resources/[sunset]/sunset_ui/web/js/phone.js');
const state = read('resources/[sunset]/sunset_ui/web/js/phone-state.js');
const send = read('resources/[sunset]/sunset_phone/server/main.lua');
const clientSend = read('resources/[sunset]/sunset_phone/client/main.lua');

test('upload tokens are random, single-use, and typed', () => {
    assert.match(tokens, /RANDOM_BYTES\(32\)/);
    assert.match(tokens, /SHA2\(\?, 256\)/);
    assert.doesNotMatch(tokens, /math\.random/);
    assert.doesNotMatch(tokens, /phone_photo_' \.\. account/);
    assert.match(tokens, /uploaded_at IS NOT NULL/);
    assert.match(tokens, /committed_at IS NULL/);
    assert.match(media, /sunset:phoneMediaCommit', function\(source, token\)/);
    assert.match(media, /allowedMediaUrl\(consumed\.media_url\)/);
    assert.doesNotMatch(media, /phoneMediaCommit', function\(source, token, url/);
    assert.match(tokens, /phone_photo = true/);
});

test('phone media migration stores references, not bytes', () => {
    assert.match(sql, /CREATE TABLE IF NOT EXISTS phone_media/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS phone_gallery/);
    assert.match(sql, /KEY idx_phone_media_owner \(character_id, created_at\)/);
    assert.match(sql, /attachment_type/);
    assert.doesNotMatch(sql, /LONGTEXT|MEDIUMBLOB|LONGBLOB/);
});

test('gallery delete hides the owner copy and keeps the media row', () => {
    assert.match(media, /UPDATE phone_gallery SET deleted_at/);
    assert.doesNotMatch(media, /DELETE FROM phone_media/);
    assert.match(media, /ON DUPLICATE KEY UPDATE deleted_at = NULL/);
    assert.match(media, /MaxPhotosPerCharacter/);
});

test('photo messages accept a media id and reject foreign URLs', () => {
    assert.match(media, /canReadMedia/);
    assert.match(media, /attachment\.mediaId/);
    assert.match(media, /racket%.cat\/media/);
    assert.doesNotMatch(media, /INSERT INTO phone_messages/);
    assert.doesNotMatch(send, /data:image/);
    assert.match(send, /attachment_type, attachment_id, attachment_snapshot/);
    assert.match(send, /LEFT JOIN phone_media/);
});

test('current location is taken from the server ped', () => {
    assert.match(media, /GetPlayerPed\(source\)/);
    assert.match(media, /GetEntityCoords\(ped\)/);
    assert.match(media, /finiteCoord/);
    assert.match(media, /n ~= n/);
    assert.match(clientSend, /attachment = \{ type = 'photo', mediaId/);
});

test('camera is a scripted camera with cleanup', () => {
    assert.match(camera, /CreateCam\('DEFAULT_SCRIPTED_CAMERA'/);
    assert.match(camera, /cellphone@self/);
    assert.match(camera, /DestroyCam/);
    assert.match(camera, /DisplayHud\(true\)/);
    assert.match(camera, /SetHudSuppressed\(false\)/);
    assert.doesNotMatch(camera, /RegisterCommand\('photo'/);
    assert.doesNotMatch(camera, /data:image/);
});

test('rear camera faces forward with lens FOV presets and local ped hide', () => {
    assert.match(camera, /GetOffsetFromEntityInWorldCoords\(ped, 0\.0, 0\.36, 0\.66\)/);
    assert.match(camera, /SetEntityLocallyInvisible/);
    assert.match(camera, /SetEntityLocallyVisible/);
    assert.match(camera, /\['0\.5'\] = 90\.0/);
    assert.match(camera, /\['1'\] = 55\.0/);
    assert.match(camera, /\['2'\] = 32\.0/);
    assert.match(camera, /SetCamFov/);
    assert.doesNotMatch(camera, /coords\.x - math\.sin\(-rad\) \* dist/);
});

test('camera look requires explicit aim flag from NUI', () => {
    assert.match(camera, /data\.aim ~= true/);
    assert.match(phoneJs, /op: 'cameraLook'.*aim: true/);
    assert.match(phoneJs, /pointerdown/);
    assert.match(phoneJs, /event\.button !== 2/);
    assert.match(phoneJs, /captureState/);
    assert.match(phoneJs, /cameraLens/);
});

test('phone camera HUD exposes lens selector and capture states', () => {
    assert.match(phoneJs, /phone-camera-lenses/);
    assert.match(phoneJs, /camera_saving/);
    assert.match(phoneJs, /camera_saved_gallery/);
    assert.match(read('resources/[sunset]/sunset_ui/web/modules/phone/index.html'), /data-lens="0\.5"/);
});

test('phone UI does not preload the gallery or trust arbitrary image URLs', () => {
    assert.match(state, /'camera'/);
    assert.match(state, /'gallery'/);
    assert.match(phoneJs, /safeMediaUrl/);
    assert.match(phoneJs, /racket\\\.cat\\\/media/);
    assert.doesNotMatch(phoneJs, /data:image/);
    const needs = phoneJs.match(/const needs = \{[^}]+\}/);
    assert.ok(needs);
    assert.doesNotMatch(needs[0], /gallery/);
});
