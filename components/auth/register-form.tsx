"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { registerWithEmail, loginWithGoogle } from "@/lib/auth";
import Link from "next/link";
import type { FirebaseAuthError } from "@/types/auth";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    try {
      setLoading(true);
      setError(null);

      await registerWithEmail(email, password);
      window.location.href = "/setup";
    } catch (err) {
      const error = err as FirebaseAuthError;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setLoading(true);
      setError(null);

      await loginWithGoogle();
      window.location.href = "/setup";
    } catch (err) {
      const error = err as FirebaseAuthError;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Input
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button onClick={handleRegister} disabled={loading} className="w-full">
        Registrarse
      </Button>

      <Separator />

      <Button
        variant="outline"
        onClick={handleGoogleRegister}
        disabled={loading}
        className="w-full"
      >
        Registrarse con Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
