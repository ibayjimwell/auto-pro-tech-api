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

const router = Router();

router.get('/available-slots', getAvailableSlots);
router.post('/', createAppointment);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.put('/:id', updateAppointment);
router.delete('/:id', cancelAppointment);
router.patch('/:id/status', updateAppointmentStatus);

export default router;