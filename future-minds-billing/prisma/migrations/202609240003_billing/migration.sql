-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('UPI', 'CASH', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "activeKey" TEXT,
    "studentName" TEXT NOT NULL,
    "studentCode" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentAddress" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "paymentPlan" "PaymentPlan" NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,
    "scholarship" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "paidAt" DATE NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_activeKey_key" ON "Invoice"("activeKey");

-- CreateIndex
CREATE INDEX "Invoice_enrollmentId_periodKey_idx" ON "Invoice"("enrollmentId", "periodKey");

-- CreateIndex
CREATE INDEX "Invoice_invoiceDate_idx" ON "Invoice"("invoiceDate");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE INDEX "Invoice_createdById_idx" ON "Invoice"("createdById");

-- CreateIndex
CREATE INDEX "Invoice_cancelledById_idx" ON "Invoice"("cancelledById");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_requestKey_key" ON "Payment"("requestKey");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_mode_idx" ON "Payment"("paidAt", "mode");

-- CreateIndex
CREATE INDEX "Payment_recordedById_idx" ON "Payment"("recordedById");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_amounts_check" CHECK (
    "gross" >= 0 AND "scholarship" >= 0 AND "discount" >= 0 AND
    "total" >= 0 AND "total" = "gross" - "scholarship" - "discount" AND "dueDate" >= "invoiceDate"
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_check" CHECK ("amount" > 0);

CREATE FUNCTION fm_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Historical records cannot be changed or deleted';
END;
$$;
CREATE TRIGGER payment_immutable BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION fm_immutable_record();
CREATE TRIGGER invoice_item_immutable BEFORE UPDATE OR DELETE ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION fm_immutable_record();
CREATE TRIGGER invoice_no_delete BEFORE DELETE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION fm_immutable_record();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fm_immutable_record();

CREATE FUNCTION fm_invoice_cancellation_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - ARRAY['cancelledAt','cancelledById','cancelReason','activeKey','updatedAt']) IS DISTINCT FROM
         (to_jsonb(OLD) - ARRAY['cancelledAt','cancelledById','cancelReason','activeKey','updatedAt']) OR
         OLD."cancelledAt" IS NOT NULL OR NEW."cancelledAt" IS NULL OR NEW."cancelledById" IS NULL OR
         length(trim(NEW."cancelReason")) < 3 OR NEW."activeKey" IS NOT NULL THEN
        RAISE EXCEPTION 'Only documented cancellation is permitted';
    END IF;
    IF EXISTS (SELECT 1 FROM "Payment" WHERE "invoiceId" = OLD.id) THEN
        RAISE EXCEPTION 'Invoices with payments require a refund workflow';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER invoice_cancellation_only BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION fm_invoice_cancellation_only();

CREATE FUNCTION fm_payment_limit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bill "Invoice"%ROWTYPE; paid NUMERIC;
BEGIN
    SELECT * INTO bill FROM "Invoice" WHERE id = NEW."invoiceId" FOR UPDATE;
    SELECT COALESCE(SUM(amount), 0) INTO paid FROM "Payment" WHERE "invoiceId" = NEW."invoiceId";
    IF bill.id IS NULL OR bill."cancelledAt" IS NOT NULL OR paid + NEW.amount > bill.total OR NEW."paidAt" < bill."invoiceDate" THEN
        RAISE EXCEPTION 'Invalid payment for this invoice';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER payment_limit BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION fm_payment_limit();
