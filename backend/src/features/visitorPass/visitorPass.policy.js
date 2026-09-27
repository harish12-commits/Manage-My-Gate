import HttpError from '../../utils/httpError.utils.js';

const normalized = (value) => String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ');

export const getActorId = (actor) => actor?.id || actor?._id || actor?.userId || null;

const hasPermission = (actor, permission) =>
  Array.isArray(actor?.permissions) && actor.permissions.some((entry) => entry === '*' || entry === permission);

export const isVisitorManager = (actor) => {
  const role = normalized(actor?.role);
  return Boolean(actor?.isPlatform) || hasPermission(actor, 'visitor:admin') || hasPermission(actor, 'visitor:manage') ||
    role.includes('admin') || role.includes('manager');
};

export const isGateOperator = (actor) => {
  const role = normalized(actor?.role);
  return isVisitorManager(actor) || hasPermission(actor, 'visitor:guard') ||
    role.includes('guard') || role.includes('security');
};

export const canCreateResidentPass = (actor) => {
  const role = normalized(actor?.role);
  return isVisitorManager(actor) || hasPermission(actor, 'visitor:resident') ||
    role.includes('resident') || role.includes('tenant') || role.includes('owner') || role.includes('family');
};

export const assertResidentOwnsVilla = (membership, villaId) => {
  if (!villaId) {
    throw new HttpError(400, 'A unit is required when a resident issues a visitor pass.');
  }
  const assignedVillaIds = [
    membership?.villaId,
    ...(Array.isArray(membership?.units) ? membership.units.map((unit) => unit?.villaId) : []),
  ].filter(Boolean).map(String);

  if (!assignedVillaIds.includes(String(villaId))) {
    throw new HttpError(403, 'Forbidden. Residents can only issue passes for one of their assigned units.');
  }
};

export const assertVisitorPermission = (allowed, actor) => {
  const checks = {
    resident: canCreateResidentPass,
    gate: isGateOperator,
    manager: isVisitorManager,
  };
  if (!allowed.some((scope) => checks[scope]?.(actor))) {
    throw new HttpError(403, 'Forbidden. You do not have permission to perform this visitor operation.');
  }
};

export const assertPassAccess = (pass, actor) => {
  if (!pass) throw new HttpError(404, 'Visitor pass not found.');
  if (isVisitorManager(actor) || isGateOperator(actor)) return;
  if (String(pass.createdById?._id || pass.createdById) !== String(getActorId(actor))) {
    throw new HttpError(403, 'Forbidden. This visitor pass belongs to another resident.');
  }
};

export const assertWalkInResolutionAccess = (log, actor) => {
  if (isVisitorManager(actor)) return;
  if (String(log?.residentId?._id || log?.residentId) !== String(getActorId(actor))) {
    throw new HttpError(403, 'Forbidden. Only the invited resident can resolve this request.');
  }
};
