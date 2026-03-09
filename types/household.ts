// types/household.ts

export type HouseholdType = "personal" | "group";

export type Household = {
  name: string;
  type: HouseholdType;
  ownerId: string;
  inviteCode: string;
  memberUids: string[];
};