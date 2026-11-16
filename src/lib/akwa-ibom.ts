export const AKWA_IBOM_STATE = "Akwa Ibom" as const;

/**
 * All 31 official Local Government Areas (and major urban hubs) of Akwa Ibom State.
 * Every vendor on Ibom Vendors Hub operates within Akwa Ibom State.
 */
export const AKWA_IBOM_LGAS = [
  "Uyo",
  "Eket",
  "Ikot Ekpene",
  "Oron",
  "Abak",
  "Eastern Obolo",
  "Esit Eket",
  "Essien Udim",
  "Etim Ekpo",
  "Etinan",
  "Ibeno",
  "Ibesikpo Asutan",
  "Ibiono Ibom",
  "Ika",
  "Ikono",
  "Ikot Abasi",
  "Ini",
  "Itu",
  "Mbo",
  "Mkpat Enin",
  "Nsit Atai",
  "Nsit Ibom",
  "Nsit Ubium",
  "Obot Akara",
  "Okobo",
  "Onna",
  "Oruk Anam",
  "Udung-Uko",
  "Ukanafun",
  "Uruan",
  "Urue-Offong/Oruko",
] as const;

export const PROOF_OF_RESIDENCE_TYPES = [
  { value: "utility_bill", label: "Utility bill (PHED electricity / water bill)" },
  { value: "tenancy_agreement", label: "Tenancy agreement / rent receipt" },
  { value: "bank_statement", label: "Bank statement with Akwa Ibom address" },
  { value: "community_letter", label: "Local government / traditional council attestation" },
] as const;

export type ProofOfResidenceType = (typeof PROOF_OF_RESIDENCE_TYPES)[number]["value"];

export function isAkwaIbomState(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "akwa ibom" || normalized === "akwa ibom state";
}

export function proofOfResidenceLabel(type: string | null | undefined): string {
  return PROOF_OF_RESIDENCE_TYPES.find((item) => item.value === type)?.label ?? "Proof of residence";
}
