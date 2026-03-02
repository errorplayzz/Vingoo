/**
 * auth/authService.js — Firebase Authentication service
 * 2FA method: Firebase Email Verification (free, no billing needed)
 */
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut,
  reload,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { setToken, clearToken } from './tokenStore';

/** Sign in with email + password. Returns Firebase user. */
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  setToken(token);
  return cred.user;
}

/** Sign in with Google OAuth popup. Returns Firebase user. */
export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  const token = await cred.user.getIdToken();
  setToken(token);
  return cred.user;
}

/** Create a new account with email + password. Returns Firebase user. */
export async function signupWithEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const token = await cred.user.getIdToken();
  setToken(token);
  return cred.user;
}

/** Send email verification link to the current user. */
export async function sendVerificationEmail() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  await sendEmailVerification(user);
}

/** Reload the current user's profile (refreshes emailVerified flag). */
export async function reloadUser() {
  const user = auth.currentUser;
  if (!user) return null;
  await reload(user);
  const token = await user.getIdToken(true);
  setToken(token);
  return user;
}

/** Send password-reset email. */
export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

/** Sign out from Firebase + clear cached token. */
export async function logout() {
  clearToken();
  await signOut(auth);
  window.location.href = '/';
}
