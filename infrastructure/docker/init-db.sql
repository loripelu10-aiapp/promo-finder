-- Initial database setup for PromoFinder
-- This file is executed when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE promofinder TO promofinder;

-- Set timezone
SET timezone = 'UTC';

-- Create initial schema (for future Prisma migrations)
-- Tables will be created by Prisma migrations
