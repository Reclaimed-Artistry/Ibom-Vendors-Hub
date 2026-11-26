"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveLoanApplicationAction } from "@/app/actions/loans";
import { Alert, Button, Field } from "@/components/ui";
import {
  CreditCard,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react";

interface FieldError {
  [key: string]: string;
}

export default function LoanApplicationPage() {
  const [state, formAction] = useActionState(
    saveLoanApplicationAction,
    {} as { error?: string; message?: string; reference?: string; fieldErrors?: FieldError },
  );
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="container-page py-10 max-w-5xl mx-auto">
      <nav className="flex items-center gap-1 text-xs text-ink-500 mb-6">
        <Link href="/" className="hover:underline">Home</Link>
        <span>/</span>
        <span className="text-ink-900 font-medium">Apply for a loan</span>
      </nav>

      <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl mb-1">
        Apply for a loan
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-500">
        Get funding to grow your business. Complete the application below and a
        loan officer will review it. Fixed 10% monthly interest, repayable over
        1 to 12 months.
      </p>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.message ? (
        <Alert tone="success">
          {state.message}
          {state.reference && (
            <p className="mt-2 text-xs text-ink-500">
              Application reference: <strong>{state.reference}</strong>
            </p>
          )}
        </Alert>
      ) : null}

      {state.message && state.reference ? (
        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-brand-800 mb-3">What happens next</h3>
          <ol className="space-y-2 text-sm text-ink-600 list-disc list-inside">
            <li>A confirmation email has been sent to you with your application details.</li>
            <li>A loan officer has been assigned and will contact you to schedule a physical assessment.</li>
            <li>Once approved, funds are disbursed to your bank account.</li>
          </ol>
          <Link href="/" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            Return home
          </Link>
        </div>
      ) : null}

      {!state.message && (
        <form action={formAction} className="space-y-8 mt-8">
          {/* Applicant details */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <User className="size-4" /> Applicant details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Full name"
                htmlFor="full_name"
                required
                error={state.fieldErrors?.full_name}
              >
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  className="input"
                  placeholder="e.g. Akpabio Uwem"
                  required
                />
              </Field>
              <Field
                label="Native of (Town)"
                htmlFor="native_of"
                required
                error={state.fieldErrors?.native_of}
              >
                <input
                  id="native_of"
                  name="native_of"
                  type="text"
                  className="input"
                  placeholder="e.g. Uyo"
                  required
                />
              </Field>
              <Field
                label="L.G.A."
                htmlFor="lga"
                required
                error={state.fieldErrors?.lga}
              >
                <input
                  id="lga"
                  name="lga"
                  type="text"
                  className="input"
                  placeholder="e.g. Uyo"
                  required
                />
              </Field>
              <Field
                label="State"
                htmlFor="state"
                required
                error={state.fieldErrors?.state}
              >
                <input
                  id="state"
                  name="state"
                  type="text"
                  className="input"
                  placeholder="e.g. Akwa Ibom"
                  required
                />
              </Field>
              <Field
                label="Residential Address"
                htmlFor="residential_address"
                required
                error={state.fieldErrors?.residential_address}
              >
                <input
                  id="residential_address"
                  name="residential_address"
                  type="text"
                  className="input"
                  placeholder="e.g. 15 Ikpa Road, Uyo"
                  required
                />
              </Field>
              <Field
                label="Phone Number (1)"
                htmlFor="phone_1"
                required
                error={state.fieldErrors?.phone_1}
              >
                <input
                  id="phone_1"
                  name="phone_1"
                  type="tel"
                  className="input"
                  placeholder="e.g. 08012345678"
                  required
                />
              </Field>
              <Field
                label="Phone Number (2)"
                htmlFor="phone_2"
                error={state.fieldErrors?.phone_2}
              >
                <input
                  id="phone_2"
                  name="phone_2"
                  type="tel"
                  className="input"
                  placeholder="Optional second number"
                />
              </Field>
              <Field
                label="ID Number"
                htmlFor="id_number"
                required
                error={state.fieldErrors?.id_number}
              >
                <input
                  id="id_number"
                  name="id_number"
                  type="text"
                  className="input"
                  placeholder="e.g. NIN or Voter's card number"
                  required
                />
              </Field>
              <Field
                label="Sex"
                htmlFor="sex"
                required
                error={state.fieldErrors?.sex}
              >
                <select id="sex" name="sex" className="input" required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field
                label="Date of Birth"
                htmlFor="date_of_birth"
                required
                error={state.fieldErrors?.date_of_birth}
              >
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Vehicle Registration No. (optional)"
                htmlFor="vehicle_reg_no"
                error={state.fieldErrors?.vehicle_reg_no}
              >
                <input
                  id="vehicle_reg_no"
                  name="vehicle_reg_no"
                  type="text"
                  className="input"
                  placeholder="e.g. AKU 123 XY"
                />
              </Field>
              <Field
                label="Occupation / Post"
                htmlFor="occupation"
                required
                error={state.fieldErrors?.occupation}
              >
                <input
                  id="occupation"
                  name="occupation"
                  type="text"
                  className="input"
                  placeholder="e.g. Trader, Civil Servant"
                  required
                />
              </Field>
              <Field
                label="Religion"
                htmlFor="religion"
                required
                error={state.fieldErrors?.religion}
              >
                <input
                  id="religion"
                  name="religion"
                  type="text"
                  className="input"
                  placeholder="e.g. Christianity"
                  required
                />
              </Field>
              <Field
                label="Worship With"
                htmlFor="worship_with"
                required
                error={state.fieldErrors?.worship_with}
              >
                <input
                  id="worship_with"
                  name="worship_with"
                  type="text"
                  className="input"
                  placeholder="e.g. Church name"
                  required
                />
              </Field>
              <Field
                label="Post / Position"
                htmlFor="post_position"
                required
                error={state.fieldErrors?.post_position}
              >
                <input
                  id="post_position"
                  name="post_position"
                  type="text"
                  className="input"
                  placeholder="e.g. Member, Deacon"
                  required
                />
              </Field>
              <Field
                label="Church Address"
                htmlFor="church_address"
                required
                error={state.fieldErrors?.church_address}
              >
                <input
                  id="church_address"
                  name="church_address"
                  type="text"
                  className="input"
                  placeholder="e.g. Church address"
                  required
                />
              </Field>
            </div>

            <Field
              label="Applicant Passport Photograph"
              htmlFor="applicant_passport"
              required
              error={state.fieldErrors?.applicant_passport}
            >
              <input
                id="applicant_passport"
                name="applicant_passport"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-ink-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                required
              />
            </Field>
          </section>

          {/* Loan details */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <CreditCard className="size-4" /> Loan details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Loan amount (₦)"
                htmlFor="loan_amount_figures"
                required
                error={state.fieldErrors?.loan_amount_figures}
              >
                <input
                  id="loan_amount_figures"
                  name="loan_amount_figures"
                  type="number"
                  min="1"
                  className="input"
                  placeholder="e.g. 500000"
                  required
                />
              </Field>
              <Field
                label="Loan amount (in words)"
                htmlFor="loan_amount_words"
                required
                error={state.fieldErrors?.loan_amount_words}
                hint="e.g. Five hundred thousand Naira"
              >
                <input
                  id="loan_amount_words"
                  name="loan_amount_words"
                  type="text"
                  className="input"
                  placeholder="Five hundred thousand Naira"
                  required
                />
              </Field>
              <Field
                label="Loan type"
                htmlFor="loan_type"
                required
                error={state.fieldErrors?.loan_type}
              >
                <select id="loan_type" name="loan_type" className="input" required>
                  <option value="">Select loan type</option>
                  <option value="pure_loan">Pure Loan</option>
                  <option value="financial_lease">Financial Lease</option>
                </select>
              </Field>
              <Field
                label="Duration (months)"
                htmlFor="duration_months"
                required
                error={state.fieldErrors?.duration_months}
                hint="1 to 12 months"
              >
                <select id="duration_months" name="duration_months" className="input" required>
                  <option value="">Select</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={String(m)}>
                      {m} month{m === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Repayment frequency"
                htmlFor="repayment_frequency"
                required
                error={state.fieldErrors?.repayment_frequency}
              >
                <select
                  id="repayment_frequency"
                  name="repayment_frequency"
                  className="input"
                  required
                >
                  <option value="">Select frequency</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Bi-weekly">Bi-weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </Field>
              <Field
                label="Date received"
                htmlFor="date_received"
                required
                error={state.fieldErrors?.date_received}
              >
                <input
                  id="date_received"
                  name="date_received"
                  type="date"
                  className="input"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  required
                />
              </Field>
            </div>
          </section>

          {/* Surety 1 */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Users className="size-4" /> First Surety (Guarantor)
            </h2>
            <p className="text-sm text-ink-500 mb-4">
              A guarantor who vouches for you and can be contacted if needed.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Title"
                htmlFor="surety1_title"
                required
                error={state.fieldErrors?.surety1_title}
              >
                <input
                  id="surety1_title"
                  name="surety1_title"
                  type="text"
                  className="input"
                  placeholder="e.g. Mr, Mrs, Dr"
                  required
                />
              </Field>
              <Field
                label="Full name"
                htmlFor="surety1_full_name"
                required
                error={state.fieldErrors?.surety1_full_name}
              >
                <input
                  id="surety1_full_name"
                  name="surety1_full_name"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Family name"
                htmlFor="surety1_family"
                required
                error={state.fieldErrors?.surety1_family}
              >
                <input
                  id="surety1_family"
                  name="surety1_family"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Native of (Town)"
                htmlFor="surety1_native_of"
                required
                error={state.fieldErrors?.surety1_native_of}
              >
                <input
                  id="surety1_native_of"
                  name="surety1_native_of"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="L.G.A."
                htmlFor="surety1_lga"
                required
                error={state.fieldErrors?.surety1_lga}
              >
                <input
                  id="surety1_lga"
                  name="surety1_lga"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="State"
                htmlFor="surety1_state"
                required
                error={state.fieldErrors?.surety1_state}
              >
                <input
                  id="surety1_state"
                  name="surety1_state"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Residential Address"
                htmlFor="surety1_address"
                required
                error={state.fieldErrors?.surety1_address}
              >
                <input
                  id="surety1_address"
                  name="surety1_address"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Phone Number (1)"
                htmlFor="surety1_phone_1"
                required
                error={state.fieldErrors?.surety1_phone_1}
              >
                <input
                  id="surety1_phone_1"
                  name="surety1_phone_1"
                  type="tel"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Phone Number (2)"
                htmlFor="surety1_phone_2"
                error={state.fieldErrors?.surety1_phone_2}
              >
                <input
                  id="surety1_phone_2"
                  name="surety1_phone_2"
                  type="tel"
                  className="input"
                />
              </Field>
              <Field
                label="ID Number"
                htmlFor="surety1_id_number"
                required
                error={state.fieldErrors?.surety1_id_number}
              >
                <input
                  id="surety1_id_number"
                  name="surety1_id_number"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Sex"
                htmlFor="surety1_sex"
                required
                error={state.fieldErrors?.surety1_sex}
              >
                <select id="surety1_sex" name="surety1_sex" className="input" required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field
                label="Date of Birth"
                htmlFor="surety1_date_of_birth"
                required
                error={state.fieldErrors?.surety1_date_of_birth}
              >
                <input
                  id="surety1_date_of_birth"
                  name="surety1_date_of_birth"
                  type="date"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Vehicle Registration No. (optional)"
                htmlFor="surety1_vehicle_reg_no"
                error={state.fieldErrors?.surety1_vehicle_reg_no}
              >
                <input
                  id="surety1_vehicle_reg_no"
                  name="surety1_vehicle_reg_no"
                  type="text"
                  className="input"
                />
              </Field>
              <Field
                label="Occupation / Post"
                htmlFor="surety1_occupation"
                required
                error={state.fieldErrors?.surety1_occupation}
              >
                <input
                  id="surety1_occupation"
                  name="surety1_occupation"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Religion"
                htmlFor="surety1_religion"
                required
                error={state.fieldErrors?.surety1_religion}
              >
                <input
                  id="surety1_religion"
                  name="surety1_religion"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Worship With"
                htmlFor="surety1_worship_with"
                required
                error={state.fieldErrors?.surety1_worship_with}
              >
                <input
                  id="surety1_worship_with"
                  name="surety1_worship_with"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Post / Position"
                htmlFor="surety1_post_position"
                required
                error={state.fieldErrors?.surety1_post_position}
              >
                <input
                  id="surety1_post_position"
                  name="surety1_post_position"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Church Address"
                htmlFor="surety1_church_address"
                required
                error={state.fieldErrors?.surety1_church_address}
              >
                <input
                  id="surety1_church_address"
                  name="surety1_church_address"
                  type="text"
                  className="input"
                  required
                />
              </Field>
            </div>

            <Field
              label="Surety 1 Passport Photograph"
              htmlFor="surety1_passport"
              required
              error={state.fieldErrors?.surety1_passport}
            >
              <input
                id="surety1_passport"
                name="surety1_passport"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-ink-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                required
              />
            </Field>
          </section>

          {/* Surety 2 */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Users className="size-4" /> Second Surety (Guarantor)
            </h2>
            <p className="text-sm text-ink-500 mb-4">
              A second guarantor to support your application.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Title"
                htmlFor="surety2_title"
                required
                error={state.fieldErrors?.surety2_title}
              >
                <input
                  id="surety2_title"
                  name="surety2_title"
                  type="text"
                  className="input"
                  placeholder="e.g. Mr, Mrs, Dr"
                  required
                />
              </Field>
              <Field
                label="Full name"
                htmlFor="surety2_full_name"
                required
                error={state.fieldErrors?.surety2_full_name}
              >
                <input
                  id="surety2_full_name"
                  name="surety2_full_name"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Family name"
                htmlFor="surety2_family"
                required
                error={state.fieldErrors?.surety2_family}
              >
                <input
                  id="surety2_family"
                  name="surety2_family"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Native of (Town)"
                htmlFor="surety2_native_of"
                required
                error={state.fieldErrors?.surety2_native_of}
              >
                <input
                  id="surety2_native_of"
                  name="surety2_native_of"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="L.G.A."
                htmlFor="surety2_lga"
                required
                error={state.fieldErrors?.surety2_lga}
              >
                <input
                  id="surety2_lga"
                  name="surety2_lga"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="State"
                htmlFor="surety2_state"
                required
                error={state.fieldErrors?.surety2_state}
              >
                <input
                  id="surety2_state"
                  name="surety2_state"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Residential Address"
                htmlFor="surety2_address"
                required
                error={state.fieldErrors?.surety2_address}
              >
                <input
                  id="surety2_address"
                  name="surety2_address"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Phone Number (1)"
                htmlFor="surety2_phone_1"
                required
                error={state.fieldErrors?.surety2_phone_1}
              >
                <input
                  id="surety2_phone_1"
                  name="surety2_phone_1"
                  type="tel"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Phone Number (2)"
                htmlFor="surety2_phone_2"
                error={state.fieldErrors?.surety2_phone_2}
              >
                <input
                  id="surety2_phone_2"
                  name="surety2_phone_2"
                  type="tel"
                  className="input"
                />
              </Field>
              <Field
                label="ID Number"
                htmlFor="surety2_id_number"
                required
                error={state.fieldErrors?.surety2_id_number}
              >
                <input
                  id="surety2_id_number"
                  name="surety2_id_number"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Sex"
                htmlFor="surety2_sex"
                required
                error={state.fieldErrors?.surety2_sex}
              >
                <select id="surety2_sex" name="surety2_sex" className="input" required>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field
                label="Date of Birth"
                htmlFor="surety2_date_of_birth"
                required
                error={state.fieldErrors?.surety2_date_of_birth}
              >
                <input
                  id="surety2_date_of_birth"
                  name="surety2_date_of_birth"
                  type="date"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Vehicle Registration No. (optional)"
                htmlFor="surety2_vehicle_reg_no"
                error={state.fieldErrors?.surety2_vehicle_reg_no}
              >
                <input
                  id="surety2_vehicle_reg_no"
                  name="surety2_vehicle_reg_no"
                  type="text"
                  className="input"
                />
              </Field>
              <Field
                label="Occupation / Post"
                htmlFor="surety2_occupation"
                required
                error={state.fieldErrors?.surety2_occupation}
              >
                <input
                  id="surety2_occupation"
                  name="surety2_occupation"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Religion"
                htmlFor="surety2_religion"
                required
                error={state.fieldErrors?.surety2_religion}
              >
                <input
                  id="surety2_religion"
                  name="surety2_religion"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Worship With"
                htmlFor="surety2_worship_with"
                required
                error={state.fieldErrors?.surety2_worship_with}
              >
                <input
                  id="surety2_worship_with"
                  name="surety2_worship_with"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Post / Position"
                htmlFor="surety2_post_position"
                required
                error={state.fieldErrors?.surety2_post_position}
              >
                <input
                  id="surety2_post_position"
                  name="surety2_post_position"
                  type="text"
                  className="input"
                  required
                />
              </Field>
              <Field
                label="Church Address"
                htmlFor="surety2_church_address"
                required
                error={state.fieldErrors?.surety2_church_address}
              >
                <input
                  id="surety2_church_address"
                  name="surety2_church_address"
                  type="text"
                  className="input"
                  required
                />
              </Field>
            </div>

            <Field
              label="Surety 2 Passport Photograph"
              htmlFor="surety2_passport"
              required
              error={state.fieldErrors?.surety2_passport}
            >
              <input
                id="surety2_passport"
                name="surety2_passport"
                type="file"
                accept="image/*"
                className="block w-full text-sm text-ink-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                required
              />
            </Field>
          </section>

          {/* Bank account details */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Mail className="size-4" /> Bank account for disbursement
            </h2>
            <p className="text-sm text-ink-500 mb-4">
              If approved, the loan will be disbursed to this account.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Bank Name"
                htmlFor="bank_name"
                error={state.fieldErrors?.bank_name}
              >
                <input
                  id="bank_name"
                  name="bank_name"
                  type="text"
                  className="input"
                  placeholder="e.g. First Bank"
                />
              </Field>
              <Field
                label="Account Name"
                htmlFor="account_name"
                error={state.fieldErrors?.account_name}
              >
                <input
                  id="account_name"
                  name="account_name"
                  type="text"
                  className="input"
                  placeholder="e.g. Akpabio Uwem"
                />
              </Field>
              <Field
                label="Account Number"
                htmlFor="account_number"
                error={state.fieldErrors?.account_number}
              >
                <input
                  id="account_number"
                  name="account_number"
                  type="text"
                  className="input"
                  placeholder="e.g. 1234567890"
                />
              </Field>
            </div>
          </section>

          {/* Terms */}
          <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-brand-800 uppercase tracking-wider mb-4">
              Terms & conditions
            </h2>
            <div className="flex gap-3 mb-4">
              <input
                id="terms_accepted"
                name="terms_accepted"
                type="checkbox"
                className="size-4 text-brand-600 mt-0.5"
                required
              />
              <label htmlFor="terms_accepted" className="text-sm text-ink-700 leading-6 cursor-pointer">
                I accept the{" "}
                <span className="font-semibold text-ink-900">Terms &amp; Conditions</span>
                and confirm that all information provided is true and correct.
              </label>
            </div>
            <p className="text-xs text-ink-400">
              Interest is fixed at 10% per month on the reducing balance.
              Applications are reviewed by an assigned loan officer who will
              contact you for a physical assessment before a decision is made.
            </p>
          </section>

          <div className="pt-6 border-t border-ink-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-500">
              All fields marked <span className="text-red-500">*</span> are
              required. Passport photographs are required for you and both
              sureties.
            </p>
            <Button
              type="submit"
              className="btn-gold"
              disabled={submitting || !!state.message}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit loan application"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
