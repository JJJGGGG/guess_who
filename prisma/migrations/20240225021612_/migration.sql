/*
  Warnings:

  - You are about to drop the column `socketId` on the `Tile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Board" ADD COLUMN "socketId" TEXT;

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
    CONSTRAINT "Tile_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Tile" ("boardId", "col", "flipped", "id", "name", "photoUrl", "row") SELECT "boardId", "col", "flipped", "id", "name", "photoUrl", "row" FROM "Tile";
DROP TABLE "Tile";
ALTER TABLE "new_Tile" RENAME TO "Tile";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
