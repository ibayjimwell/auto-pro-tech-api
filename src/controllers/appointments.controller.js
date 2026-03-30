import { Database } from '../database/drizzle.js';
import { Appointments, Customers, Vehicles, ServiceTypes, Staff } from '../models/index.js';
import { eq, and, sql, lt, gt, gte, lte } from 'drizzle-orm';

// Helper: Check if a time slot overlaps existing appointments on a given date
async function isSlotAvailable(date, startTime, durationMinutes) {
  const endTime = new Date(`1970-01-01T${startTime}`);
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);
  const endTimeStr = endTime.toTimeString().slice(0, 8);

  const existing = await Database.select()
    .from(Appointments)
    .where(eq(Appointments.appointmentDate, date))
    .where(sql`${Appointments.status} != 'CANCELLED'`);

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

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { date, serviceTypeId } = req.query;
    if (!date || !serviceTypeId) {
      return res.status(400).json({ success: false, message: 'date and serviceTypeId are required' });
    }

    const [serviceType] = await Database.select().from(ServiceTypes).where(eq(ServiceTypes.id, serviceTypeId));
    if (!serviceType) {
      return res.status(404).json({ success: false, message: 'Service type not found' });
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
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Check existence of referenced entities
    const [customer] = await Database.select().from(Customers).where(eq(Customers.id, customerId));
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    const [vehicle] = await Database.select().from(Vehicles).where(eq(Vehicles.id, vehicleId));
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    const [serviceType] = await Database.select().from(ServiceTypes).where(eq(ServiceTypes.id, serviceTypeId));
    if (!serviceType) return res.status(404).json({ success: false, message: 'Service type not found' });
    let staff = null;
    if (assignedStaffId) {
      [staff] = await Database.select().from(Staff).where(eq(Staff.id, assignedStaffId));
      if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const duration = serviceType.durationMinutes;
    const available = await isSlotAvailable(appointmentDate, appointmentTime, duration);
    if (!available) {
      return res.status(409).json({ success: false, message: 'Time slot already booked' });
    }

    const [appointment] = await Database.insert(Appointments).values({
      customerId,
      vehicleId,
      serviceTypeId,
      assignedStaffId: staff ? staff.id : null,
      appointmentDate,
      appointmentTime,
      durationMinutes: duration,
      status: 'PENDING',
      notes,
    }).returning();

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (req, res, next) => {
  try {
    const { status, from, to, page = 1, limit = 20 } = req.query;
    let query = Database.select().from(Appointments);
    if (status) query = query.where(eq(Appointments.status, status));
    if (from && to) {
      query = query.where(sql`${Appointments.appointmentDate} BETWEEN ${from} AND ${to}`);
    }
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);
    const appointments = await query;
    res.json({ success: true, data: appointments, page, limit });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [appointment] = await Database.select().from(Appointments).where(eq(Appointments.id, id));
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { appointmentDate, appointmentTime, serviceTypeId, notes, assignedStaffId } = req.body;

    const [existing] = await Database.select().from(Appointments).where(eq(Appointments.id, id));
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Check conflicts if date/time changed
    let duration = existing.durationMinutes;
    if (serviceTypeId && serviceTypeId !== existing.serviceTypeId) {
      const [newService] = await Database.select().from(ServiceTypes).where(eq(ServiceTypes.id, serviceTypeId));
      if (!newService) return res.status(404).json({ success: false, message: 'Service type not found' });
      duration = newService.durationMinutes;
    }

    const newDate = appointmentDate || existing.appointmentDate;
    const newTime = appointmentTime || existing.appointmentTime;
    if (newDate !== existing.appointmentDate || newTime !== existing.appointmentTime) {
      const available = await isSlotAvailable(newDate, newTime, duration);
      if (!available) {
        return res.status(409).json({ success: false, message: 'New time slot conflicts with existing appointment' });
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
    if (assignedStaffId !== undefined) updateData.assignedStaffId = assignedStaffId;

    const [updated] = await Database.update(Appointments)
      .set(updateData)
      .where(eq(Appointments.id, id))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [updated] = await Database.update(Appointments)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(eq(Appointments.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, message: 'Appointment cancelled', data: updated });
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const [updated] = await Database.update(Appointments)
      .set({ status, updatedAt: new Date() })
      .where(eq(Appointments.id, id))
      .returning();
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};