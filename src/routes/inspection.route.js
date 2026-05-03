import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  addFinding,
  deleteFinding,
  addProduct,
  deleteProduct,
  completeInspection,
} from '../controllers/inspection.controller.js';

const inspectionRouter = Router();
// Tasks
inspectionRouter.get('/appointments/:appointmentId/tasks', getTasks);
inspectionRouter.post('/appointments/:appointmentId/tasks', createTask);
inspectionRouter.put('/tasks/:id', updateTask);
inspectionRouter.delete('/tasks/:id', deleteTask);

// Findings
inspectionRouter.post('/tasks/:taskId/findings', addFinding);
inspectionRouter.delete('/findings/:id', deleteFinding);

// Products
inspectionRouter.post('/tasks/:taskId/products', addProduct);
inspectionRouter.delete('/products/:id', deleteProduct);

// Complete inspection
inspectionRouter.post('/appointments/:appointmentId/complete-inspection', completeInspection);

export default inspectionRouter;