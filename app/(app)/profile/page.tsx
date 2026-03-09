"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase.client";
import {
  getHouseholdDoc,
  getHouseholdMembers,
  getUserDoc,
  updateHouseholdMemberRole,
  updateUserProfile,
} from "@/lib/firestore";
import type { Household } from "@/types/household";
import type { HouseholdRole, UserData } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AVATARS = ["😀", "😄", "😎", "🤓", "🤑", "🤠", "🧠", "🔥", "💸", "⚽"];
const ROLE_OPTIONS: Array<{ value: HouseholdRole; label: string }> = [
  { value: "reader", label: "Lector" },
  { value: "editor", label: "Lector y editor" },
  { value: "co_owner", label: "2do owner" },
];

function getEffectiveHouseholdRole(user: UserData, ownerId: string): HouseholdRole {
  if (user.uid === ownerId) return "owner";
  if (user.householdRole) return user.householdRole;
  if (user.role === "owner") return "co_owner";
  return "editor";
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<UserData[]>([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🙂");
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesSavingUid, setRolesSavingUid] = useState<string | null>(null);
  const [roleDraftByUid, setRoleDraftByUid] = useState<Record<string, HouseholdRole>>({});

  const [telegramCode, setTelegramCode] = useState<string | null>(null);
  const [telegramCodeLoading, setTelegramCodeLoading] = useState(false);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;

    (async () => {
      const data = (await getUserDoc(u.uid)) as UserData | null;
      if (!data) return;

      setUser(data);
      setName(data.displayName);
      setAvatar(data.avatar ?? "🙂");

      if (!data.householdId) return;

      const householdData = (await getHouseholdDoc(data.householdId)) as Household | null;
      setHousehold(householdData);

      const canManage = householdData?.ownerId === data.uid;
      if (!canManage) return;

      setRolesLoading(true);
      try {
        const householdMembers = await getHouseholdMembers(data.householdId);
        setMembers(householdMembers);

        const roleDrafts = householdMembers.reduce<Record<string, HouseholdRole>>((acc, member) => {
          acc[member.uid] = getEffectiveHouseholdRole(member, householdData.ownerId);
          return acc;
        }, {});
        setRoleDraftByUid(roleDrafts);
      } finally {
        setRolesLoading(false);
      }
    })();
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    setLoading(true);

    await updateUserProfile({
      uid: user.uid,
      displayName: name,
      avatar,
    });

    setLoading(false);
    alert("Perfil actualizado");
  };

  const generateTelegramCode = async () => {
    const current = auth.currentUser;
    if (!current) return;

    setTelegramCodeLoading(true);
    try {
      const idToken = await current.getIdToken();
      const response = await fetch("/api/telegram/link-code", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) {
        throw new Error(data.error || "No se pudo generar el código");
      }

      setTelegramCode(data.code);
    } catch (error) {
      console.error("generateTelegramCode error:", error);
      alert("No se pudo generar el código de Telegram.");
    } finally {
      setTelegramCodeLoading(false);
    }
  };

  const saveMemberRole = async (memberUid: string) => {
    if (!user?.householdId || !household?.ownerId) return;
    if (household.ownerId !== user.uid) return;
    if (memberUid === household.ownerId) return;

    const nextRole = roleDraftByUid[memberUid];
    if (!nextRole) return;

    setRolesSavingUid(memberUid);
    try {
      await updateHouseholdMemberRole({
        householdId: user.householdId,
        targetUid: memberUid,
        householdRole: nextRole,
      });

      setMembers((prev) =>
        prev.map((member) =>
          member.uid === memberUid
            ? {
                ...member,
                householdRole: nextRole,
                role: nextRole === "co_owner" ? "owner" : "member",
              }
            : member,
        ),
      );
    } catch (error) {
      console.error("saveMemberRole error:", error);
      alert("No se pudo actualizar el rol del miembro.");
    } finally {
      setRolesSavingUid(null);
    }
  };

  if (!user) return null;

  const canManageRoles = Boolean(household && household.ownerId === user.uid);
  const ownerId = household?.ownerId ?? "";

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nombre visible</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Avatar</label>

          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border text-lg ${
                  avatar === a ? "border-primary" : "border-muted"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={saveProfile} disabled={loading}>
          Guardar cambios
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="font-semibold">Telegram</h2>
        <p className="text-sm text-muted-foreground">
          Generá un código y luego enviá en Telegram: <code>/vincular CODIGO</code>
        </p>
        <p className="text-xs text-muted-foreground">
          El código vence en 15 minutos y es de un solo uso. El chat queda vinculado
          hasta que decidas rotar el código o desvincular. Si generás un nuevo código,
          tendrás que volver a vincular el chat.
        </p>

        <div className="flex items-center gap-2">
          <Button onClick={generateTelegramCode} disabled={telegramCodeLoading}>
            {telegramCodeLoading ? "Generando..." : "Generar código"}
          </Button>

          {telegramCode && (
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(telegramCode)}
            >
              Copiar código
            </Button>
          )}
        </div>

      {telegramCode && (
          <p className="text-sm">
            Código actual: <span className="font-mono font-semibold">{telegramCode}</span>
          </p>
        )}
      </Card>

      {canManageRoles && (
        <Card className="space-y-4 p-4">
          <div>
            <h2 className="font-semibold">Roles del household</h2>
            <p className="text-sm text-muted-foreground">
              Como owner principal podés definir el rol de cada participante.
            </p>
          </div>

          {rolesLoading ? (
            <p className="text-sm text-muted-foreground">Cargando miembros...</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const effectiveRole = getEffectiveHouseholdRole(member, ownerId);
                const isMainOwner = member.uid === ownerId;

                return (
                  <div
                    key={member.uid}
                    className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{member.displayName || member.email}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>

                    {isMainOwner ? (
                      <div className="text-sm font-medium">Owner principal</div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Select
                          value={roleDraftByUid[member.uid] ?? effectiveRole}
                          onValueChange={(value) =>
                            setRoleDraftByUid((prev) => ({
                              ...prev,
                              [member.uid]: value as HouseholdRole,
                            }))
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Seleccionar rol" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          onClick={() => saveMemberRole(member.uid)}
                          disabled={rolesSavingUid === member.uid}
                        >
                          {rolesSavingUid === member.uid ? "Guardando..." : "Guardar"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
