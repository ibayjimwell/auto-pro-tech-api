import { Router } from 'express';
import {
  getAvailableSlots,
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  updateAppointmentStatus,
  getAppointmentStatusLog,
  getCustomerAppointments,
  getCalendarView,
} from '../controllers/appointments.controller.js';

const appointmentsRouter = Router();

// Special routes (must come before /:id pattern)
appointmentsRouter.get('/available-slots', getAvailableSlots);
appointmentsRouter.get('/calendar', getCalendarView);

// CRUD operations
appointmentsRouter.post('/', createAppointment);
appointmentsRouter.get('/', getAppointments);
appointmentsRouter.get('/:id', getAppointmentById);
appointmentsRouter.put('/:id', updateAppointment);
appointmentsRouter.delete('/:id', cancelAppointment);

// Status management
appointmentsRouter.patch('/:id/status', updateAppointmentStatus);
appointmentsRouter.get('/:id/status-log', getAppointmentStatusLog);

export default appointmentsRouter;