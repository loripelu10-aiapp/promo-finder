-- Add footlocker and decathlon to ProductSource enum
ALTER TYPE "ProductSource" ADD VALUE IF NOT EXISTS 'footlocker';
ALTER TYPE "ProductSource" ADD VALUE IF NOT EXISTS 'decathlon';
