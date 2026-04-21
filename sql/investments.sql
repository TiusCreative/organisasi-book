CREATE TABLE IF NOT EXISTS "Investment" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  "accountId" UUID NOT NULL UNIQUE REFERENCES "ChartOfAccount"(id) ON DELETE RESTRICT,
  "sourceBankAccountId" UUID REFERENCES "BankAccount"(id) ON DELETE SET NULL,
  "settlementBankAccountId" UUID REFERENCES "BankAccount"(id) ON DELETE SET NULL,
  "inkasoTransactionId" UUID UNIQUE REFERENCES "Transaction"(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  "referenceNumber" TEXT,
  "startDate" TIMESTAMPTZ NOT NULL,
  "maturityDate" TIMESTAMPTZ,
  "purchaseAmount" NUMERIC(18,2) NOT NULL,
  "currentValue" NUMERIC(18,2) NOT NULL,
  "expectedReturn" NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_org_status
  ON "Investment" ("organizationId", status);

CREATE INDEX IF NOT EXISTS idx_investment_org_type
  ON "Investment" ("organizationId", type);
