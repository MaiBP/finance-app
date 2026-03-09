import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase.admin";
import { generateLinkCode } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing Authorization Bearer token" },
        { status: 401 },
      );
    }

    const idToken = authHeader.slice("Bearer ".length);
    const decoded = await adminAuth.verifyIdToken(idToken);

    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userSnap.data() as {
      uid: string;
      householdId?: string | null;
      displayName?: string;
    };

    if (!user.householdId) {
      return NextResponse.json(
        { error: "User has no household configured" },
        { status: 400 },
      );
    }

    const code = generateLinkCode(6);
    const now = Date.now();
    const expiresAt = now + 15 * 60 * 1000;

    // Rotate manually: invalidate any previous pending codes for this user.
    const previousCodesSnap = await adminDb
      .collection("telegram_link_codes")
      .where("uid", "==", decoded.uid)
      .where("usedAt", "==", null)
      .get();

    if (!previousCodesSnap.empty) {
      const batch = adminDb.batch();
      previousCodesSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          usedAt: now,
          usedAtServer: now,
        });
      });
      await batch.commit();
    }

    // Force re-link: remove active Telegram chat links for this user.
    const activeLinksSnap = await adminDb
      .collection("telegram_links")
      .where("uid", "==", decoded.uid)
      .get();

    if (!activeLinksSnap.empty) {
      const batch = adminDb.batch();
      activeLinksSnap.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }

    await adminDb.collection("telegram_link_codes").doc(code).set({
      code,
      uid: decoded.uid,
      householdId: user.householdId,
      displayName: user.displayName ?? decoded.name ?? "User",
      createdAt: now,
      expiresAt,
      usedAt: null,
      createdAtServer: now,
    });

    return NextResponse.json({ code, expiresAt });
  } catch (error) {
    console.error("telegram/link-code POST error:", error);
    return NextResponse.json(
      { error: "Could not create Telegram link code" },
      { status: 500 },
    );
  }
}
