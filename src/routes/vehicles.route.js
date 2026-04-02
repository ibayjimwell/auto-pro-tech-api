import { Router } from "express";
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  getVehiclesByCustomer,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicle.controller.js";

const vehiclesRouter = Router();

vehiclesRouter.post("/", createVehicle);
vehiclesRouter.get("/", getVehicles);
vehiclesRouter.get("/:id", getVehicleById);
vehiclesRouter.get("/customer/:customerId", getVehiclesByCustomer);
vehiclesRouter.put("/:id", updateVehicle);
vehiclesRouter.delete("/:id", deleteVehicle);

export default vehiclesRouter;
