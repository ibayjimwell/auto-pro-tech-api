import { Router } from 'express';
import customersRouter from './customers.route.js';
import appointmentsRouter from './appointments.route.js';

const router = Router();

router.use('/customers', customersRouter);
router.use('/appointments', appointmentsRouter);

export default router;