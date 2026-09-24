CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'ACCEPTED', 'FAILED', 'UNKNOWN', 'OPENED');
CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "channel" "DeliveryChannel" NOT NULL,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "providerId" TEXT,
  "error" TEXT,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DeliveryAttempt_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeliveryAttempt_requestKey_key" ON "DeliveryAttempt"("requestKey");
CREATE INDEX "DeliveryAttempt_status_availableAt_idx" ON "DeliveryAttempt"("status", "availableAt");
CREATE INDEX "DeliveryAttempt_invoiceId_createdAt_idx" ON "DeliveryAttempt"("invoiceId", "createdAt");
CREATE INDEX "DeliveryAttempt_requestedById_idx" ON "DeliveryAttempt"("requestedById");