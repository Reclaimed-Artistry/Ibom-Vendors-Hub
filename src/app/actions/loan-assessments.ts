"use server";

import { getCurrentUser } from "@/lib/auth";
import { systemDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface AssessmentState {
  error?: string;
  message?: string;
}

/**
 * Records a loan officer's assessment decision on a loan application.
 *
 * Expects FormData fields:
 *   - application_id  (hidden)
 *   - decision        ("approve" | "reject")
 *   - assessment_notes (textarea)
 *   - physical_visit_date (date, optional)
 */
export async function submitLoanAssessmentAction(
  _prev: AssessmentState,
  form: FormData,
): Promise<AssessmentState> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please sign in before assessing a loan." };
  }
  if (user.role !== "super_admin" && user.role !== "admin") {
    return { error: "Not authorised to assess loans." };
  }

  const applicationId = String(form.get("application_id") ?? "").trim();
  const decision = String(form.get("decision") ?? "").trim();
  const assessmentNotes = String(form.get("assessment_notes") ?? "").trim();
  const physicalVisitDate =
    String(form.get("physical_visit_date") ?? "").trim() || null;

  if (!applicationId) {
    return { error: "Missing loan application." };
  }
  if (decision !== "approve" && decision !== "reject") {
    return { error: "Select Approve or Reject before submitting." };
  }

  const updated = await systemDb.maybeOne<{ id: string }>(
    `update loan_applications
      set assessment_status = 'completed',
          agent_decision = $1,
          agent_decision_notes = $2,
          physical_visit_date = $3,
          assessed_at = now(),
          assessed_by = $4,
          updated_at = now()
      where id = $5
      returning id`,
    [decision, assessmentNotes, physicalVisitDate, user.id, applicationId],
  );

  if (!updated) {
    return { error: "Loan application not found." };
  }

  revalidatePath(`/admin/loan-assessments/${applicationId}`);
  revalidatePath("/admin/loan-assessments");
  return {
    message: `Application ${decision}d successfully. The applicant will be notified.`,
  };
}
