CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  type text NOT NULL,
  title text NOT NULL,
  address text NOT NULL,
  geo geography(Point, 4326),
  area_sqft numeric,
  bedrooms int,
  bathrooms int,
  attributes jsonb NOT NULL DEFAULT '{}',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  property_id uuid NOT NULL REFERENCES properties(id),
  kind text NOT NULL CHECK (kind IN ('sale','rent')),
  status text NOT NULL DEFAULT 'draft',
  price_amount bigint NOT NULL,          -- minor units
  price_currency char(3) NOT NULL DEFAULT 'BDT',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  phone text,
  email text,
  source text NOT NULL DEFAULT 'manual',
  stage text NOT NULL DEFAULT 'new',
  assignee_id uuid,
  listing_id uuid REFERENCES listings(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant isolation enforced in DB. App sets: SET app.tenant_id = '<uuid>'.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties','listings','leads'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant_isolation ON %I
      USING (tenant_id = current_setting('app.tenant_id')::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)$p$, t);
  END LOOP;
END $$;

CREATE INDEX ON properties USING gist (geo);
CREATE INDEX ON listings (tenant_id, status);
CREATE INDEX ON leads (tenant_id, stage);
