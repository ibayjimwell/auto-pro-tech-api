import { Router } from 'express';
import {
  getAvailableSlots,
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  getCustomerAppointments,
  getCalendarView,
  checkAvailability,
} from '../controllers/appointments.controller.js';
import {
  patchAppointmentStatus,
  getAppointmentStatusLog,
  getTrackingAppointments,
} from '../controllers/statusTracking.controller.js';

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
appointmentsRouter.patch('/:id/status', patchAppointmentStatus);
appointmentsRouter.get('/:id/status-log', getAppointmentStatusLog);

// Optional staff dashboard
appointmentsRouter.get('/tracking', getTrackingAppointments);

// Checking
appointmentsRouter.post('/check-availability', checkAvailability);

export default appointmentsRouter;