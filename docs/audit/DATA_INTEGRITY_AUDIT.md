# Data integrity audit

## What is atomic

Marketplace buy updates the listing to `sold`, debits the buyer, moves the vehicle, item, or property, credits the seller, and debits the fee inside `MySQL.startTransaction`. A failed step rolls the money back.

Clan accept locks the clan row, counts members, and inserts in that transaction. `oxmysql` commits only when the callback does not return `false`.

Shop purchases record `shop_orders` with a unique `request_id`. The same request cannot debit twice. A delivery error refunds Racket Credits when the process stays up.

Rename writes `characters.firstname` through `RenameCharacter` and does not update `accounts.username`.

## What is not atomic

| Path | Failure |
| --- | --- |
| Market item list | Item removed, then listing inserted. Crash loses the item. |
| Shop purchase | Credits spent, then handler runs. Kill in `processing` can leave credits spent and the order unfinished. |
| 24/7 buy | Money removed, then item added. Crash loses the payment. |
| Ground pickup | Item added, then the drop is cleared. Crash can leave both. |
| Market item insert | Raw SQL, not `AddItem`. Weight is not checked. Cache is reloaded after commit so the row is visible. |

## Migrations

No migration was added. `scripts/apply-migrations.sh` records checksums in `schema_migrations` and refuses an edited applied file. This environment did not execute the runner, so clean-install and upgrade were not proven here.

## Identity

`firstname` is the public nickname. `lastname` stays empty for new characters. Concatenation that does not go through `FormatPublicName` still exists in dispatch, dice, trade, and one faction driver line. Those are display bugs, not a second nickname store.
