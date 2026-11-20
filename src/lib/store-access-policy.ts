/** Trials and subscription billing stay paused until the owner explicitly resumes them.
 * Database access helpers are changed in migration 0024; resuming requires a matching migration.
 */
export const FREE_STORE_ACCESS = true;
export const FREE_STORE_MESSAGE = "Registering and owning a store on Ibomvendorshub is absolutely free. No trial countdown or subscription payment is required.";
