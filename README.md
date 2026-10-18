# ManuVault

Ton cloud privé pour ranger et retrouver tes exercices et tes cours de La Manu.
Un seul utilisateur (toi), des fichiers réellement stockés en ligne, 0 € par mois.

- **Code** : GitHub
- **Site** : Vercel (sous-domaine gratuit `xxx.vercel.app`)
- **Connexion, fichiers et métadonnées** : Supabase (Auth, Storage, Database)
- **Interface** : Next.js, Tailwind CSS, icônes Lucide, police Inter

Les fichiers ne sont jamais dans GitHub, ni dans `localStorage`, ni sur le disque de Vercel.
Ils sont dans un bucket Supabase **privé** et ne s'ouvrent que par des liens temporaires (60 s à 15 min).

---

## Ce que fait l'application

Dossiers et sous-dossiers, import par bouton ou glisser-déposer (fichiers **et** dossiers entiers), téléchargement,
renommer, déplacer, supprimer avec confirmation, recherche par nom, tri par nom / date / taille, récents,
aperçu des images, PDF et fichiers texte, grille ou liste, sélection multiple, export ZIP,
export des métadonnées, **vraie corbeille** (restauration possible) et indicateur de stockage.

Volontairement absent : favoris, notes, tâches, calendrier, statistiques, partage, plusieurs utilisateurs.

---

## Limites gratuites (vérifiées en octobre 2026)

| Service | Limite | Conséquence pour toi |
| --- | --- | --- |
| Supabase gratuit | **1 Go** de stockage de fichiers | L'application refuse un import qui dépasserait 1 Go et l'indique. |
| Supabase gratuit | **50 Mo** par fichier | Au-delà, l'import est refusé avec un message clair. Les gros projets restent sur GitHub. |
| Supabase gratuit | **5 Go** de trafic sortant par mois | Chaque téléchargement ou aperçu compte. Largement suffisant pour des cours. |
| Supabase gratuit | Base de données de 500 Mo | Des milliers de fichiers tiennent sans problème (on ne stocke que les noms et tailles). |
| Supabase gratuit | **Projet mis en pause après 1 semaine sans activité** | Voir « Projet en pause » plus bas. |
| Vercel Hobby | Quotas de trafic et d'exécution du plan gratuit | Les fichiers passent directement par Supabase, Vercel ne sert que l'interface. Les quotas exacts sont sur la page de [limites Vercel](https://vercel.com/docs/limits). L'offre Hobby est prévue pour un usage personnel non commercial. |
| GitHub | Dépôt privé gratuit | Rien à payer. |

Le stockage n'est **pas** illimité. Si tu approches de 1 Go, la barre dans le menu de gauche passe à l'orange puis au rouge.
La corbeille compte dans l'espace utilisé tant que tu ne la vides pas.

Sources : [tarifs Supabase](https://supabase.com/pricing), [limites Vercel](https://vercel.com/docs/limits).
Ces chiffres peuvent changer : revérifie-les de temps en temps.

---

## Installation pas à pas

Tu auras besoin de [Node.js](https://nodejs.org) 20 ou plus, et de comptes gratuits GitHub, Supabase et Vercel.

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), connecte-toi, clique sur **New project**.
2. Choisis un nom (ex. `manuvault`), un mot de passe de base de données (garde-le dans ton gestionnaire de mots de passe), une région proche (ex. Paris ou Francfort) et le plan **Free**.
3. Attends quelques minutes que le projet soit prêt.

### 2. Exécuter le script SQL

1. Ouvre le fichier `supabase/schema.sql` de ce projet.
2. **Remplace `toi@exemple.com` par ton adresse e-mail** (une seule ligne, repérée par le commentaire `À MODIFIER`).
3. Dans Supabase, ouvre **SQL Editor** (menu de gauche) puis **New query**.
4. Colle tout le contenu du fichier, clique sur **Run**. Tu dois voir « Success ».

Ce script crée la table des fichiers, le bucket privé `vault` et les règles de sécurité (RLS) qui n'autorisent que ton adresse e-mail.
Tu peux le relancer sans rien perdre.

### 3. Créer ton compte et fermer les inscriptions

1. **Authentication > Users > Add user > Create new user** : ton e-mail (la même que dans le SQL), un mot de passe solide, et coche **Auto Confirm User**.
2. **Authentication**, dans les réglages de connexion (« Sign In / Providers » selon la version du tableau de bord) : **désactive « Allow new users to sign up »**.
   Personne d'autre ne pourra alors créer de compte.

### 4. Récupérer les clés

Dans Supabase, **Project Settings > API** (ou « API Keys ») :

- **Project URL** (ex. `https://abcd1234.supabase.co`)
- la clé **anon** (ou « publishable »). Cette clé est publique par conception : la sécurité vient des règles RLS.

> N'utilise **jamais** la clé `service_role` : ce projet n'en a pas besoin, et elle donnerait un accès total à quiconque la voit.

### 5. Lancer en local

```bash
npm install
cp .env.example .env.local     # sous Windows : copy .env.example .env.local
```

Ouvre `.env.local` et remplis :

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # clé anon / publishable
ALLOWED_EMAIL=...                   # ton e-mail, identique à celui du SQL
```

Puis :

```bash
npm run dev
```

Ouvre <http://localhost:3000>, connecte-toi, importe un fichier, recharge la page : il doit toujours être là.

### 6. Mettre le code sur GitHub

```bash
git init
git add .
git commit -m "ManuVault"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/manuvault.git
git push -u origin main
```

Crée le dépôt en **privé** sur GitHub avant. Le fichier `.env.local` est ignoré par Git : tes clés ne partent pas sur GitHub.

### 7. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), **Add New > Project**, importe ton dépôt GitHub (plan **Hobby**).
2. Avant de cliquer sur **Deploy**, ouvre **Environment Variables** et ajoute les trois mêmes variables que dans `.env.local` :
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`.
3. Clique sur **Deploy**. Ton site est disponible sur `https://ton-projet.vercel.app`.

Ne branche aucun domaine personnalisé payant : le sous-domaine Vercel suffit.

---

## Comment c'est protégé

Trois verrous indépendants, pour ne pas dépendre d'un seul :

1. **Middleware du serveur** : toute page privée exige une session valide **et** ton adresse e-mail (`ALLOWED_EMAIL`). Sinon redirection vers la connexion.
2. **Règles RLS** de la base : seule ton adresse e-mail peut lire, écrire, modifier ou supprimer. Le rôle « visiteur » n'a aucun droit.
3. **Règles du bucket** `vault` : privé, mêmes conditions pour chaque lecture, envoi et suppression. Aucun lien permanent : les téléchargements et aperçus passent par des liens signés temporaires.

Même si quelqu'un devinait l'adresse du site ou la clé publique, il ne pourrait rien lire sans être connecté avec ton e-mail.
Aucune clé secrète n'est dans le code ni sur GitHub.

---

## Sauvegarde et restauration

**Il n'y a pas de sauvegarde automatique.** Supabase gratuit ne sauvegarde pas tes fichiers pour toi : c'est à toi de le faire.

### Sauvegarder (à faire de temps en temps)

1. Dans le menu de gauche, clique sur **Sauvegarde**.
2. **Créer la sauvegarde** télécharge un ZIP avec tous tes fichiers et ton arborescence, plus `_manuvault-metadonnees.json`.
3. **Exporter en JSON** télécharge uniquement la liste des noms, chemins, tailles et dates.
4. Range le ZIP ailleurs que sur ce seul ordinateur (disque externe, autre cloud).

Pour exporter seulement certains éléments : coche-les, puis **ZIP** dans la barre qui apparaît en bas.

Limite : le navigateur assemble l'archive en mémoire, donc **400 Mo maximum par ZIP**. Au-delà, l'application te le dit :
sauvegarde en plusieurs fois, en sélectionnant quelques dossiers à la fois.

### Restaurer

- **Quelques fichiers perdus** : dans la **Corbeille**, restaure-les. Si tu as vidé la corbeille, décompresse ton ZIP et réimporte-les.
- **Tout est à refaire** (nouveau projet Supabase, par exemple) :
  1. Refais les étapes 1 à 4 (projet, script SQL, compte, clés) et mets les nouvelles clés dans `.env.local` et dans Vercel.
  2. Décompresse ton ZIP de sauvegarde.
  3. Dans ManuVault : **Nouveau > Importer un dossier**, pour chaque dossier décompressé, et **Importer des fichiers** pour ceux qui étaient à la racine.
     L'arborescence est recréée.
  
  Le fichier JSON de métadonnées sert de référence (qui était où, quand). Il n'est pas réimporté automatiquement.

---

## Projet en pause

Un projet Supabase gratuit est **mis en pause après une semaine sans activité**. Dans ce cas ManuVault affiche
« Impossible de charger tes fichiers ». Tes données ne sont pas perdues : ouvre le tableau de bord Supabase
et clique sur **Restore / Unpause** sur ton projet. Ouvrir ManuVault au moins une fois par semaine évite le problème.

---

## Commandes utiles

```bash
npm run dev        # lancer en local
npm run lint       # vérifier le code
npm run typecheck  # vérifier les types TypeScript
npm run build      # construire la version de production
```

## Structure

```
supabase/schema.sql         script SQL à exécuter dans Supabase
src/middleware.ts           garde d'entrée (session + e-mail autorisé)
src/lib/                    outils (formats, arbre de dossiers, clients Supabase)
src/components/providers/   données et actions (import, ZIP, corbeille), notifications, état de l'interface
src/components/files/       cartes, liste, fenêtres, aperçu
src/components/shell/       barre latérale, en-tête, panneau d'activité
src/app/                    pages (connexion, accueil, fichiers, récents, corbeille)
```

## Dépannage

| Message | Cause probable |
| --- | --- |
| « Accès refusé… » | L'e-mail du SQL ne correspond pas à celui de ton compte. Corrige la ligne dans `schema.sql` et relance-le. |
| « Cette adresse n'est pas autorisée » | `ALLOWED_EMAIL` ne correspond pas à ton e-mail (localement ou dans Vercel). |
| « E-mail ou mot de passe incorrect » | Vérifie le compte dans **Authentication > Users** (et la case Auto Confirm). |
| Import refusé « Stockage plein » | Vide la corbeille ou supprime des fichiers (1 Go maximum). |
| Import refusé « dépasse la limite » | Fichier de plus de 50 Mo : garde-le sur GitHub ou compresse-le. |
