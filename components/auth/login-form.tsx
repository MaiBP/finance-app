"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth";
import Link from "next/link";
import type { FirebaseAuthError } from "@/types/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      await loginWithEmail(email, password);
      window.location.href = "/dashboard";
    } catch (err) {
      const error = err as FirebaseAuthError;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      await loginWithGoogle();
      window.location.href = "/dashboard";
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

      <Button onClick={handleEmailLogin} disabled={loading} className="w-full">
        Iniciar sesión
      </Button>

      <Separator />

      <Button
        variant="outline"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full"
      >
        Continuar con Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{" "}
        <Link href="/register" className="underline">
          Registrarse
        </Link>
      </p>
    </>
  );
}
