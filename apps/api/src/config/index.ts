// Author(s): Kaitlyn Clevidence
// Start date: 2024-06-05
// Last updated: 2024-06-05
// P4: Prototype 
// Purpose: only file that reads env variables; fails if something is missing 

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const config = {
  db: {
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
  },
  port: Number(process.env.API_PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};