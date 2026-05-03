import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { getItems, getItemById, createItem, updateItem, deleteItem, deductStock } from '../controllers/inventory.controller.js';

const inventoryRouter = Router();

inventoryRouter.get('/', getItems);
inventoryRouter.get('/:id', getItemById);
inventoryRouter.post('/', createItem);
inventoryRouter.put('/:id', updateItem);
inventoryRouter.delete('/:id', deleteItem);
inventoryRouter.post('/:id/deduct', deductStock);

export default inventoryRouter;