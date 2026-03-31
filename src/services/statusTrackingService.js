import { Database } from '../database/drizzle.js';
import {
  Appointments,
  AppointmentStatusLogs,
  Invoices,
} from '../models/index.js';
import { eq, and, desc } from 'drizzle-orm';

const STATUS = {
  PENDING: 'PENDING',
  UNDER_INSPECTION: 'UNDER_INSPECTION',
  WAITING_FOR_APPROVAL: 'WAITING_FOR_APPROVAL',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  CONFIRMED: 'CONFIRMED',
};

const ALLOWED_TRANSITIONS = {
  PENDING: ['UNDER_INSPECTION', 'CANCELLED', 'CONFIRMED'],
  UNDER_INSPECTION: ['WAITING_FOR_APPROVAL', 'CANCELLED'],
  WAITING_FOR_APPROVAL: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  CONFIRMED: ['UNDER_INSPECTION', 'CANCELLED'],
};

const INVOICE_TYPE = {
  ESTIMATE: 'ESTIMATE',
  FINAL: 'FINAL',
};

const INVOICE_STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

/**
 * Validate if transition is allowed per flow map.
 */
export const validateStatusTransition = (currentStatus, nextStatus) => {
  if (!STATUS[currentStatus] || !STATUS[nextStatus]) {
    return { valid: false, reason: 'Invalid status value' };
  }

  // Any status can go to CANCELLED (during staff/admin cancellation)
  if (nextStatus === STATUS.CANCELLED) {
    return { valid: true };
  }

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (allowed.includes(nextStatus)) {
    return { valid: true };
  }

  return { valid: false, reason: `Transition from ${currentStatus} to ${nextStatus} is not allowed` };
};

export const updateAppointmentStatus = async (
  appointmentId,
  newStatus,
  changedByStaffId = null,
  notes = null,
  invoiceAmount = 0,
  invoiceDetails = null,
) => {
  const statusUpper = (newStatus || '').toUpperCase();

  if (!STATUS[statusUpper]) {
    throw { status: 400, message: `Invalid status: ${newStatus}` };
  }

  const [appointment] = await Database.select().from(Appointments).where(eq(Appointments.id, appointmentId));
  if (!appointment) {
    throw { status: 404, message: 'Appointment not found' };
  }

  const currentStatus = appointment.status;
  const { valid, reason } = validateStatusTransition(currentStatus, statusUpper);
  if (!valid) {
    throw { status: 400, message: reason };
  }

  const [updatedAppointment] = await Database.update(Appointments)
    .set({
      status: statusUpper,
      updatedAt: new Date(),
    })
    .where(eq(Appointments.id, appointmentId))
    .returning();

  const [statusLog] = await Database.insert(AppointmentStatusLogs)
    .values({
      appointmentId,
      previousStatus: currentStatus,
      status: statusUpper,
      notes,
      changedBy: changedByStaffId || null,
    })
    .returning();

  // Invoice lifecycle side effects
  if (statusUpper === STATUS.WAITING_FOR_APPROVAL) {
    await Database.insert(Invoices).values({
      appointmentId,
      invoiceType: INVOICE_TYPE.ESTIMATE,
      status: INVOICE_STATUS.PENDING_APPROVAL,
      totalAmount: invoiceAmount || 0,
      details: invoiceDetails || 'Initial estimate',
      issuedByStaffId: changedByStaffId || null,
    });
  }

  if (statusUpper === STATUS.IN_PROGRESS) {
    await Database.update(Invoices)
      .set({
        status: INVOICE_STATUS.APPROVED,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(Invoices.appointmentId, appointmentId),
          eq(Invoices.invoiceType, INVOICE_TYPE.ESTIMATE),
          eq(Invoices.status, INVOICE_STATUS.PENDING_APPROVAL),
        ),
      );
  }

  if (statusUpper === STATUS.COMPLETED) {
    // mark any estimate as approved + completed at if not already
    await Database.update(Invoices)
      .set({
        status: INVOICE_STATUS.APPROVED,
        approvedAt: new Date(),
      })
      .where(
        and(
          eq(Invoices.appointmentId, appointmentId),
          eq(Invoices.invoiceType, INVOICE_TYPE.ESTIMATE),
          eq(Invoices.status, INVOICE_STATUS.PENDING_APPROVAL),
        ),
      );

    await Database.insert(Invoices).values({
      appointmentId,
      invoiceType: INVOICE_TYPE.FINAL,
      status: INVOICE_STATUS.PAID,
      totalAmount: invoiceAmount || 0,
      details: invoiceDetails || 'Final invoice',
      completedAt: new Date(),
      issuedByStaffId: changedByStaffId || null,
    });
  }

  if (statusUpper === STATUS.CANCELLED) {
    await Database.update(Invoices)
      .set({
        status: INVOICE_STATUS.CANCELLED,
        cancelledAt: new Date(),
      })
      .where(eq(Invoices.appointmentId, appointmentId));
  }

  return { appointment: updatedAppointment, statusLog };
};

export const getStatusLogs = async (appointmentId) => {
  const logs = await Database.select().from(AppointmentStatusLogs)
    .where(eq(AppointmentStatusLogs.appointmentId, appointmentId))
    .orderBy(desc(AppointmentStatusLogs.changedAt));

  return logs;
};

export const getAppointmentsByStatus = async (status) => {
  const statusUpper = (status || '').toUpperCase();
  if (!STATUS[statusUpper]) {
    throw { status: 400, message: `Invalid status filter: ${status}` };
  }

  return Database.select().from(Appointments).where(eq(Appointments.status, statusUpper));
};
