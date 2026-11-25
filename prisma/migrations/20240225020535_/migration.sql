-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Board" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "chosenRow" INTEGER,
    "chosenCol" INTEGER,
    CONSTRAINT "Board_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Board" ("chosenCol", "chosenRow", "id", "playerId", "roomId") SELECT "chosenCol", "chosenRow", "id", "playerId", "roomId" FROM "Board";
DROP TABLE "Board";
ALTER TABLE "new_Board" RENAME TO "Board";
CREATE TABLE "new_Tile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "flipped" BOOLEAN NOT NULL,
    "boardId" INTEGER NOT NULL,
    "socketId" TEXT,
    CONSTRAINT "Tile_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tile" ("boardId", "col", "flipped", "id", "name", "photoUrl", "row", "socketId") SELECT "boardId", "col", "flipped", "id", "name", "photoUrl", "row", "socketId" FROM "Tile";
DROP TABLE "Tile";
ALTER TABLE "new_Tile" RENAME TO "Tile";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
