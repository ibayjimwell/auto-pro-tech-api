import { Router } from "express";
import {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} from "../controllers/staff.controller.js";

const staffRouter = Router();

staffRouter.post("/", createStaff);
staffRouter.get("/", getStaff);
staffRouter.get("/:id", getStaffById);
staffRouter.put("/:id", updateStaff);
staffRouter.delete("/:id", deleteStaff);

export default staffRouter;
