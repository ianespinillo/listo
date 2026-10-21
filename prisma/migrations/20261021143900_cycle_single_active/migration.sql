-- CreateIndex
CREATE UNIQUE INDEX "cycle_single_active" ON "cycle"("active") WHERE ("active" = true);
