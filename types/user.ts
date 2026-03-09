export type UserRole = "owner" | "member";
export type HouseholdRole = "owner" | "co_owner" | "editor" | "reader";

export interface UserData {
  uid: string;
  email: string;
  displayName: string;
  avatar?: string; // 👈 nuevo
  householdId: string | null;
  role: UserRole;
  householdRole?: HouseholdRole;
}
