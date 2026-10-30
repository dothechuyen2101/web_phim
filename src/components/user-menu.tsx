import Link from "next/link";
import { HistorySync } from "@/components/history-sync";
import { UserDropdown } from "@/components/user-dropdown";
import { getSession } from "@/lib/auth";

export async function UserMenu() {
  const session = await getSession();
  if (!session) {
    return (
      <Link href="/dang-nhap" className="btn btn-primary px-3! py-1.5!">
        Đăng nhập
      </Link>
    );
  }
  return (
    <>
      <HistorySync />
      <UserDropdown name={session.name} isAdmin={session.role === "ADMIN"} />
    </>
  );
}
