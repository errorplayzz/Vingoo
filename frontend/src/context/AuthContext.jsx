/**
 * context/AuthContext.jsx — Firebase-backed auth context
 *
 * A user is "fully authenticated" when:
 *   Firebase user exists AND user.emailVerified === true
 * (Google sign-in automatically sets emailVerified = true)
 */
import {
  createContext, useContext, useState,
  useCallback, useMemo, useEffect,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth }               from '../lib/firebase';
import { logout as firebaseLogout } from '../auth/authService';
import { setToken, clearToken }     from '../auth/tokenStore';

function buildUser(fbUser) {
  if (!fbUser) return null;
  return {
    uid:           fbUser.uid,
    email:         fbUser.email        ?? '',
    displayName:   fbUser.displayName  ?? fbUser.email ?? 'User',
    photoURL:      fbUser.photoURL     ?? null,
    emailVerified: fbUser.emailVerified,
    role:          'analyst',
  };
}

const _AuthStateContext   = createContext(null);
const _AuthActionsContext = createContext(null);

export function useAuthState() {
  const ctx = useContext(_AuthStateContext);
  if (!ctx) throw new Error('useAuthState must be used inside AuthProvider');
  return ctx;
}
export function useAuthActions() {
  const ctx = useContext(_AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used inside AuthProvider');
  return ctx;
}
export function useAuth() {
  return { ...useAuthState(), ...useAuthActions() };
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const token = await fbUser.getIdToken();
        setToken(token);
      } else {
        clearToken();
      }
      setFirebaseUser(fbUser ?? null);
    });
    return unsub;
  }, []);

  // Fully authenticated = signed in AND email verified
  const isAuthenticated  = !!(firebaseUser && firebaseUser.emailVerified);
  // Signed in but email not yet verified — needs to check inbox
  const verifyRequired   = !!(firebaseUser && !firebaseUser.emailVerified);

  const user = useMemo(() => buildUser(firebaseUser), [firebaseUser]);

  const logout = useCallback(async () => {
    setFirebaseUser(null);
    await firebaseLogout();
  }, []);

  const actionsValue = useMemo(() => ({ logout }), [logout]);
  const stateValue   = useMemo(
    () => ({
      user,
      firebaseUser,
      isAuthenticated,
      verifyRequired,
      loading: firebaseUser === undefined,
    }),
    [user, firebaseUser, isAuthenticated, verifyRequired],
  );

  return (
    <_AuthActionsContext.Provider value={actionsValue}>
      <_AuthStateContext.Provider value={stateValue}>
        {children}
      </_AuthStateContext.Provider>
    </_AuthActionsContext.Provider>
  );
}
