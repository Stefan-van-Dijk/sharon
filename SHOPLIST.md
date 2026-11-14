# ShopList bridge

ShopList (repository Shopl, URL /Shopl/) uses the existing Sharon identity and network endpoint. No credentials go in links. The first integration supports the shared GitHub Pages origin only; other origins require a future delegated identity handshake and are rejected.

The Notities & lijsten module combines local free text, ideas and checklists with centrally stored ShopList lists. Linked lists open a branded ShopList board. A rightward row swipe opens owner-controlled read/write/revoked grants for existing Sharon contacts. It opens the selected list in the standalone app, not an iframe. Full scanner screens embedded in Sharon, shop-location/card composition, paid-history cleanup and multi-list offline merging are not implemented in this change.

The server checks membership on every action, list-specific access, owner-only grants and revision preconditions under its existing file transaction lock. Updates use a stable operation ID until acknowledged. Conflicts retain the local copy; retrieving the online version archives differing local content as a separate list. Read-only edits become private copies. This is whole-list optimistic concurrency, not automatic field merging.

Deploy server/connections.php to the existing /log/api/connections.php endpoint before releasing both clients. Preserve /log/private/connections and all existing identity data. GitHub Pages cannot deploy PHP. Validate server tests, then test two real connected identities: create, share, edit, conflict, offline retry, revoke. Clients display unavailable/pending until the endpoint supports these actions. The existing localStorage key bs.app.v1 is deliberately retained.

Release coordination: merge/release the matching BS and Sharon pull requests only after server deployment and cross-device verification. Follow the existing Sharon version bump and asset generation before release. These changes do not rename the GitHub repository or move existing URLs.
