/** Vérifie que l'adresse e-mail est celle du propriétaire (variable serveur ALLOWED_EMAIL). */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!allowed || !email) return false;
  return email.trim().toLowerCase() === allowed;
}
