import { Database } from '../database/drizzle.js';
import { Customers, Staff } from '../models/index.js';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config/env.js';

// Helper to generate JWT
const generateToken = (customer) => {
  return jwt.sign(
    { id: customer.id, email: customer.email, role: 'customer' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Helper to generate JWT for staff
const generateStaffToken = (staff) => {
  return jwt.sign(
    { id: staff.id, username: staff.username, role: staff.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// POST /api/v1/auth/register (alternative to /customers, but returns token)
export const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Check if customer exists
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
        message: 'Customer with this email or phone already exists',
      });
    }

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [customer] = await Database
      .insert(Customers)
      .values({ fullName, email, phone, password: hashedPassword })
      .returning();

    const token = generateToken(customer);
    const { password: _, ...customerData } = customer;

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: customerData,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/login
export const login = async (req, res, next) => {
  try {
    const { emailOrPhone, password } = req.body;

    if (!emailOrPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/Phone and password are required',
      });
    }

    // Find by email or phone
    const [customer] = await Database
      .select()
      .from(Customers)
      .where(
        or(
          eq(Customers.email, emailOrPhone),
          eq(Customers.phone, emailOrPhone)
        )
      );

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, customer.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = generateToken(customer);
    const { password: _, ...customerData } = customer;

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: customerData,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/me (get current authenticated user)
export const getMe = async (req, res, next) => {
  try {
    // req.user set by authenticate middleware
    const [customer] = await Database
      .select()
      .from(Customers)
      .where(eq(Customers.id, req.user.id));

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    const { password, ...customerData } = customer;
    res.json({ success: true, data: customerData });
  } catch (error) {
    next(error);
  }
};

export const staffLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const [staff] = await Database
      .select()
      .from(Staff)
      .where(eq(Staff.username, username));

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, staff.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (!staff.active) {
      return res.status(401).json({
        success: false,
        message: 'Account is disabled. Please contact administrator.',
      });
    }

    // --- FIX: Parse permissions if it's a string ---
    let permissions = staff.permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (e) {
        permissions = [];
      }
    }
    if (!Array.isArray(permissions)) permissions = [];

    // Check if temporary password is active
    let needsReset = false;
    let resetToken = null;
    if (staff.tempPassword && staff.tempExpiresAt > new Date()) {
      needsReset = true;
      // Short‑lived token for password reset (15 minutes)
      resetToken = jwt.sign(
        { id: staff.id, type: 'staff-reset' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
    }

    const token = needsReset ? null : generateStaffToken(staff);

    res.json({
      success: true,
      needsReset,
      resetToken,
      token,
      staff: {
        id: staff.id,
        fullName: staff.fullName,
        username: staff.username,
        role: staff.role,
        permissions: permissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const setNewStaffPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    if (decoded.type !== 'staff-reset') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const [staff] = await Database
      .select()
      .from(Staff)
      .where(eq(Staff.id, decoded.id));

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    if (!staff.tempPassword || staff.tempExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'No active temporary password request. Please request a new reset from admin.',
      });
    }

    const hashedNew = await bcrypt.hash(newPassword, 10);
    await Database.update(Staff)
      .set({
        password: hashedNew,
        tempPassword: false,
        tempExpiresAt: null,
      })
      .where(eq(Staff.id, staff.id));

    res.json({
      success: true,
      message: 'Password updated successfully. Please login again.',
    });
  } catch (error) {
    next(error);
  }
};