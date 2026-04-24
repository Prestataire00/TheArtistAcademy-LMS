import { redirect } from 'next/navigation';

// La racine "/" n'a pas d'UI dediee : on redirige vers /login.
// Les apprenants entrent via /auth/sso (SSO Dendreo), les admins/formateurs
// via /login. Sans cette page, Next renverrait 404 sur la racine.
export default function RootPage() {
  redirect('/login');
}
