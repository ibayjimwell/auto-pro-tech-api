import { updateAppointmentStatus, getStatusLogs, getAppointmentsByStatus } from '../services/statusTrackingService.js';
import { getIo } from '../websocket.js';
import { Database } from '../database/drizzle.js';
import {
  Appointments,
  Customers,
  Vehicles,
  ServiceTypes,
} from '../models/index.js';
import { eq } from 'drizzle-orm';

export const patchAppointmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, changedByStaffId, invoiceAmount, invoiceDetails } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }

    const result = await updateAppointmentStatus(id, status, changedByStaffId, notes, invoiceAmount, invoiceDetails);

    const io = getIo();
    if (io) {
      // Emit statusUpdate to the appointment room (for System listening)
      io.to(`appointment:${id}`).emit('statusUpdate', {
        appointment: result.appointment,
        statusLog: result.statusLog,
      });

      // Also emit appointmentChanged (global) so the Mobile app picks it up
      // Fetch full joined data for the mobile app to display correctly
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

      io.emit('appointmentChanged', { type: 'statusChanged', appointment: fullAppointment });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAppointmentStatusLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const logs = await getStatusLogs(id);
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};

export const getTrackingAppointments = async (req, res, next) => {
  try {
    const { status } = req.query;

    if (!status) {
      return res.status(400).json({ success: false, message: 'status query parameter is required' });
    }

    const appointments = await getAppointmentsByStatus(status);
    res.json({ success: true, data: appointments });
  } catch (error) {
    next(error);
  }
};