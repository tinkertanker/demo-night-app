-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Event_date_idx" ON "Event"("date");

-- CreateIndex
CREATE INDEX "Feedback_demoId_idx" ON "Feedback"("demoId");

-- CreateIndex
CREATE INDEX "Vote_demoId_idx" ON "Vote"("demoId");
