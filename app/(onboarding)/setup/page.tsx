"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase.client";
import {
  createHousehold,
  ensureUserDoc,
  findHouseholdByInviteCode,
  getUserDoc,
  linkMemberToHousehold,
  linkOwnerToHousehold,
} from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

    try {
      const { householdId } = await createHousehold({
        name: "Mis finanzas",
        type: "personal",
        ownerId: uid,
      });

      await linkOwnerToHousehold({ uid, householdId });
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("createPersonal error:", error);
      setInfo("No se pudo crear el espacio personal. Revisa reglas/permisos.");
    }
  };

  const createGroup = async () => {
    if (!uid) return;
    setInfo("Creando household grupal...");

    try {
      const { householdId } = await createHousehold({
        name: householdName || "Household",
        type: "group",
        ownerId: uid,
      });

      await linkOwnerToHousehold({ uid, householdId });
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("createGroup error:", error);
      setInfo("No se pudo crear el household grupal. Revisa reglas/permisos.");
    }
  };

  const joinByCode = async () => {
    if (!uid) return;
    setInfo("Buscando household...");

    try {
      const found = await findHouseholdByInviteCode(inviteCode.trim().toUpperCase());

      if (!found) {
        setInfo("No se encontro household con ese codigo.");
        return;
      }

      await linkMemberToHousehold({
        uid,
        householdId: found.householdId,
      });

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("joinByCode error:", error);
      setInfo("No se pudo unir al household. Revisa reglas/permisos.");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Configurar tu espacio</h1>

      <div className="grid gap-4">
        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Finanzas personales</h2>
          <Button onClick={createPersonal} className="w-full">
            Crear finanzas personales
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Finanzas grupales</h2>
          <Input
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="Nombre del household"
          />
          <Button onClick={createGroup} className="w-full">
            Crear household grupal
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <h2 className="font-semibold">Unirse con codigo</h2>
          <Input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Codigo de invitacion"
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
