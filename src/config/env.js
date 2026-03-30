import dotenv from 'dotenv';
dotenv.config();

export const {
  PORT = 4000,
  NODE_ENV = 'development',
  DATABASE_URL
} = process.env;