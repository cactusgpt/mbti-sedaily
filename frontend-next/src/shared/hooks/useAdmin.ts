import { useAuth } from '@/features/auth';

const ADMIN_EMAIL = 'ai@sedaily.com';

export function useAdmin() {
  const { user, isAuthenticated } = useAuth();

  const isAdmin = isAuthenticated && user?.email === ADMIN_EMAIL;

  return {
    isAdmin,
    adminEmail: ADMIN_EMAIL,
  };
}
