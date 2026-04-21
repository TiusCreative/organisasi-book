CREATE TABLE IF NOT EXISTS fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  asset_account_id UUID REFERENCES "ChartOfAccount"(id) ON DELETE SET NULL,
  depreciation_expense_account_id UUID NOT NULL REFERENCES "ChartOfAccount"(id) ON DELETE RESTRICT,
  accumulated_depreciation_account_id UUID NOT NULL REFERENCES "ChartOfAccount"(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  category TEXT,
  purchase_date DATE NOT NULL,
  purchase_price NUMERIC(18,2) NOT NULL,
  residual_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  depreciation_method TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_org_status
  ON fixed_assets (organization_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_assets_org_code
  ON fixed_assets (organization_id, code);

CREATE TABLE IF NOT EXISTS fixed_asset_depreciation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_asset_id UUID NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES "Transaction"(id) ON DELETE CASCADE,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  depreciation_amount NUMERIC(18,2) NOT NULL,
  accumulated_depreciation NUMERIC(18,2) NOT NULL,
  book_value_ending NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_asset_runs_unique_period
  ON fixed_asset_depreciation_runs (fixed_asset_id, month, year);
