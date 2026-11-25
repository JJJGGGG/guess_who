-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "started" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Backfill in Prisma's SQLite DateTime format (integer milliseconds). The
-- column default (CURRENT_TIMESTAMP) would store text, which never compares
-- as older than a cutoff, so existing rooms would never be cleaned up.
INSERT INTO "new_Room" ("id", "started", "createdAt") SELECT "id", "started", CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
