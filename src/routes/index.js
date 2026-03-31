import { Router } from 'express';
import customersRouter from './customers.route.js';
import appointmentsRouter from './appointments.route.js';
import serviceTypesRouter from './service-types.route.js';

const router = Router();

router.use('/customers', customersRouter);
router.use('/appointments', appointmentsRouter);
router.use('/service-types', serviceTypesRouter);

export default router;