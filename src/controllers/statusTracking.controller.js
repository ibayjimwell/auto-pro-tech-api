import { updateAppointmentStatus, getStatusLogs, getAppointmentsByStatus } from '../services/statusTrackingService.js';
import { getIo } from '../websocket.js';

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
      io.to(`appointment:${id}`).emit('statusUpdate', {
        appointment: result.appointment,
        statusLog: result.statusLog,
      });
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