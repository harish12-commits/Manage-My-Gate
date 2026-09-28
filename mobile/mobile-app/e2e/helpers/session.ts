import fs from 'fs';
import { store } from '@/src/store/store';
import { loginUser } from '@/src/features/auth/store/authSlice';
import storage from '@/src/utils/storage';

const E2E = require('../setup/constants');

export type Actor =
  | 'adminA'
  | 'guardA'
  | 'residentA'
  | 'residentB'
  | 'guardOther'
  | 'residentOther'
  // amenity suite only
  | 'familyA'
  | 'managerA'
  | 'adminOther'
  | 'crossAdmin';

export interface ActorInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  orgKey: 'A' | 'B';
  orgId: string;
  villaId: string | null;
  villaNumber: string | null;
}

export interface Fixture {
  password: string;
  orgs: Record<'A' | 'B', string>;
  villas: Record<string, string>;
  /** amenity suite only: seeded facility ids keyed by fixture name (e.g. "pool", "court") */
  facilities?: Record<string, { id: string; code: string; name: string; archetype: string; orgKey: 'A' | 'B'; resourceIds: string[] }>;
  actors: Record<Actor, ActorInfo>;
  sessions: Record<Actor, { token: string; refreshToken: string; user: any; availableWorkspaces: any[] }>;
}

let cached: Fixture | null = null;
export const fixture = (): Fixture => {
  if (!cached) cached = JSON.parse(fs.readFileSync(E2E.fixtureFile, 'utf8'));
  return cached!;
};

export const actor = (name: Actor) => fixture().actors[name];

/**
 * Puts the app into the signed-in state for `name`, using the payload the real
 * /auth/login returned for that actor during global setup. Equivalent to what the
 * loginUser thunk does after its HTTP call succeeds.
 */
export const signInAs = async (name: Actor) => {
  const session = fixture().sessions[name];
  const user = { ...session.user, availableWorkspaces: session.availableWorkspaces || [] };
  await storage.setItem('token', session.token);
  await storage.setItem('refreshToken', session.refreshToken);
  await storage.setItem('user', JSON.stringify(user));
  store.dispatch(loginUser.fulfilled({ ...session, user } as any, 'e2e-sign-in', {}));
  return actor(name);
};

export { store };
