# Phone media

`sunset_profile_media` issues upload tokens. `sunset_phone` owns the gallery and message attachments. `sunset_ui` only renders URLs.

## URL strategy

Photos use stable `https://racket.cat/media/` URLs. The FiveM server accepts a URL only after it consumes a single-use token bound to the character and `media_type = phone_photo`. Other hosts, `data:` URLs, and `javascript:` URLs are rejected. The token is 48 random hex characters, lives in memory, and expires in 90 seconds.

The upload route lives in `panel/src/app/api/media/upload/route.ts`. Phone photos are written under `public/media/phone/` and the JSON `url` is `https://racket.cat/media/phone/...`. The panel checks the 48-hex token shape, image magic bytes, and size. It does not share the FiveM in-memory token table. The game server still consumes that token and is the authority that decides which URL may be stored.

## Storage

Image bytes are not stored in MySQL or in NUI messages. `phone_media` keeps the URL and metadata. `phone_gallery` is the owner's visible library. Deleting a photo sets `phone_gallery.deleted_at`. A message keeps `attachment_id`, so the receiver can still open the historical image.

Saving a received photo inserts another gallery row for the same `phone_media.id`. It does not upload the file again.

A blob on racket.cat may be deleted only when no gallery row and no message, listing, or public post still references it. This resource cannot delete remote files, so physical cleanup stays a host-side job.

## Quotas

Each character may keep 250 non-deleted gallery photos. Capture is rate-limited. A full gallery returns an error and does not delete older photos.

## Deferred

Marketplace listing photos and CNN image posts are not part of this version. Contact cards and live location are not included. Location messages are a snapshot.
