import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-3xl font-bold">Mis Finanzas App</h1>

        <p className="text-muted-foreground">
          Gestioná tus ingresos, gastos y ahorros de forma simple, personal o
          compartida.
        </p>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">Iniciar sesión</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Registrarse</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
