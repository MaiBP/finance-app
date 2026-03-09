"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ReactNode } from "react";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-2xl font-semibold text-center">{title}</h1>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
