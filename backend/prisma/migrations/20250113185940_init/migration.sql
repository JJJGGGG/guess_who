/*
  Warnings:

  - A unique constraint covering the columns `[row,col,boardId]` on the table `Tile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Tile_row_col_boardId_key" ON "Tile"("row", "col", "boardId");
