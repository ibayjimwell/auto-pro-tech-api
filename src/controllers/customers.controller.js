import { Database } from '../database/drizzle.js';
import { Customers } from '../models/index.js';
import { eq, ilike, or } from 'drizzle-orm';
import bcrypt from 'bcrypt'; // for production

export const createCustomer = async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Check if customer already exists by email or phone
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

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        type: 'W-MissingFields',
        message: 'fullName, email, phone, and password are required',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [customer] = await Database
      .insert(Customers)
      .values({ fullName, email, phone, password: hashedPassword })
      .returning();

    // Remove password from response
    const { password: _, ...customerWithoutPassword } = customer;

    res.status(201).json({
      success: true,
      message: 'Customer created',
      data: customerWithoutPassword,
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
    // Remove passwords from all customers
    const customersWithoutPassword = result.map(({ password, ...rest }) => rest);
    res.json({ success: true, data: customersWithoutPassword });
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
    const { password, ...customerWithoutPassword } = customer;
    res.json({ success: true, data: customerWithoutPassword });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, password } = req.body;

    // Fetch existing to ensure it exists
    const [existing] = await Database
      .select()
      .from(Customers)
      .where(eq(Customers.id, id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        type: 'W-NotFound',
        message: 'Customer not found',
      });
    }

    // Prepare update object
    const updateData = {
      fullName: fullName !== undefined ? fullName : existing.fullName,
      email: email !== undefined ? email : existing.email,
      phone: phone !== undefined ? phone : existing.phone,
      updatedAt: new Date(),
    };
    if (password) {
      // Hash new password if provided
      updateData.password = await bcrypt.hash(password, 10);
    }

    const [updated] = await Database
      .update(Customers)
      .set(updateData)
      .where(eq(Customers.id, id))
      .returning();

    const { password: _, ...customerWithoutPassword } = updated;
    res.json({
      success: true,
      message: 'Customer updated',
      data: customerWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};