import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/models/index.js",
    out: "./src/database/migrations",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});