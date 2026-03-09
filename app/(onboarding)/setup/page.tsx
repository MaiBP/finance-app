"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  createHousehold,
  findHouseholdByInviteCode,
  getUserDoc,
  linkOwnerToHousehold,
  linkMemberToHousehold,
  ensureUserDoc, 
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function SetupPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState("Mis finanzas");
  const [inviteCode, setInviteCode] = useState("");
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/login";
        return;
      }

    
      await ensureUserDoc({
        uid: user.uid,
        email: user.email ?? "",
        displayName: user.displayName ?? user.email ?? "User",
      });

      setUid(user.uid);

      const data = await getUserDoc(user.uid);
      if (data?.householdId) {
        window.location.href = "/dashboard";
      }
    });

    return () => unsub();
  }, []);

  const createPersonal = async () => {
    if (!uid) return;
    setInfo("Creando finanzas personales...");

    const { householdId } = await createHousehold({
      name: "Mis finanzas",
      type: "personal",
      ownerId: uid,
    });

    await linkOwnerToHousehold({ uid, householdId });
    window.location.href = "/dashboard";
  };

  const createGroup = async () => {
    if (!uid) return;
    setInfo("Creando household grupal...");

    const { householdId } = await createHousehold({
      name: householdName || "Household",
      type: "group",
      ownerId: uid,
    });

    await linkOwnerToHousehold({ uid, householdId });
    window.location.href = "/dashboard";
  };

  const joinByCode = async () => {
    if (!uid) return;
    setInfo("Buscando household...");

    const found = await findHouseholdByInviteCode(
      inviteCode.trim().toUpperCase(),
    );

    if (!found) {
      setInfo("❌ No se encontró household con ese código.");
      return;
    }

    await linkMemberToHousehold({
      uid,
      householdId: found.householdId,
    });

    window.location.href = "/dashboard";
  };

  return (
    <div className="mx-auto max-w-xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configurar tu espacio</h1>

      <div className="grid gap-4">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">👤 Finanzas personales</h2>
          <Button onClick={createPersonal} className="w-full">
            Crear finanzas personales
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">👥 Finanzas grupales</h2>
          <Input
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="Nombre del household"
          />
          <Button onClick={createGroup} className="w-full">
            Crear household grupal
          </Button>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">🔑 Unirse con código</h2>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Código de invitación"
          />
          <Button variant="outline" onClick={joinByCode} className="w-full">
            Unirme
          </Button>
        </Card>
      </div>

      {info && <p className="text-sm">{info}</p>}
    </div>
  );
}
