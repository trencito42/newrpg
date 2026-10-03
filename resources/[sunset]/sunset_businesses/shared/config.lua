SunsetBusinesses = SunsetBusinesses or {}

SunsetBusinesses.AdminLevel = 3
-- [BUSINESS CAP] Maximum businesses one character may own. Enforced in every
-- ownership path: buyBusiness (in-transaction), TransferOwnership export and
-- player trades (pre-flight + in-transaction). 0 = unlimited. Admin
-- clearOwner/update actions never assign ownership, so they are unaffected.
SunsetBusinesses.MaxOwnedPerCharacter = 2
SunsetBusinesses.PurchaseRadius = 3.5
SunsetBusinesses.StoreInteractRadius = 4.0
SunsetBusinesses.NearbyBusinessRadius = 18.0
SunsetBusinesses.DefaultProfitPercent = 70
SunsetBusinesses.DefaultShopPrice = 175000
SunsetBusinesses.DefaultGasPrice = 275000
