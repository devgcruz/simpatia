import * as dotenv from 'dotenv';
dotenv.config();

export default {
  schema: "./prisma/schema.prisma",
  datasourceProvider: "postgresql",
};
