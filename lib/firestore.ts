import { db } from "@/lib/firebase.client";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  addDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";

import type {
  Expense,
  ExpenseMainCategory,
  ExpenseSubCategory,
} from "@/types/expense";
import type {
  Income,
  IncomeCategory,
  IncomeSubCategory,
} from "@/types/income";
import type { HouseholdRole, UserData } from "@/types/user";

// ---------- USERS ----------

export async function getUserDoc(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function ensureUserDoc(params: {
  uid: string;
  email: string;
  displayName: string;
}) {
  const ref = doc(db, "users", params.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      avatar: "🙂",
      householdId: null,
      role: "member",
      createdAt: serverTimestamp(),
    });
  }
}

export async function updateUserProfile(params: {
  uid: string;
  displayName: string;
  avatar: string;
}) {
  await setDoc(
    doc(db, "users", params.uid),
    {
      displayName: params.displayName,
      avatar: params.avatar,
    },
    { merge: true }
  );
}

/**
 * 🔥 Realtime subscription al user doc
 * (sidebar, avatar, nombre)
 */
export function subscribeToUser(
  uid: string,
  callback: (user: UserData | null) => void
) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data() as UserData);
  });
}

// ---------- HOUSEHOLDS ----------

export function generateInviteCode(len = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function createHousehold(params: {
  name: string;
  type: "personal" | "group";
  ownerId: string;
}) {
  const inviteCode = generateInviteCode();

  const ref = await addDoc(collection(db, "households"), {
    name: params.name,
    type: params.type,
    ownerId: params.ownerId,
    inviteCode,
    memberUids: [params.ownerId],
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "invites", inviteCode), {
    householdId: ref.id,
    createdAt: serverTimestamp(),
  });

  return { householdId: ref.id, inviteCode };
}

export async function getHouseholdDoc(householdId: string) {
  const ref = doc(db, "households", householdId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// ---------- EXPENSES ----------

export async function addExpense(params: {
  householdId: string;
  user: { uid: string; displayName: string };
  category: ExpenseMainCategory;
  subCategory: ExpenseSubCategory;
  description: string;
  amount: number;
  isFixed: boolean;
  date: string;
}) {
  const ref = collection(db, "households", params.householdId, "expenses");

  await addDoc(ref, {
    householdId: params.householdId,
    createdByUid: params.user.uid,
    createdByName: params.user.displayName,
    category: params.category,
    subCategory: params.subCategory,
    description: params.description,
    amount: params.amount,
    isFixed: params.isFixed,
    date: params.date,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export function subscribeToExpenses(
  householdId: string,
  callback: (expenses: Expense[]) => void
) {
  const ref = collection(db, "households", householdId, "expenses");
  return onSnapshot(ref, (snapshot) => {
    const list: Expense[] = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Expense, "id">),
      }))
      .sort((a, b) => {
        const aCreatedAt = a.createdAt ?? 0;
        const bCreatedAt = b.createdAt ?? 0;
        if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt;

        const aDate = a.date ?? "";
        const bDate = b.date ?? "";
        if (aDate !== bDate) return aDate < bDate ? 1 : -1;

        return 0;
      });

    callback(list);
  });
}

export async function deleteExpense(params: {
  householdId: string;
  expenseId: string;
}) {
  await deleteDoc(
    doc(db, "households", params.householdId, "expenses", params.expenseId)
  );
}

export async function updateExpense(params: {
  householdId: string;
  expenseId: string;
  data: Partial<{
    category: ExpenseMainCategory;
    subCategory: ExpenseSubCategory;
    description: string;
    amount: number;
    isFixed: boolean;
    date: string;
  }>;
}) {
  await updateDoc(
    doc(db, "households", params.householdId, "expenses", params.expenseId),
    params.data
  );
}

// ---------- INCOMES ----------

export async function addIncome(params: {
  householdId: string;
  user: { uid: string; displayName: string };
  category: IncomeCategory;
  subCategory: IncomeSubCategory;
  description: string;
  amount: number;
  date: string;
}) {
  const ref = collection(db, "households", params.householdId, "incomes");

  await addDoc(ref, {
    householdId: params.householdId,
    createdByUid: params.user.uid,
    createdByName: params.user.displayName,
    category: params.category,
    subCategory: params.subCategory,
    description: params.description,
    amount: params.amount,
    date: params.date,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}

export function subscribeToIncomes(
  householdId: string,
  callback: (incomes: Income[]) => void
) {
  const ref = collection(db, "households", householdId, "incomes");
  return onSnapshot(ref, (snapshot) => {
    const list: Income[] = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Income, "id">),
      }))
      .sort((a, b) => {
        const aCreatedAt = (a as Income & { createdAt?: number }).createdAt ?? 0;
        const bCreatedAt = (b as Income & { createdAt?: number }).createdAt ?? 0;
        if (aCreatedAt !== bCreatedAt) return bCreatedAt - aCreatedAt;

        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return 0;
      });

    callback(list);
  });
}

export async function deleteIncome(params: {
  householdId: string;
  incomeId: string;
}) {
  await deleteDoc(
    doc(db, "households", params.householdId, "incomes", params.incomeId)
  );
}

export async function updateIncome(params: {
  householdId: string;
  incomeId: string;
  data: Partial<{
    category: IncomeCategory;
    subCategory: IncomeSubCategory;
    description: string;
    amount: number;
    date: string;
  }>;
}) {
  await updateDoc(
    doc(db, "households", params.householdId, "incomes", params.incomeId),
    params.data
  );
}

// ---------- LINKING ----------

export async function linkOwnerToHousehold(params: {
  uid: string;
  householdId: string;
  role?: "owner" | "member";
}) {
  const householdRole: HouseholdRole = "owner";
  const legacyRole = "owner";

  await setDoc(
    doc(db, "users", params.uid),
    {
      householdId: params.householdId,
      role: params.role ?? legacyRole,
      householdRole,
    },
    { merge: true }
  );

  await updateDoc(doc(db, "households", params.householdId), {
    memberUids: arrayUnion(params.uid),
  });
}

export async function linkMemberToHousehold(params: {
  uid: string;
  householdId: string;
}) {
  const householdRole: HouseholdRole = "editor";
  const legacyRole = "member";

  await updateDoc(doc(db, "households", params.householdId), {
    memberUids: arrayUnion(params.uid),
  });

  await setDoc(
    doc(db, "users", params.uid),
    {
      householdId: params.householdId,
      role: legacyRole,
      householdRole,
    },
    { merge: true }
  );
}

// ---------- INVITE CODE ----------

export async function findHouseholdByInviteCode(inviteCode: string) {
  const inviteRef = doc(db, "invites", inviteCode);
  const snap = await getDoc(inviteRef);

  if (!snap.exists()) return null;

  const data = snap.data() as { householdId: string };
  return { householdId: data.householdId };
}

export async function getHouseholdMembers(householdId: string) {
  const householdSnap = await getDoc(doc(db, "households", householdId));
  if (!householdSnap.exists()) return [];

  const data = householdSnap.data() as { memberUids?: string[] };
  const memberUids = data.memberUids ?? [];

  const members = await Promise.all(
    memberUids.map(async (uid) => {
      const userSnap = await getDoc(doc(db, "users", uid));
      return userSnap.exists() ? (userSnap.data() as UserData) : null;
    })
  );

  return members
    .filter((m): m is UserData => Boolean(m))
    .sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
}

export async function updateHouseholdMemberRole(params: {
  householdId: string;
  targetUid: string;
  householdRole: HouseholdRole;
}) {
  const householdSnap = await getDoc(doc(db, "households", params.householdId));
  if (!householdSnap.exists()) {
    throw new Error("Household no encontrado.");
  }

  const household = householdSnap.data() as { memberUids?: string[] };
  if (!(household.memberUids ?? []).includes(params.targetUid)) {
    throw new Error("El usuario no pertenece al household.");
  }

  const legacyRole =
    params.householdRole === "owner" || params.householdRole === "co_owner"
      ? "owner"
      : "member";

  await setDoc(
    doc(db, "users", params.targetUid),
    {
      role: legacyRole,
      householdRole: params.householdRole,
    },
    { merge: true }
  );
}
