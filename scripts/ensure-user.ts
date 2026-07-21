import bcrypt from "bcryptjs";
import { getPrisma } from "../src/lib/db";

export async function ensureGardenUser(): Promise<void> {
  const email = process.env.GARDEN_USER_EMAIL;
  const password = process.env.GARDEN_USER_PASSWORD;

  if (!email || !password) {
    throw new Error("GARDEN_USER_EMAIL and GARDEN_USER_PASSWORD are required");
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  await getPrisma().user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
}

if (require.main === module) {
  ensureGardenUser().then(() => process.exit(0));
}
