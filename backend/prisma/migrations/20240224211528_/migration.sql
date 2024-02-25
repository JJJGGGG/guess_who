/*
  Warnings:

  - Added the required column `flipped` to the `Tile` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "flipped" BOOLEAN NOT NULL,
    "boardId" INTEGER NOT NULL,
    CONSTRAINT "Tile_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Tile" ("boardId", "col", "id", "name", "photoUrl", "row") SELECT "boardId", "col", "id", "name", "photoUrl", "row" FROM "Tile";
DROP TABLE "Tile";
ALTER TABLE "new_Tile" RENAME TO "Tile";
CREATE UNIQUE INDEX "Tile_boardId_key" ON "Tile"("boardId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
