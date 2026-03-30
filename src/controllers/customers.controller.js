import { Database } from '../database/drizzle.js';
import { Customers } from '../models/index.js';
import { eq, ilike, or } from 'drizzle-orm';

export const createCustomer = async (req, res, next) => {
  try {
    const { fullName, email, phone } = req.body;

    // Check if customer already exists by email or phone
    if (email || phone) {
      const [existing] = await Database
        .select()
        .from(Customers)
        .where(
          or(
            email ? eq(Customers.email, email) : undefined,
            phone ? eq(Customers.phone, phone) : undefined
          )
        );
      if (existing) {
        return res.status(409).json({
          success: false,
          type: 'W-CustomerExists',
          message: 'Customer with this email or phone already exists',
          data: existing,
        });
      }
    }

    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        type: 'W-MissingFields',
        message: 'fullName, email, and phone are required',
      });
    }

    const [customer] = await Database
      .insert(Customers)
      .values({ fullName, email, phone })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Customer created',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = Database.select().from(Customers);
    if (search) {
      query = query.where(
        or(
          ilike(Customers.fullName, `%${search}%`),
          ilike(Customers.email, `%${search}%`),
          ilike(Customers.phone, `%${search}%`)
        )
      );
    }
    const result = await query;
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [customer] = await Database
      .select()
      .from(Customers)
      .where(eq(Customers.id, id));

    if (!customer) {
      return res.status(404).json({
        success: false,
        type: 'W-NotFound',
        message: 'Customer not found',
      });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone } = req.body;

    const [updated] = await Database
      .update(Customers)
      .set({ fullName, email, phone, updatedAt: new Date() })
      .where(eq(Customers.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        type: 'W-NotFound',
        message: 'Customer not found',
      });
    }
    res.json({
      success: true,
      message: 'Customer updated',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};