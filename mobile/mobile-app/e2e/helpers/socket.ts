/**
 * A second device in the test: a socket.io client signed in as another actor, joining
 * exactly the rooms the app's useAppSocket joins, so real-time delivery is tested as the
 * app would experience it.
 */
import { io, Socket } from 'socket.io-client';
import { fixture, actor, Actor } from './session';

const E2E = require('../setup/constants');

export interface ActorSocket {
  events: { name: string; payload: any }[];
  waitForEvent: (name: string, match?: (payload: any) => boolean, timeoutMs?: number) => Promise<any>;
  close: () => void;
}

export const connectAs = async (who: Actor): Promise<ActorSocket> => {
  const me = actor(who);
  const session = fixture().sessions[who];
  const role: string = session.user.role;
  const socket: Socket = io(E2E.socketUrl, {
    transports: ['websocket'],
    auth: { token: session.token },
    query: { userId: me.id },
    reconnection: false,
  });

  const events: { name: string; payload: any }[] = [];
  socket.onAny((name, payload) => events.push({ name, payload }));

  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

  // Mirrors joinUserRooms in src/hooks/useAppSocket.ts.
  const rooms = [
    `user:${me.id}`,
    `role:${role}`,
    `role:${role.toLowerCase()}`,
    `org:${me.orgId}`,
    `org:${me.orgId}:role:${role.toLowerCase()}`,
    `org:${me.orgId}:role:${role}`,
  ];
  const permissions: string[] = session.user.permissions || [];
  if (permissions.some((p) => p === '*' || p === 'visitor:guard' || p === 'visitor:admin')) {
    rooms.push(`org:${me.orgId}:guards`);
  }
  rooms.forEach((room) => socket.emit('join_room', room));
  await new Promise((r) => setTimeout(r, 200));

  const waitForEvent = (name: string, match: (p: any) => boolean = () => true, timeoutMs = 5000) =>
    new Promise<any>((resolve, reject) => {
      const seen = events.find((e) => e.name === name && match(e.payload));
      if (seen) return resolve(seen.payload);
      const timer = setTimeout(() => {
        socket.off(name, handler);
        reject(new Error(`${who} did not receive "${name}" within ${timeoutMs}ms`));
      }, timeoutMs);
      const handler = (payload: any) => {
        if (!match(payload)) return;
        clearTimeout(timer);
        socket.off(name, handler);
        resolve(payload);
      };
      socket.on(name, handler);
    });

  return { events, waitForEvent, close: () => socket.close() };
};
