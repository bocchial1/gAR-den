import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db";

export type GardenCredentials = {
  email?: string;
  password?: string;
};

export async function authorizeGardenUser(
  credentials: GardenCredentials,
): Promise<{ id: string; email: string } | null> {
  const email = credentials.email?.trim();
  const password = credentials.password;

  if (!email || !password) {
    return null;
  }

  const user = await getPrisma().user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  const matchesPassword = await bcrypt.compare(password, user.passwordHash);

  if (!matchesPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
  };
}
