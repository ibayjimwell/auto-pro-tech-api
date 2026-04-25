import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT = 4000,
  NODE_ENV = 'development',
  DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRES_IN,
} = process.env;