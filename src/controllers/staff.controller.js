import { Database } from "../database/drizzle.js";
import { Staff } from "../models/index.js";
import { eq, ilike, or } from "drizzle-orm";
import bcrypt from "bcrypt"; 

export const createStaff = async (req, res, next) => {
  try {
    const { fullName, username, password, role, active } = req.body;

    // Check if staff already exists by username
    const [existing] = await Database.select()
      .from(Staff)
      .where(eq(Staff.username, username));
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Staff with this username already exists",
      });
    }

    if (!fullName || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "fullName, username and password are required",
      });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 10);

    const [staff] = await Database.insert(Staff)
      .values({
        fullName,
        username,
        password: hashedPassword,
        role: role || null,
        active: active !== undefined ? active : true,
      })
      .returning();

    // Remove password from response
    const { password: _, ...staffWithoutPassword } = staff;

    res.status(201).json({
      success: true,
      message: "Staff created",
      data: staffWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const getStaff = async (req, res, next) => {
  try {
    const { search, active } = req.query;
    let query = Database.select().from(Staff);

    if (search) {
      query = query.where(
        or(
          ilike(Staff.fullName, `%${search}%`),
          ilike(Staff.username, `%${search}%`),
        ),
      );
    }

    if (active !== undefined) {
      query = query.where(eq(Staff.active, active === "true"));
    }

    const staffList = await query;
    // Remove passwords from each staff object
    const staffWithoutPasswords = staffList.map(({ password, ...staff }) => staff);
    res.json({
      success: true,
      data: staffWithoutPasswords,
    });
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [staff] = await Database.select().from(Staff).where(eq(Staff.id, id));
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }
    const { password, ...staffWithoutPassword } = staff;
    res.json({
      success: true,
      data: staffWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, username, password, role, active } = req.body;

    const [existingStaff] = await Database.select()
      .from(Staff)
      .where(eq(Staff.id, id));
    if (!existingStaff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Check username uniqueness if changed
    if (username && username !== existingStaff.username) {
      const [usernameExisting] = await Database.select()
        .from(Staff)
        .where(eq(Staff.username, username));
      if (usernameExisting) {
        return res.status(409).json({
          success: false,
          message: "Staff with this username already exists",
        });
      }
    }

    let updatedPassword = existingStaff.password;
    if (password) {
      // Hash new password
      updatedPassword = await bcrypt.hash(password, 10);
      
    }

    const [staff] = await Database.update(Staff)
      .set({
        fullName: fullName || existingStaff.fullName,
        username: username || existingStaff.username,
        password: updatedPassword,
        role: role !== undefined ? role : existingStaff.role,
        active: active !== undefined ? active : existingStaff.active,
      })
      .where(eq(Staff.id, id))
      .returning();

    const { password: _, ...staffWithoutPassword } = staff;
    res.json({
      success: true,
      message: "Staff updated",
      data: staffWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [staff] = await Database.select().from(Staff).where(eq(Staff.id, id));
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    await Database.delete(Staff).where(eq(Staff.id, id));
    res.json({
      success: true,
      message: "Staff deleted",
    });
  } catch (error) {
    next(error);
  }
};