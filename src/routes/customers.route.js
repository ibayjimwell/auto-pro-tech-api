import { Router } from 'express';
import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
} from '../controllers/customers.controller.js';

const customersRouter = Router();

customersRouter.post('/', createCustomer);
customersRouter.get('/', getCustomers);
customersRouter.get('/:id', getCustomerById);
customersRouter.put('/:id', updateCustomer);

export default customersRouter;