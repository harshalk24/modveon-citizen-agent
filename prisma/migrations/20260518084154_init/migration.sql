-- CreateTable
CREATE TABLE "Citizen" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SV',
    "email" TEXT,
    "gender" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CitizenContext" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT NOT NULL,
    "lifeEvent" TEXT,
    "employment" TEXT,
    "entitlementsJson" TEXT NOT NULL DEFAULT '[]',
    "conversationSummary" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CitizenContext_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT NOT NULL,
    "planJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActionPlan_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "serviceName" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "reminded30" BOOLEAN NOT NULL DEFAULT false,
    "reminded7" BOOLEAN NOT NULL DEFAULT false,
    "reminded1" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deadline_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT,
    "serviceId" TEXT,
    "messageId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResponseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "citizenId" TEXT,
    "sessionId" TEXT,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "kbSourceIds" TEXT NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL DEFAULT 'gemini-2.5-flash-lite',
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResponseLog_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "Citizen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KBChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL DEFAULT 'manual',
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "CitizenContext_citizenId_key" ON "CitizenContext"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionPlan_citizenId_key" ON "ActionPlan"("citizenId");
