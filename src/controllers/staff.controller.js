import { Database } from "../database/drizzle.js";
import { Staff } from "../models/index.js";
import { eq, ilike, or } from "drizzle-orm";

export const createStaff = async (req, res, next) => {
  try {
    const { fullName, email, role, active } = req.body;

    // Check if staff already exists by email
    const [existing] = await Database.select()
      .from(Staff)
      .where(eq(Staff.email, email));
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Staff with this email already exists",
      });
    }

    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "fullName and email are required",
      });
    }

    const [staff] = await Database.insert(Staff)
      .values({
        fullName,
        email,
        role: role || null,
        active: active !== undefined ? active : true,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Staff created",
      data: staff,
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
          ilike(Staff.email, `%${search}%`),
        ),
      );
    }

    if (active !== undefined) {
      query = query.where(eq(Staff.active, active === "true"));
    }

    const staff = await query;
    res.json({
      success: true,
      data: staff,
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
    res.json({
      success: true,
      data: staff,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, active } = req.body;

    // Check if staff exists
    const [existingStaff] = await Database.select()
      .from(Staff)
      .where(eq(Staff.id, id));
    if (!existingStaff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    // Check email uniqueness if changed
    if (email && email !== existingStaff.email) {
      const [emailExisting] = await Database.select()
        .from(Staff)
        .where(eq(Staff.email, email));
      if (emailExisting) {
        return res.status(409).json({
          success: false,
          message: "Staff with this email already exists",
        });
      }
    }

    const [staff] = await Database.update(Staff)
      .set({
        fullName: fullName || existingStaff.fullName,
        email: email || existingStaff.email,
        role: role !== undefined ? role : existingStaff.role,
        active: active !== undefined ? active : existingStaff.active,
      })
      .where(eq(Staff.id, id))
      .returning();

    res.json({
      success: true,
      message: "Staff updated",
      data: staff,
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
