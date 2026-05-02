import { Expo } from 'expo-server-sdk';

let expo = new Expo();

/**
 * Send a push notification to one or more Expo push tokens.
 * @param {string[]} tokens - Array of Expo push tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data (e.g., appointmentId)
 * @param {string} sound - Custom sound file name (e.g., 'confirmed.wav')
 */
export async function sendPushNotification(tokens, title, body, data = {}, sound = 'default') {
  const messages = [];
  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.error(`Invalid Expo push token: ${token}`);
      continue;
    }
    messages.push({
      to: token,
      sound,
      title,
      body,
      data,
    });
  }

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }
}