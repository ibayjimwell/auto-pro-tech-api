import { Router } from 'express';
import {
  getAvailableSlots,
  createAppointment,
  getAppointments,
  getAppointmentById,
  updateAppointment,
  cancelAppointment,
  updateAppointmentStatus,
} from '../controllers/appointments.controller.js';

const appointmentsRouter = Router();

appointmentsRouter.get('/available-slots', getAvailableSlots);
appointmentsRouter.post('/', createAppointment);
appointmentsRouter.get('/', getAppointments);
appointmentsRouter.get('/:id', getAppointmentById);
appointmentsRouter.put('/:id', updateAppointment);
appointmentsRouter.delete('/:id', cancelAppointment);
appointmentsRouter.patch('/:id/status', updateAppointmentStatus);

export default appointmentsRouter;