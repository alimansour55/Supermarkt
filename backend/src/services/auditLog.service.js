import AuditLog from '../models/AuditLog.js';

export async function logAudit({
  req,
  action,
  entityType,
  entityId,
  entityLabel,
  changes,
}) {
  try {
    await AuditLog.create({
      actor: req?.user?._id,
      actorName: req?.user?.name,
      actorRole: req?.user?.role,
      action,
      entityType,
      entityId,
      entityLabel,
      changes,
      ip: req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

export function pickChanges(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const fromVal = before?.[field];
    const toVal = after?.[field];
    if (fromVal !== toVal && (fromVal !== undefined || toVal !== undefined)) {
      changes[field] = { from: fromVal, to: toVal };
    }
  }
  return Object.keys(changes).length ? changes : undefined;
}
