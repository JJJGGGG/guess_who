-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Backfill in Prisma's SQLite DateTime format (integer milliseconds), as in
-- the room_created_at migration: the text default would never compare as
-- older than a cutoff. Existing rooms start their idle timer now.
INSERT INTO "new_Room" ("id", "started", "createdAt", "lastActivityAt") SELECT "id", "started", "createdAt", CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
