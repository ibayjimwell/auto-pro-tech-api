import { Router } from 'express';
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  getCustomerStats,
} from '../controllers/customers.controller.js';
import { getCustomerAppointments } from '../controllers/appointments.controller.js';

const customersRouter = Router();

customersRouter.post('/', createCustomer);
customersRouter.get('/', getCustomers);
customersRouter.get('/:id', getCustomerById);
customersRouter.get('/:id/appointments', getCustomerAppointments);
customersRouter.get('/:id/stats', getCustomerStats);
customersRouter.put('/:id', updateCustomer);

export default customersRouter;