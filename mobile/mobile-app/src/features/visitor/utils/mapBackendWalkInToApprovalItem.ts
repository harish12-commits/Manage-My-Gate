import { WalkInApprovalItem, PassTypeKey } from '../mocks/visitorMocks';

/**
 * Pure mapper function converting raw backend VisitorLog objects (WALK_IN)
 * into normalized WalkInApprovalItem objects for resident approval UI rendering.
 */
export const mapBackendWalkInToApprovalItem = (log: any): WalkInApprovalItem => {
  if (!log) {
    return {} as WalkInApprovalItem;
  }

  const id = log._id || String(Math.random());
  const visitorName = log.snapshot?.visitorName || 'Walk-In Visitor';

  // Do NOT fabricate or substitute idProofNumber as phone number.
  // Extract phone only if explicit phone field exists in backend payload/snapshot.
  const phone = log.snapshot?.phone || log.phone || '';

  const vehicleNo = log.snapshot?.vehicleNumber || undefined;
  const idProof = log.snapshot?.idProofNumber;

  const notes = idProof ? `ID Proof: ${idProof}` : undefined;

  // Derived UI fallbacks used ONLY when backend does not provide explicit values
  const gateName = log.gateName || 'Main gate';
  const purpose = log.purpose || 'Gate Walk-In Approval Request';
  const passType: PassTypeKey = (log.passType as PassTypeKey) || 'GUEST';

  const createdAtMs = log.createdAt ? new Date(log.createdAt).getTime() : Date.now();
  const waitingDurationMinutes = Math.max(1, Math.floor((Date.now() - createdAtMs) / 60000));

  let status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
  if (log.logStatus === 'INSIDE' || log.logStatus === 'COMPLETED' || log.logStatus === 'APPROVED') {
    status = 'APPROVED';
  } else if (log.logStatus === 'REJECTED') {
    status = 'REJECTED';
  } else {
    status = 'PENDING';
  }

  const decision = Array.isArray(log.actionHistory)
    ? [...log.actionHistory].reverse().find((a: any) => a?.action === 'APPROVED' || a?.action === 'REJECTED')
    : null;
  const resolvedAt = status === 'PENDING' ? undefined : decision?.occurredAt || log.updatedAt || undefined;

  return {
    id,
    visitorName,
    phone,
    purpose,
    passType,
    gateName,
    waitingDurationMinutes,
    requestTimestamp: log.createdAt || new Date().toISOString(),
    vehicleNo,
    notes,
    status,
    resolvedAt,
    rawLog: log,
  };
};

export default mapBackendWalkInToApprovalItem;
