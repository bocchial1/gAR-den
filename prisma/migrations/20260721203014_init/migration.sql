-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Garden" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'Home garden',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Garden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gardenId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "sourceFilename" TEXT,
    "rawPath" TEXT,
    "heightmapPath" TEXT,
    "boundaryPath" TEXT,
    "previewPath" TEXT,
    "minZ" REAL,
    "maxZ" REAL,
    "widthMeters" REAL,
    "heightMeters" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScanVersion_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "Garden" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
