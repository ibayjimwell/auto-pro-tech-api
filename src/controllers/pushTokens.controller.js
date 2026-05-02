import { Database } from '../database/drizzle.js';
import { PushTokens } from '../models/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/v1/push-tokens
 * Save or update a push token for the authenticated customer.
 * Body: { token, platform (optional) }
 */
export const savePushToken = async (req, res, next) => {
  try {
    const customerId = req.user.id; // from auth middleware
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Check if token already exists for this customer
    const [existing] = await Database
      .select()
      .from(PushTokens)
      .where(
        and(
          eq(PushTokens.token, token),
          eq(PushTokens.customerId, customerId)
        )
      );

    if (existing) {
      // Update updatedAt
      await Database.update(PushTokens)
        .set({ updatedAt: new Date() })
        .where(eq(PushTokens.id, existing.id));
      return res.json({ success: true, message: 'Token updated' });
    }

    // Insert new token
    await Database.insert(PushTokens).values({
      customerId,
      token,
      platform: platform || null,
    });

    res.status(201).json({ success: true, message: 'Push token saved' });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/push-tokens
 * Remove a push token for the authenticated customer.
 * Body: { token }
 */
export const deletePushToken = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    await Database.delete(PushTokens)
      .where(
        and(
          eq(PushTokens.token, token),
          eq(PushTokens.customerId, customerId)
        )
      );

    res.json({ success: true, message: 'Push token removed' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/push-tokens
 * Get all push tokens for the authenticated customer.
 */
export const getPushTokens = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const tokens = await Database
      .select()
      .from(PushTokens)
      .where(eq(PushTokens.customerId, customerId));

    res.json({ success: true, data: tokens });
  } catch (error) {
    next(error);
  }
};