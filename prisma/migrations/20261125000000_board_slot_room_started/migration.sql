/*
  Finding #17: make the database enforce at most two players per room and a
  single /start per game.
  - Board.slot (0 or 1), unique per room, and (roomId, playerId) unique.
  - Room.started, set by a conditional update in /start.
  Existing rows are backfilled. Rows that would break the new constraints
  (a player twice in one room, a third board) are dropped, along with their tiles.
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Keep only the first board per (room, player), then the first two per room.
DELETE FROM "Board" WHERE "id" NOT IN (
    SELECT MIN("id") FROM "Board" GROUP BY "roomId", "playerId"
);
CREATE TABLE "new_Board" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL DEFAULT '',
    "slot" INTEGER NOT NULL,
    "chosenRow" INTEGER,
    "chosenCol" INTEGER,
    "disconnectedAt" DATETIME,
    CONSTRAINT "Board_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("chosenCol", "chosenRow", "disconnectedAt", "id", "playerId", "playerName", "roomId", "slot")
SELECT "chosenCol", "chosenRow", "disconnectedAt", "id", "playerId", "playerName", "roomId", "slot" FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY "roomId" ORDER BY "id") - 1 AS "slot" FROM "Board"
) WHERE "slot" <= 1;
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE INDEX "Board_disconnectedAt_idx" ON "Board"("disconnectedAt");
CREATE UNIQUE INDEX "Board_roomId_slot_key" ON "Board"("roomId", "slot");
CREATE UNIQUE INDEX "Board_roomId_playerId_key" ON "Board"("roomId", "playerId");

-- Foreign keys are off, so the cascade doesn't run: drop orphaned tiles by hand.
DELETE FROM "Tile" WHERE "boardId" NOT IN (SELECT "id" FROM "Board");

CREATE TABLE "new_Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "started" BOOLEAN NOT NULL DEFAULT false
);
-- A room whose boards already have tiles has started.
INSERT INTO "new_Room" ("id", "started")
SELECT "id", EXISTS (
    SELECT 1 FROM "Tile" JOIN "Board" ON "Board"."id" = "Tile"."boardId" WHERE "Board"."roomId" = "Room"."id"
) FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
