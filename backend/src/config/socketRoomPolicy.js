import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from './config.js';

/**
 * Decides whether a socket may join a room.
 *
 * Private rooms carry personal and gate data (visitor names, phones, walk-in decisions):
 *   - user:<id>            only that user
 *   - org:<orgId>...       only active members of that community
 *   - org:<orgId>:guards   only members with gate or visitor-admin permission
 * Any other room name keeps its previous behaviour.
 */

const readSocketToken = (socket) => {
  const fromAuth = socket.handshake?.auth?.token;
  if (fromAuth) return String(fromAuth).replace(/^Bearer\s+/i, '');
  const cookie = socket.handshake?.headers?.cookie || '';
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

/** The authenticated user behind a socket (cached per connection), or null. */
export const resolveSocketIdentity = (socket) => {
  if (socket.data.identity !== undefined) return socket.data.identity;
  let identity = null;
  try {
    const token = readSocketToken(socket);
    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      identity = { id: String(decoded.id || decoded._id), isPlatform: decoded.isPlatform === true };
    }
  } catch {
    identity = null;
  }
  socket.data.identity = identity;
  return identity;
};

const GATE_PERMISSIONS = new Set(['*', 'visitor:guard', 'visitor:admin']);

export const canJoinRoom = async (socket, room) => {
  if (room.startsWith('user:')) {
    const me = resolveSocketIdentity(socket);
    return Boolean(me) && room === `user:${me.id}`;
  }

  if (room.startsWith('org:')) {
    const me = resolveSocketIdentity(socket);
    if (!me) return false;
    if (me.isPlatform) return true;

    const orgId = room.split(':')[1];
    if (!mongoose.isValidObjectId(orgId)) return false;

    const OrgMembership = (await import('../features/orgMembership/orgMembership.model.js')).default;
    const isMember = await OrgMembership.exists({ userId: me.id, orgId, status: 'Active' });
    if (!isMember) return false;

    if (room === `org:${orgId}:guards`) {
      const { getPermissionsForUser } = await import('../middlewares/rbac.middleware.js');
      const permissions = await getPermissionsForUser({ id: me.id }, orgId);
      return permissions.some((p) => GATE_PERMISSIONS.has(p));
    }
    return true;
  }

  return true;
};
