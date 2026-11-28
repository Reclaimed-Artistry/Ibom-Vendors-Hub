-- Add approved amount and repayment plan fields to loan_applications
-- Loan officers can approve a different amount than applied,
-- and the system recalculates interest (10%/month) and repayment plan.

alter table loan_applications
  add column if not exists approved_amount numeric,
  add column if not exists approved_monthly_interest numeric,
  add column if not exists approved_total_interest numeric,
  add column if not exists approved_total_repayable numeric,
  add column if not exists approved_monthly_payment numeric,
  add column if not exists repayment_plan_type text,
  add column if not exists repayment_schedule jsonb,
  add column if not exists agent_approved_at timestamptz;

-- Index for looking up approved loans by agent
create index if not exists idx_loan_applications_approved_amount
  on loan_applications(agent_assigned, agent_approved_at)
  where approved_amount is not null;

-- Comment for documentation
comment on column loan_applications.approved_amount is
  'The loan amount approved by the loan officer (may differ from applied amount). Null until assessment is completed with an approve decision.';
comment on column loan_applications.repayment_plan_type is
  'Type of repayment plan based on loan type: pure_loan or financial_lease.';
comment on column loan_applications.repayment_schedule is
  'JSONB array of repayment installments with due dates and amounts.';
comment on column loan_applications.agent_approved_at is
  'Timestamp when the loan officer set the approved amount and repayment plan.';
