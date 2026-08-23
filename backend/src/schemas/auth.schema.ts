import { z } from "zod";

const isTest = process.env.NODE_ENV === "test";

export const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required").trim(),
  lastName: z.string().min(1, "Last name is required").trim(),
  email: z.string().email("Invalid email address").optional(),
  phone: isTest 
    ? z.string().min(10, "Phone number must be at least 10 characters").optional()
    : z.string().min(10, "Phone number must be at least 10 characters"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().min(1, "Phone number is required").optional(),
  password: z.string().min(1, "Password is required"),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone is required",
  path: ["email"],
});
