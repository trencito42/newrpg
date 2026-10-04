# Phone media

`sunset_profile_media` issues upload tokens. `sunset_phone` owns the gallery and message attachments. `sunset_ui` only renders URLs.

## URL strategy

Photos use stable `https://racket.cat/media/` URLs. The raw upload token is 64 hex characters from MySQL `RANDOM_BYTES(32)`. Only `SHA2(token, 256)` is stored in `media_upload_tokens`. The same ledger covers `phone_photo`, `player_avatar`, and `vehicle_preview`. A token expires in about 90 seconds and can be uploaded once.

The upload route lives in `panel/src/app/api/media/upload/route.ts`. It hashes `X-Media-Token`, claims the ledger row atomically, checks image magic bytes, and writes an unpredictable filename. Phone photos go under `public/media/phone/` and the JSON `url` is `https://racket.cat/media/phone/...`. The game server commits from that ledger row. A client-supplied URL is not authority.

## Storage

Image bytes are not stored in MySQL or in NUI messages. `phone_media` keeps the URL and metadata. `phone_gallery` is the owner's visible library. Deleting a photo sets `phone_gallery.deleted_at`. A message keeps `attachment_id`, so the receiver can still open the historical image.

Saving a received photo inserts another gallery row for the same `phone_media.id`. It does not upload the file again.

A blob on racket.cat may be deleted only when no gallery row and no message, listing, or public post still references it. This resource cannot delete remote files, so physical cleanup stays a host-side job.

## Quotas

Each character may keep 250 non-deleted gallery photos. Capture is rate-limited. A full gallery returns an error and does not delete older photos.

## Deferred

Marketplace listing photos and CNN image posts are not part of this version. Contact cards and live location are not included. Location messages are a snapshot.
