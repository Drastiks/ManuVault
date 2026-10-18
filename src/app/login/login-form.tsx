"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function readable(message: string): string {
  if (/invalid login credentials/i.test(message)) return "E-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message))
    return "Cette adresse n'est pas confirmée. Dans Supabase, ouvre Authentication > Users et confirme l'utilisateur.";
  if (/failed to fetch|network/i.test(message))
    return "Connexion impossible. Vérifie ta connexion internet.";
  if (/rate limit|too many/i.test(message)) return "Trop de tentatives. Patiente une minute puis réessaie.";
  return message;
}

export function LoginForm({ denied }: { denied: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    denied ? "Cette adresse n'est pas autorisée à accéder à ManuVault." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError("Renseigne ton e-mail et ton mot de passe.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(readable(authError.message));
        setLoading(false);
        return;
      }
      // Rechargement complet : le serveur relit la session et vérifie l'e-mail autorisé.
      window.location.assign("/");
    } catch (err) {
      setError(readable(err instanceof Error ? err.message : "Erreur inconnue."));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="flex animate-fade items-start gap-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-[13px] leading-snug text-rose-200"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="email" className="field-label">
          Adresse e-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field"
          placeholder="toi@exemple.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="icon-btn absolute right-1 top-1"
            aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Connexion…
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden />
            Se connecter
          </>
        )}
      </button>
    </form>
  );
}
