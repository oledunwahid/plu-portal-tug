-- CreateTable
CREATE TABLE "DiscountRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "outletGroup" TEXT NOT NULL,
    "cashierOutlet" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buttonName" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" REAL NOT NULL,
    "discountValueType" TEXT NOT NULL,
    "outlets" TEXT NOT NULL DEFAULT '',
    "applicableTo" TEXT NOT NULL,
    "conditions" TEXT,
    "remarks" TEXT,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "doneAt" DATETIME,
    CONSTRAINT "DiscountRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
