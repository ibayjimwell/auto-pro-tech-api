import { Database } from "../database/drizzle.js";
import { Vehicles, Customers } from "../models/index.js";
import { eq, and } from "drizzle-orm";

export const createVehicle = async (req, res, next) => {
  try {
    const { customerId, plateNumber, make, model, year } = req.body;

    // check if customer exists
    const [customer] = await Database.select()
      .from(Customers)
      .where(eq(Customers.id, customerId));
    if (!customer) {
      return res
        .status(404)
        .json({ success: false, message: "Customer not found" });
    }

    // check plate uniqueness
    const [existing] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.plateNumber, plateNumber));
    if (existing) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Vehicle with this plate number already exists",
        });
    }

    const [vehicle] = await Database.insert(Vehicles)
      .values({
        customerId,
        plateNumber,
        make,
        model,
        year,
      })
      .returning();

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

export const getVehicles = async (req, res, next) => {
  try {
    const vehicles = await Database.select().from(Vehicles);
    res.json({ success: true, data: vehicles });
  } catch (error) {
    next(error);
  }
};

export const getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [vehicle] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.id, id));
    if (!vehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found" });
    }
    res.json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

export const getVehiclesByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const vehicles = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.customerId, customerId));
    res.json({ success: true, data: vehicles });
  } catch (error) {
    next(error);
  }
};

export const updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customerId, plateNumber, make, model, year } = req.body;

    // check if vehicle exists
    const [existingVehicle] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.id, id));
    if (!existingVehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found" });
    }

    // check if customer exists if provided
    if (customerId) {
      const [customer] = await Database.select()
        .from(Customers)
        .where(eq(Customers.id, customerId));
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }
    }

    // check plate uniqueness if changed
    if (plateNumber && plateNumber !== existingVehicle.plateNumber) {
      const [plateExisting] = await Database.select()
        .from(Vehicles)
        .where(eq(Vehicles.plateNumber, plateNumber));
      if (plateExisting) {
        return res
          .status(409)
          .json({
            success: false,
            message: "Vehicle with this plate number already exists",
          });
      }
    }

    const [vehicle] = await Database.update(Vehicles)
      .set({
        customerId: customerId || existingVehicle.customerId,
        plateNumber: plateNumber || existingVehicle.plateNumber,
        make: make || existingVehicle.make,
        model: model || existingVehicle.model,
        year: year !== undefined ? year : existingVehicle.year,
      })
      .where(eq(Vehicles.id, id))
      .returning();

    res.json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

export const deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [vehicle] = await Database.select()
      .from(Vehicles)
      .where(eq(Vehicles.id, id));
    if (!vehicle) {
      return res
        .status(404)
        .json({ success: false, message: "Vehicle not found" });
    }

    await Database.delete(Vehicles).where(eq(Vehicles.id, id));
    res.json({ success: true, message: "Vehicle deleted" });
  } catch (error) {
    next(error);
  }
};
