/**
 * Tạo tài khoản admin, hoặc nâng quyền một tài khoản đã có:
 *   npm run create-admin -- --email admin@example.com --password "mat-khau-dai" [--name "Quản trị"]
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    password: { type: "string" },
    name: { type: "string", default: "Quản trị" },
  },
});

async function main() {
  const email = values.email?.trim().toLowerCase();
  if (!email) throw new Error("Thiếu --email");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    await db.user.update({
      where: { email },
      data: { role: "ADMIN", ...(values.password ? { passwordHash: await hashPassword(values.password) } : {}) },
    });
    console.log(`Đã cấp quyền admin cho ${email}`);
    return;
  }
  if (!values.password || values.password.length < 8) throw new Error("Cần --password tối thiểu 8 ký tự cho tài khoản mới");
  await db.user.create({
    data: { email, name: values.name!, role: "ADMIN", passwordHash: await hashPassword(values.password) },
  });
  console.log(`Đã tạo admin ${email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
