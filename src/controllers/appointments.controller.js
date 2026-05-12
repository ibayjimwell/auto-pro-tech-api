import { Database } from "../database/drizzle.js";
import {
  Appointments,
  Customers,
  Vehicles,
  ServiceTypes,
  Staff,
  AppointmentStatusLogs,
  InspectionTasks,
  InspectionFindings,
  InspectionFindingProducts,
  Invoices,
} from "../models/index.js";
import { eq, and, sql, lt, gt, gte, lte, desc, ne } from "drizzle-orm";
import { getIo } from "../websocket.js";
import { sendPushNotification } from "../services/push.service.js";
import { PushTokens } from "../models/index.js";

/**
 * Helper: Check if a time slot overlaps existing appointments on a given date
 * @param {string} date - YYYY-MM-DD
 * @param {string} startTime - HH:MM:SS
 * @param {number} durationMinutes
 * @param {string} [excludeAppointmentId]
 * @returns {Promise<boolean>}
 */
async function isSlotAvailable(date, startTime, durationMinutes, excludeAppointmentId = null) {
  const [hour, minute] = startTime.split(':').map(Number);
  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + durationMinutes;

  // Use raw SQL to guarantee correct date filtering
  const result = await Database.execute(sql`
    SELECT appointment_time, duration_minutes, id
    FROM appointments
    WHERE appointment_date = ${date}
    AND status != 'CANCELLED'
  `);
  const existing = result.rows || [];

  // If we are updating an appointment, exclude the current appointment from the check
  const filtered = excludeAppointmentId
    ? existing.filter(row => row.id !== excludeAppointmentId)
    : existing;

  for (const app of filtered) {
    const [appHour, appMinute] = app.appointment_time.split(':').map(Number);
    const appStart = appHour * 60 + appMinute;
    const appEnd = appStart + app.duration_minutes;
    if (startMinutes < appEnd && endMinutes > appStart) {
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
async function logStatusChange(
  appointmentId,
  previousStatus,
  newStatus,
  notes = null,
  changedBy = null,
) {
  try {
    await Database.insert(AppointmentStatusLogs).values({
      appointmentId,
      previousStatus: previousStatus || null,
      status: newStatus,
      notes,
      changedBy: changedBy || null,
    });
  } catch (error) {
    console.error("Failed to log status change:", error);
    // Don't throw - allow appointment update to succeed even if logging fails
  }
}

/**
 * GET /api/v1/appointments/available-slots
 */
export const getAvailableSlots = async (req, res, next) => {
  try {
    const { date, serviceTypeId } = req.query;

    if (!date || !serviceTypeId) {
      return res.status(400).json({
        success: false,
        message: "date and serviceTypeId are required",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "date must be in YYYY-MM-DD format",
      });
    }

    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, serviceTypeId));

    if (!serviceType) {
      return res.status(404).json({
        success: false,
        message: "Service type not found",
      });
    }

    if (!serviceType.active) {
      return res.status(400).json({
        success: false,
        message: "Service type is not active",
      });
    }

    const duration = serviceType.durationMinutes;
    const shopOpen = 8 * 60;
    const shopClose = 17 * 60;
    const lastStart = shopClose - duration;

    if (lastStart < shopOpen) {
      return res.json({ success: true, data: [] });
    }

    // ✅ Use raw SQL to fetch appointments for the exact date
    const result = await Database.execute(sql`
      SELECT appointment_time, duration_minutes 
      FROM appointments 
      WHERE appointment_date = ${date} 
      AND status != 'CANCELLED'
    `);

    const appointmentsOnDate = result.rows || [];

    console.log(
      `[DEBUG] Found ${appointmentsOnDate.length} appointments for ${date}:`,
      appointmentsOnDate,
    );

    const bookedIntervals = appointmentsOnDate.map((app) => {
      const [hour, minute] = app.appointment_time.split(":").map(Number);
      const start = hour * 60 + minute;
      const end = start + app.duration_minutes;
      return { start, end };
    });

    const slots = [];
    for (let minutes = shopOpen; minutes <= lastStart; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}:00`;
      const slotStart = minutes;
      const slotEnd = slotStart + duration;

      let available = true;
      for (const interval of bookedIntervals) {
        if (slotStart < interval.end && slotEnd > interval.start) {
          available = false;
          break;
        }
      }
      slots.push({ time: timeStr, available });
    }

    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/appointments
 * Create a new appointment
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

    if (
      !customerId ||
      !vehicleId ||
      !serviceTypeId ||
      !appointmentDate ||
      !appointmentTime
    ) {
      return res.status(400).json({
        success: false,
        message:
          "customerId, vehicleId, serviceTypeId, appointmentDate, and appointmentTime are required",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res.status(400).json({
        success: false,
        message: "appointmentDate must be in YYYY-MM-DD format",
      });
    }

    if (!/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      return res.status(400).json({
        success: false,
        message: "appointmentTime must be in HH:MM:SS format",
      });
    }

    const [customer] = await Database.select()
      .from(Customers)
      .where(eq(Customers.id, customerId));
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const [vehicle] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.id, vehicleId));
    if (!vehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found" });
    }

    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, serviceTypeId));
    if (!serviceType) {
      return res
        .status(404)
        .json({ success: false, message: "Service type not found" });
    }
    if (!serviceType.active) {
      return res
        .status(400)
        .json({ success: false, message: "Service type is not active" });
    }

    let staff = null;
    if (assignedStaffId) {
      [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, assignedStaffId));
      if (!staff) {
        return res
          .status(404)
          .json({ success: false, message: "Staff member not found" });
      }
    }

    const duration = serviceType.durationMinutes;
    const available = await isSlotAvailable(
      appointmentDate,
      appointmentTime,
      duration,
    );
    if (!available) {
      return res.status(409).json({
        success: false,
        message: "Time slot is already booked. Please choose another time.",
      });
    }

    const [appointment] = await Database.insert(Appointments)
      .values({
        customerId,
        vehicleId,
        serviceTypeId,
        assignedStaffId: staff ? staff.id : null,
        appointmentDate,
        appointmentTime,
        durationMinutes: duration,
        status: "PENDING",
        notes: notes || null,
      })
      .returning();

    await logStatusChange(
      appointment.id,
      null,
      "PENDING",
      "Appointment created",
      null,
    );

    // 🔁 Real-time update via WebSocket
    const io = getIo();
    io.emit("appointmentChanged", { type: "created", appointment });

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments
 * List appointments with filtering, pagination, and customer/vehicle/service details
 */
export const getAppointments = async (req, res, next) => {
  try {
    const { status, from, to, page = 1, limit = 20, customerId } = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Query with joins to get customer, vehicle and service type details
    let query = Database.select({
      id: Appointments.id,
      customerId: Appointments.customerId,
      vehicleId: Appointments.vehicleId,
      serviceTypeId: Appointments.serviceTypeId,
      assignedStaffId: Appointments.assignedStaffId,
      appointmentDate: Appointments.appointmentDate,
      appointmentTime: Appointments.appointmentTime,
      durationMinutes: Appointments.durationMinutes,
      status: Appointments.status,
      notes: Appointments.notes,
      createdAt: Appointments.createdAt,
      updatedAt: Appointments.updatedAt,
      customer: {
        id: Customers.id,
        fullName: Customers.fullName,
        email: Customers.email,
        phone: Customers.phone,
      },
      vehicle: {
        id: Vehicles.id,
        make: Vehicles.make,
        model: Vehicles.model,
        year: Vehicles.year,
        plateNumber: Vehicles.plateNumber,
      },
      serviceType: {
        id: ServiceTypes.id,
        name: ServiceTypes.name,
        basePrice: ServiceTypes.basePrice,
        durationMinutes: ServiceTypes.durationMinutes,
      },
    })
      .from(Appointments)
      .leftJoin(Customers, eq(Appointments.customerId, Customers.id))
      .leftJoin(Vehicles, eq(Appointments.vehicleId, Vehicles.id))
      .leftJoin(ServiceTypes, eq(Appointments.serviceTypeId, ServiceTypes.id));

    // Apply filters
    if (status) {
      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
        });
      }
      query = query.where(eq(Appointments.status, status.toUpperCase()));
    }

    if (customerId) {
      query = query.where(eq(Appointments.customerId, customerId));
    }

    if (from && to) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to)
      ) {
        return res.status(400).json({
          success: false,
          message: "from and to dates must be in YYYY-MM-DD format",
        });
      }
      query = query.where(
        sql`${Appointments.appointmentDate} BETWEEN ${from} AND ${to}`,
      );
    }

    // Get total count (simplified)
    const [{ count }] = await Database.select({ count: sql`count(*)` }).from(
      Appointments,
    );
    const appointments = await query
      .limit(limitNum)
      .offset(offset)
      .orderBy(desc(Appointments.appointmentDate));

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private",
    );
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
 */
export const getAppointmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [appointment] = await Database.select({
      id: Appointments.id,
      customerId: Appointments.customerId,
      vehicleId: Appointments.vehicleId,
      serviceTypeId: Appointments.serviceTypeId,
      assignedStaffId: Appointments.assignedStaffId,
      appointmentDate: Appointments.appointmentDate,
      appointmentTime: Appointments.appointmentTime,
      durationMinutes: Appointments.durationMinutes,
      status: Appointments.status,
      notes: Appointments.notes,
      createdAt: Appointments.createdAt,
      updatedAt: Appointments.updatedAt,
      customer: {
        id: Customers.id,
        fullName: Customers.fullName,
        email: Customers.email,
        phone: Customers.phone,
      },
      vehicle: {
        id: Vehicles.id,
        make: Vehicles.make,
        model: Vehicles.model,
        year: Vehicles.year,
        plateNumber: Vehicles.plateNumber,
      },
      serviceType: {
        id: ServiceTypes.id,
        name: ServiceTypes.name,
        basePrice: ServiceTypes.basePrice,
        durationMinutes: ServiceTypes.durationMinutes,
      },
    })
      .from(Appointments)
      .leftJoin(Customers, eq(Appointments.customerId, Customers.id))
      .leftJoin(Vehicles, eq(Appointments.vehicleId, Vehicles.id))
      .leftJoin(ServiceTypes, eq(Appointments.serviceTypeId, ServiceTypes.id))
      .where(eq(Appointments.id, id));

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }
    res.json({ success: true, data: appointment });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/appointments/{id}
 * Update appointment details
 */
export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      appointmentDate,
      appointmentTime,
      serviceTypeId,
      notes,
      assignedStaffId,
    } = req.body;

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (appointmentDate && !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid date format" });
    }
    if (appointmentTime && !/^\d{2}:\d{2}:\d{2}$/.test(appointmentTime)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid time format" });
    }

    let duration = existing.durationMinutes;
    if (serviceTypeId && serviceTypeId !== existing.serviceTypeId) {
      const [newService] = await Database.select()
        .from(ServiceTypes)
        .where(eq(ServiceTypes.id, serviceTypeId));
      if (!newService) {
        return res
          .status(404)
          .json({ success: false, message: "Service type not found" });
      }
      if (!newService.active) {
        return res
          .status(400)
          .json({ success: false, message: "Service type is not active" });
      }
      duration = newService.durationMinutes;
    }

    if (assignedStaffId) {
      const [staff] = await Database.select()
        .from(Staff)
        .where(eq(Staff.id, assignedStaffId));
      if (!staff) {
        return res
          .status(404)
          .json({ success: false, message: "Staff member not found" });
      }
    }

    const newDate = appointmentDate || existing.appointmentDate;
    const newTime = appointmentTime || existing.appointmentTime;
    if (
      newDate !== existing.appointmentDate ||
      newTime !== existing.appointmentTime
    ) {
      const available = await isSlotAvailable(newDate, newTime, duration, id);
      if (!available) {
        return res.status(409).json({
          success: false,
          message: "New time slot conflicts with existing appointment",
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
    if (duration !== existing.durationMinutes)
      updateData.durationMinutes = duration;
    if (assignedStaffId !== undefined)
      updateData.assignedStaffId = assignedStaffId || null;

    const [updated] = await Database.update(Appointments)
      .set(updateData)
      .where(eq(Appointments.id, id))
      .returning();

    // 🔁 Real-time update
    const io = getIo();
    io.emit("appointmentChanged", { type: "updated", appointment: updated });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/appointments/{id}
 * Soft delete – mark as CANCELLED
 */
export const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    const [updated] = await Database.update(Appointments)
      .set({
        status: "CANCELLED",
        notes: notes || existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(Appointments.id, id))
      .returning();

    await logStatusChange(
      id,
      existing.status,
      "CANCELLED",
      notes || "Appointment cancelled",
    );

    // 🔁 Real-time update
    const io = getIo();
    io.emit("appointmentChanged", { type: "cancelled", appointment: updated });

    res.json({
      success: true,
      message: "Appointment cancelled successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/appointments/{id}/status
 * Update appointment status with validation
 */
export const updateAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "status is required" });
    }

    const allowed = [
      "PENDING",
      "CONFIRMED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ];
    if (!allowed.includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowed.join(", ")}`,
      });
    }

    const [existing] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    const newStatus = status.toUpperCase();
    const validTransitions = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["IN_PROGRESS", "PENDING", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED", "CONFIRMED"],
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

    await logStatusChange(id, existing.status, newStatus, notes || null);

    // ----------------------------------------------------------------------
    // 🔔 Push Notifications – only when status changes to CONFIRMED
    // (Optional: also for CANCELLED, UNDER_INSPECTION, etc.)
    // ----------------------------------------------------------------------
    if (newStatus === "CONFIRMED") {
      try {
        // Fetch all push tokens for this customer
        const pushTokens = await Database.select()
          .from(PushTokens)
          .where(eq(PushTokens.customerId, existing.customerId));

        if (pushTokens.length > 0) {
          const tokenList = pushTokens.map((t) => t.token);
          const dateStr = existing.appointmentDate;
          const timeStr = existing.appointmentTime.slice(0, 5); // "HH:MM"
          const title = "Appointment Confirmed";
          const body = `Your appointment on ${dateStr} at ${timeStr} has been confirmed.`;
          // Use a custom sound if you have one, e.g., 'confirmed.wav'
          await sendPushNotification(
            tokenList,
            title,
            body,
            { appointmentId: id },
            "notification_sound.wav",
          );
        }
      } catch (pushError) {
        // Log error but do NOT interrupt the main response flow
        console.error("Push notification failed:", pushError);
      }
    }

    // ----------------------------------------------------------------------
    // 🔁 Real-time update with full joined data (WebSocket)
    // ----------------------------------------------------------------------
    const [fullAppointment] = await Database.select({
      id: Appointments.id,
      customerId: Appointments.customerId,
      vehicleId: Appointments.vehicleId,
      serviceTypeId: Appointments.serviceTypeId,
      assignedStaffId: Appointments.assignedStaffId,
      appointmentDate: Appointments.appointmentDate,
      appointmentTime: Appointments.appointmentTime,
      durationMinutes: Appointments.durationMinutes,
      status: Appointments.status,
      notes: Appointments.notes,
      createdAt: Appointments.createdAt,
      updatedAt: Appointments.updatedAt,
      customer: {
        id: Customers.id,
        fullName: Customers.fullName,
        email: Customers.email,
        phone: Customers.phone,
      },
      vehicle: {
        id: Vehicles.id,
        make: Vehicles.make,
        model: Vehicles.model,
        year: Vehicles.year,
        plateNumber: Vehicles.plateNumber,
      },
      serviceType: {
        id: ServiceTypes.id,
        name: ServiceTypes.name,
        basePrice: ServiceTypes.basePrice,
        durationMinutes: ServiceTypes.durationMinutes,
      },
    })
      .from(Appointments)
      .leftJoin(Customers, eq(Appointments.customerId, Customers.id))
      .leftJoin(Vehicles, eq(Appointments.vehicleId, Vehicles.id))
      .leftJoin(ServiceTypes, eq(Appointments.serviceTypeId, ServiceTypes.id))
      .where(eq(Appointments.id, id));

    const io = getIo();
    io.emit("appointmentChanged", {
      type: "statusChanged",
      appointment: fullAppointment,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/appointments/{id}/status-log
 */
export const getAppointmentStatusLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }
    const statusLogs = await Database.select()
      .from(AppointmentStatusLogs)
      .where(eq(AppointmentStatusLogs.appointmentId, id))
      .orderBy(desc(AppointmentStatusLogs.changedAt));
    res.json({ success: true, data: statusLogs });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/customers/{customerId}/appointments
 */
export const getCustomerAppointments = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 20, status } = req.query;

    const [customer] = await Database.select()
      .from(Customers)
      .where(eq(Customers.id, customerId));
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let query = Database.select()
      .from(Appointments)
      .where(eq(Appointments.customerId, customerId));
    if (status) {
      const validStatuses = [
        "PENDING",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
        });
      }
      query = query.where(eq(Appointments.status, status.toUpperCase()));
    }

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
 * Grouped appointments by date for calendar view
 */
export const getCalendarView = async (req, res, next) => {
  try {
    const { month } = req.query;
    let startDate, endDate;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNum] = month.split("-").map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0);
    } else {
      const today = new Date();
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const startStr = startDate.toISOString().split("T")[0];
    const endStr = endDate.toISOString().split("T")[0];

    const appointments = await Database.select()
      .from(Appointments)
      .where(
        sql`${Appointments.appointmentDate} BETWEEN ${startStr} AND ${endStr}`,
      )
      .where(sql`${Appointments.status} != 'CANCELLED'`)
      .orderBy(Appointments.appointmentDate, Appointments.appointmentTime);

    const calendarData = {};
    appointments.forEach((apt) => {
      const date = apt.appointmentDate;
      if (!calendarData[date]) calendarData[date] = [];
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

/**
 * POST /api/v1/appointments/check-availability
 * Body: { date (YYYY-MM-DD), startTime (HH:MM:SS), serviceTypeId }
 * Returns { available: boolean }
 */
export const checkAvailability = async (req, res, next) => {
  try {
    const { date, startTime, serviceTypeId } = req.body;
    if (!date || !startTime || !serviceTypeId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // 1. Service type existence
    const [serviceType] = await Database.select()
      .from(ServiceTypes)
      .where(eq(ServiceTypes.id, serviceTypeId));
    if (!serviceType) {
      return res
        .status(404)
        .json({ success: false, message: "Service type not found" });
    }
    if (!serviceType.active) {
      return res
        .status(400)
        .json({ success: false, message: "Service type is not active" });
    }

    const duration = serviceType.durationMinutes;

    // 2. Parse time
    const [hour, minute, second] = startTime.split(":").map(Number);
    const slotTime = new Date();
    slotTime.setHours(hour, minute, second || 0);

    // 3. Check if the time is in the past (for today only)
    const todayStr = new Date().toISOString().split("T")[0];
    if (date === todayStr) {
      const now = new Date();
      if (slotTime < now) {
        return res.json({ success: true, available: false });
      }
    }

    // 4. Check shop hours: service must start between 08:00 and 17:00 - duration
    const shopOpen = 8 * 60; // 08:00 in minutes
    const shopClose = 17 * 60; // 17:00 in minutes
    const totalMinutes = hour * 60 + minute;
    if (totalMinutes < shopOpen || totalMinutes + duration > shopClose) {
      return res.json({ success: true, available: false });
    }

    // 5. Check overlapping appointments via existing isSlotAvailable helper
    const available = await isSlotAvailable(date, startTime, duration);
    res.json({ success: true, available });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/appointments/{id}/approve
 * Customer approves the estimate - transition WAITING_FOR_APPROVAL → IN_PROGRESS
 * Creates repair tasks from all completed findings
 */
export const approveEstimate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { excludedFindingIds } = req.body; // Array of finding IDs customer doesn't want

    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (appointment.status !== "WAITING_FOR_APPROVAL") {
      return res.status(400).json({
        success: false,
        message:
          "Appointment must be in WAITING_FOR_APPROVAL status to approve",
      });
    }

    // Update status to IN_PROGRESS
    const [updated] = await Database.update(Appointments)
      .set({ status: "IN_PROGRESS", updatedAt: new Date() })
      .where(eq(Appointments.id, id))
      .returning();

    await logStatusChange(
      id,
      "WAITING_FOR_APPROVAL",
      "IN_PROGRESS",
      "Customer approved the estimate",
    );

    // Mark the ESTIMATE invoice as APPROVED
    await Database.update(Invoices)
      .set({ status: "APPROVED", approvedAt: new Date() })
      .where(
        and(
          eq(Invoices.appointmentId, id),
          eq(Invoices.invoiceType, "ESTIMATE"),
          eq(Invoices.status, "PENDING_APPROVAL"),
        ),
      );

    // Create repair tasks from completed findings that weren't excluded
    // Each repair task gets a copy of the original inspection finding + products as its own findings
    const existingTasks = await Database.select()
      .from(InspectionTasks)
      .where(eq(InspectionTasks.appointmentId, id));

    const excludedSet = new Set(excludedFindingIds || []);
    let order = 0;
    for (const task of existingTasks) {
      if (task.status !== "DONE") continue;
      const findings = await Database.select()
        .from(InspectionFindings)
        .where(eq(InspectionFindings.taskId, task.id));
      for (const finding of findings) {
        if (excludedSet.has(finding.id)) continue;
        const repairTaskTitle = `Working on ${finding.description}`;
        const [repairTask] = await Database.insert(InspectionTasks)
          .values({
            appointmentId: id,
            title: repairTaskTitle,
            status: "PENDING",
            order: order++,
          })
          .returning();

        // Copy the original finding to the repair task so it shows context
        const [repairFinding] = await Database.insert(InspectionFindings)
          .values({
            taskId: repairTask.id,
            description: `[From inspection] ${finding.description}`,
          })
          .returning();

        // Copy the products from the original finding to the repair finding
        const originalProducts = await Database.select()
          .from(InspectionFindingProducts)
          .where(eq(InspectionFindingProducts.findingId, finding.id));
        if (originalProducts.length > 0) {
          await Database.insert(InspectionFindingProducts).values(
            originalProducts.map((p) => ({
              findingId: repairFinding.id,
              inventoryItemId: p.inventoryItemId,
              quantity: p.quantity,
              priceAtTime: p.priceAtTime,
            })),
          );
        }
      }
    }

    // Real-time update via WebSocket
    const io = getIo();
    io.emit("appointmentChanged", {
      type: "statusChanged",
      appointment: updated,
    });
    io.emit("taskChanged", { type: "repairTasksCreated", appointmentId: id });

    res.json({
      success: true,
      data: updated,
      message: "Estimate approved. Moving to In Progress.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/appointments/{id}/reject
 * Customer rejects the estimate - transition WAITING_FOR_APPROVAL → CANCELLED
 */
export const rejectEstimate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Reason is required to reject the estimate",
      });
    }

    const [appointment] = await Database.select()
      .from(Appointments)
      .where(eq(Appointments.id, id));
    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (appointment.status !== "WAITING_FOR_APPROVAL") {
      return res.status(400).json({
        success: false,
        message: "Appointment must be in WAITING_FOR_APPROVAL status to reject",
      });
    }

    const notes = `Customer rejected estimate. Reason: ${reason}`;
    const [updated] = await Database.update(Appointments)
      .set({ status: "CANCELLED", notes, updatedAt: new Date() })
      .where(eq(Appointments.id, id))
      .returning();

    await logStatusChange(id, "WAITING_FOR_APPROVAL", "CANCELLED", notes);

    // Cancel all invoices
    await Database.update(Invoices)
      .set({ status: "CANCELLED", cancelledAt: new Date() })
      .where(eq(Invoices.appointmentId, id));

    // Real-time update
    const io = getIo();
    io.emit("appointmentChanged", { type: "cancelled", appointment: updated });

    res.json({
      success: true,
      data: updated,
      message: "Estimate rejected. Appointment has been cancelled.",
    });
  } catch (error) {
    next(error);
  }
};
