"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { auth } from "@/lib/firebase.client";
import { subscribeToUser } from "@/lib/firestore";
import type { UserData } from "@/types/user";
import { User, Wallet, CreditCard, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

function roleLabel(role?: string, householdRole?: string) {
  if (householdRole === "owner") return "Owner";
  if (householdRole === "co_owner") return "2do owner";
  if (householdRole === "editor") return "Editor";
  if (householdRole === "reader") return "Lector";
  return role === "owner" ? "Owner" : "Member";
}

const personalMenu = [
  { href: "/expenses", label: "Gastos", icon: CreditCard },
  { href: "/incomes", label: "Ingresos", icon: Wallet },
  { href: "/profile", label: "Perfil", icon: User },
];

const groupMenu = [{ href: "/analytics", label: "Análisis", icon: BarChart3 }];

export function AppSidebar() {
  const [user, setUser] = useState<UserData | null>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout error:", error);
      alert("No se pudo cerrar sesión.");
    }
  };

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      const unsubUser = subscribeToUser(firebaseUser.uid, (data) => {
        setUser(data);
      });

      return () => unsubUser();
    });

    return () => unsubAuth();
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
            {user?.avatar ?? user?.displayName?.[0]?.toUpperCase() ?? "🙂"}
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium">{user?.displayName}</span>
            <span className="text-xs text-muted-foreground">
              {roleLabel(user?.role, user?.householdRole)}
            </span>
            <Button
              variant="ghost"
              className="mt-1 h-7 justify-start px-0 text-xs"
              onClick={handleLogout}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Personal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personalMenu.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Grupal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groupMenu.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Household finance
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
