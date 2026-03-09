// types/auth.ts

import type { AuthError } from "firebase/auth";

/**
 * Error de autenticación tipado
 * (Firebase devuelve AuthError)
 */
export type FirebaseAuthError = AuthError;