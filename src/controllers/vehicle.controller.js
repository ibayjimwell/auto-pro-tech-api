import { Database } from '../database/drizzle.js';
import { Vehicles, Customers } from '../models/index.js';
import { eq, and } from 'drizzle-orm';

export const createVehicle = async (req, res, next) => {
  try {
    const { customerId, plateNumber, make, model, year } = req.body;

    // check if customer exists
    const [customer] = await Database.select().from(Customers).where(eq(Customers.id, customerId));
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // check plate uniqueness
    const [existing] = await Database.select().from(Vehicles).where(eq(Vehicles.plateNumber, plateNumber));
    if (existing) {
      return res.status(409).json({ success: false, message: 'Vehicle with this plate number already exists' });
    }

    const [vehicle] = await Database.insert(Vehicles).values({
      customerId,
      plateNumber,
      make,
      model,
      year,
    }).returning();

    res.status(201).json({ success: true, data: vehicle });
  } catch (error) {
    next(error);
  }
};

export const getVehiclesByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const vehicles = await Database.select().from(Vehicles).where(eq(Vehicles.customerId, customerId));
    res.json({ success: true, data: vehicles });
  } catch (error) {
    next(error);
  }
};

// ... other CRUD