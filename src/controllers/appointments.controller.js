import { Database } from '../database/drizzle.js';
import {
  Appointments,
  Customers,
  Vehicles,
  ServiceTypes,
  Staff,
  AppointmentStatusLogs,
} from '../models/index.js';
import { eq, and, sql, lt, gt, gte, lte, desc } from 'drizzle-orm';

/**
 * Helper: Check if a time slot overlaps existing appointments on a given date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH:MM:SS format
 * @param {number} durationMinutes - Duration of the appointment in minutes
 * @param {string} [excludeAppointmentId] - ID of appointment to exclude from check (for updates)
 * @returns {Promise<boolean>} true if slot is available, false if booked
 */
async function isSlotAvailable(date, startTime, durationMinutes, excludeAppointmentId = null) {
  const endTime = new Date(`1970-01-01T${startTime}`);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  const endTimeStr = endTime.toTimeString().slice(0, 8);

  let query = Database.select()
    .from(Appointments)
    .where(eq(Appointments.appointmentDate, date))
    .where(sql`${Appointments.status} != 'CANCELLED'`);

  if (excludeAppointmentId) {
    query = query.where(sql`${Appointments.id} != ${excludeAppointmentId}`);
  }

  const existing = await query;

  for (const app of existing) {
    const appStart = app.appointmentTime;
    const appEnd = new Date(`1970-01-01T${app.appointmentTime}`);
    appEnd.setMinutes(appEnd.getMinutes() + app.durationMinutes);
    const appEndStr = appEnd.toTimeString().slice(0, 8);
    if (startTime < appEndStr && endTimeStr > appStart) {
      return false;
    }
  }
  return true;
}

/**
 * Helper: Log appointment status change to audit trail
 * @param {string} appointmentId - Appointment ID
 * @param {string} previousStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} notes - Optional notes about the status change
 * @param {string} changedBy - User ID who made the change (optional)
 */
async function logStatusChange(appointmentId, previousStatus, newStatus, notes = null, changedBy = null) {
  try {
    await Database.insert(AppointmentStatusLogs).values({
      appointmentId,
      previousStatus: previousStatus || null,
      status: newStatus,
      notes,
      changedBy: changedBy || null,
    });
  } catch (error) {
    console.error('Failed to log status change:', error);
    // Don't throw - allow appointment update to succeed even if logging fails
  }
}

/**
 * GET /api/v1/appointments/available-slots
 * Get available time slots for a given date and service type
 * Query params: date (YYYY-MM-DD), serviceTypeId (UUID)
 * Role: all (public)
 */
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { date, serviceTypeId } = req.query;

    // Validate required fields
    if (!date || !serviceTypeId) {
      return res.status(400).json({
        success: false,
        message: 'date and serviceTypeId query parameters are required',
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'date must be in YYYY-MM-DD format',
      });
    }

    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, serviceTypeId));

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found',
      });
    }

    if (!serviceType.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Service type is not active',
      });
    }

    const duration = serviceType.durationMinutes;
    const shopOpen = '08:00:00';
    const shopClose = '17:00:00';

    const slots = [];
    let current = new Date(`1970-01-01T${shopOpen}`);
    const endLimit = new Date(`1970-01-01T${shopClose}`);
    endLimit.setMinutes(endLimit.getMinutes() - duration); // last start time

    while (current <= endLimit) {
      const timeStr = current.toTimeString().slice(0, 8);
      const available = await isSlotAvailable(date, timeStr, duration);
      slots.push({ time: timeStr, available });
      current.setMinutes(current.getMinutes() + 30);
    }

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/appointments
 * Create a new appointment
 * Body: customerId, vehicleId, serviceTypeId, appointmentDate, appointmentTime, notes?, assignedStaffId?
 * Role: all
 */
export const createAppointment = async (req, res, next) => {
  try {
    const {
      customerId,
      vehicleId,
      serviceTypeId,
      appointmentDate,
      appointmentTime,
      notes,
      assignedStaffId,
    } = req.body;

    // Validate required fields
    if (!customerId || !vehicleId || !serviceTypeId || !appointmentDate || !appointmentTime) {
      return res.status(400).json({
        success: false,
        message: 'customerId, vehicleId, serviceTypeId, appointmentDate, and appointmentTime are required',
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: 'appointmentDate must be in YYYY-MM-DD format',
      });
    }

    // Validate time format
    if (!/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      return res.status(400).json({
        success: false,
        message: 'appointmentTime must be in HH:MM:SS format',
      });
    }

    // Check existence of referenced entities
    const [customer] = await Database.select()
      .from(Customers)
      .where(eq(Customers.id, customerId));
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const [vehicle] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.id, vehicleId));
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found',
      });
    }

    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, serviceTypeId));
    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: 'Service type not found',
      });
    }

    if (!serviceType.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Service type is not active',
      });
    }

    let staff = null;
    if (assignedStaffId) {
      [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, assignedStaffId));
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
        });
      }
    }

    // Check slot availability
    const duration = serviceType.durationMinutes;
    const available = await isSlotAvailable(appointmentDate, appointmentTime, duration);
    if (!available) {
      return res.status(409).json({
        success: false,
        message: 'Time slot is already booked. Please choose another time.',
      });
    }

    // Create appointment
    const [appointment] = await Database.insert(Appointments)
      .values({
        customerId,
        vehicleId,
        serviceTypeId,
        assignedStaffId: staff ? staff.id : null,
        appointmentDate,
        appointmentTime,
        durationMinutes: duration,
        status: 'PENDING',
        notes: notes || null,
      })
      .returning();

    // Log initial status
    await logStatusChange(appointment.id, null, 'PENDING', 'Appointment created', null);

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments
 * List all appointments with optional filtering
 * Query params: status, from (date), to (date), page (default 1), limit (default 20)
 * Role: admin, staff
 */
export const getAppointments = async (req, res, next) => {
  try {
    const { status, from, to, page = 1, limit = 20, customerId } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = Database.select().from(Appointments);

    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        });
      }
      query = query.where(eq(Appointments.status, status.toUpperCase()));
    }

    if (customerId) {
      query = query.where(eq(Appointments.customerId, customerId));
    }

    if (from && to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return res.status(400).json({
          success: false,
          message: 'from and to dates must be in YYYY-MM-DD format',
        });
      }
      query = query.where(
        sql`${Appointments.appointmentDate} BETWEEN ${from} AND ${to}`
      );
    }

    // Get total count for pagination
    const [{ count }] = await Database.select({ count: sql`count(*)` })
      .from(Appointments);

    const appointments = await query
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(Appointments.appointmentDate));

    res.json({
      success: true,
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(count),
        pages: Math.ceil(parseInt(count) / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments/{id}
 * Get full appointment detail by ID
 * Role: all
 */
export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/appointments/{id}
 * Update appointment details (date, time, service type, assigned staff, notes)
 * Body: appointmentDate?, appointmentTime?, serviceTypeId?, notes?, assignedStaffId?
 * Role: admin, staff
 */
export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { appointmentDate, appointmentTime, serviceTypeId, notes, assignedStaffId } = req.body;

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    // Validate formats if provided
    if (appointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: 'appointmentDate must be in YYYY-MM-DD format',
      });
    }

    if (appointmentTime && !/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      return res.status(400).json({
        success: false,
        message: 'appointmentTime must be in HH:MM:SS format',
      });
    }

    // Check conflicts if date/time changed
    let duration = existing.durationMinutes;
    if (serviceTypeId && serviceTypeId !== existing.serviceTypeId) {
      const [newService] = await Database.select()
        .from(ServiceTypes)
        .where(eq(ServiceTypes.id, serviceTypeId));
      if (!newService) {
        return res.status(404).json({
          success: false,
          message: 'Service type not found',
        });
      }
      if (!newService.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Service type is not active',
        });
      }
      duration = newService.durationMinutes;
    }

    // Validate assigned staff if provided
    if (assignedStaffId) {
      const [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, assignedStaffId));
      if (!staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found',
        });
      }
    }

    const newDate = appointmentDate || existing.appointmentDate;
    const newTime = appointmentTime || existing.appointmentTime;

    // Check if slot is available if date/time changed
    if (newDate !== existing.appointmentDate || newTime !== existing.appointmentTime) {
      const available = await isSlotAvailable(newDate, newTime, duration, id);
      if (!available) {
        return res.status(409).json({
          success: false,
          message: 'New time slot conflicts with existing appointment',
        });
      }
    }

    const updateData = {
      appointmentDate: newDate,
      appointmentTime: newTime,
      notes: notes !== undefined ? notes : existing.notes,
      updatedAt: new Date(),
    };

    if (serviceTypeId) updateData.serviceTypeId = serviceTypeId;
    if (duration !== existing.durationMinutes) updateData.durationMinutes = duration;
    if (assignedStaffId !== undefined) updateData.assignedStaffId = assignedStaffId || null;

    const [updated] = await Database.update(Appointments)
      .set(updateData)
      .where(eq(Appointments.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/appointments/{id}
 * Cancel an appointment (soft delete - marks as CANCELLED)
 * Body: notes? (reason for cancellation)
 * Role: admin, staff
 */
export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const [updated] = await Database.update(Appointments)
      .set({
        status: 'CANCELLED',
        notes: notes || existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(Appointments.id, id))
      .returning();

    // Log status change
    await logStatusChange(id, existing.status, 'CANCELLED', notes || 'Appointment cancelled');

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/appointments/{id}/status
 * Update appointment status with validation of allowed transitions
 * Body: status (string), notes? (optional change notes)
 * Role: admin, staff
 */
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required',
      });
    }

    const allowed = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowed.join(', ')}`,
      });
    }

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const newStatus = status.toUpperCase();

    // Validate status transitions (simple rules)
    const validTransitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['IN_PROGRESS', 'PENDING', 'CANCELLED'],
      IN_PROGRESS: ['COMPLETED', 'CONFIRMED'],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[existing.status]?.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${existing.status} to ${newStatus}`,
        allowed: validTransitions[existing.status] || [],
      });
    }

    const [updated] = await Database.update(Appointments)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(Appointments.id, id))
      .returning();

    // Log status change
    await logStatusChange(id, existing.status, newStatus, notes || null);

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments/{id}/status-log
 * Get full status change history (audit trail) for an appointment
 * Role: all
 */
export const getAppointmentStatusLog = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify appointment exists
    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }

    const statusLogs = await Database.select()
      .from(AppointmentStatusLogs)
      .where(eq(AppointmentStatusLogs.appointmentId, id))
      .orderBy(desc(AppointmentStatusLogs.changedAt));

    res.json({
      success: true,
      data: statusLogs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/customers/{customerId}/appointments
 * Get all appointments for a specific customer (customer-scoped view)
 * Query params: page (default 1), limit (default 20), status?
 * Role: customer (own appointments), admin, staff (all customers)
 */
export const getCustomerAppointments = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    // Verify customer exists
    const [customer] = await Database.select()
      .from(Customers)
      .where(eq(Customers.id, customerId));

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = Database.select()
      .from(Appointments)
      .where(eq(Appointments.customerId, customerId));

    if (status) {
      const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
        });
      }
      query = query.where(eq(Appointments.status, status.toUpperCase()));
    }

    // Get total count
    const [{ count }] = await Database.select({ count: sql`count(*)` })
      .from(Appointments)
      .where(eq(Appointments.customerId, customerId));

    const appointments = await query
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(Appointments.appointmentDate));

    res.json({
      success: true,
      data: appointments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(count),
        pages: Math.ceil(parseInt(count) / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments/calendar
 * Get appointments grouped by date for calendar view
 * Query params: month (YYYY-MM format, default current month)
 * Role: admin
 */
export const getCalendarView = async (req, res, next) => {
  try {
    const { month } = req.query;

    // Parse month or use current
    let startDate, endDate;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
    } else {
      const today = new Date();
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const appointments = await Database.select()
      .from(Appointments)
      .where(
        sql`${Appointments.appointmentDate} BETWEEN ${startStr} AND ${endStr}`
      )
      .where(sql`${Appointments.status} != 'CANCELLED'`)
      .orderBy(Appointments.appointmentDate, Appointments.appointmentTime);

    // Group by date
    const calendarData = {};
    appointments.forEach((apt) => {
      const date = apt.appointmentDate;
      if (!calendarData[date]) {
        calendarData[date] = [];
      }
      calendarData[date].push(apt);
    });

    res.json({
      success: true,
      month: month || startStr.slice(0, 7),
      data: calendarData,
    });
  } catch (error) {
    next(error);
  }
};