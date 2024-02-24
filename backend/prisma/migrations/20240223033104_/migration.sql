-- CreateTable
CREATE TABLE "Room" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- CreateTable
CREATE TABLE "Board" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "roomId" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "chosenRow" INTEGER,
    "chosenCol" INTEGER,
    CONSTRAINT "Board_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "photo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "boardId" INTEGER NOT NULL,
    CONSTRAINT "Tile_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_roomId_key" ON "Board"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_boardId_key" ON "Tile"("boardId");
