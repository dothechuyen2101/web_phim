"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { STATUS_PARAMS, TYPE_PARAMS, type FilterKey } from "@/lib/filters";
import { SORT_OPTIONS } from "@/lib/site";
import { cn } from "@/lib/utils";

interface Options {
  genres: { slug: string; name: string }[];
  countries: { slug: string; name: string }[];
  years: number[];
}

export function FilterBar({
  options,
  values,
  hide = [],
}: {
  options: Options;
  values: Record<string, string | undefined>;
  hide?: FilterKey[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = (key: FilterKey, value: string) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...values, [key]: value })) if (v && k !== "trang") search.set(k, v);
    const qs = search.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const selects: { key: FilterKey; label: string; items: [string, string][] }[] = [
    { key: "loai", label: "Loại phim", items: Object.entries(TYPE_PARAMS).map(([k, v]) => [k, v.label]) },
    { key: "the-loai", label: "Thể loại", items: options.genres.map((g) => [g.slug, g.name]) },
    { key: "quoc-gia", label: "Quốc gia", items: options.countries.map((c) => [c.slug, c.name]) },
    { key: "nam", label: "Năm", items: options.years.map((y) => [String(y), String(y)]) },
    { key: "trang-thai", label: "Trạng thái", items: Object.entries(STATUS_PARAMS).map(([k, v]) => [k, v.label]) },
  ];

  return (
    <div className={cn("glass mb-8 flex flex-wrap items-center gap-2 rounded-2xl p-3 transition-opacity duration-300", pending && "opacity-60")}>
      <span className="grid size-8 place-items-center rounded-lg bg-accent/15 text-accent">
        <SlidersHorizontal className={cn("size-4", pending && "animate-pulse")} aria-hidden />
      </span>
      {selects
        .filter((s) => !hide.includes(s.key))
        .map((s) => (
          <select
            key={s.key}
            aria-label={s.label}
            value={values[s.key] ?? ""}
            onChange={(event) => update(s.key, event.target.value)}
            className="field w-auto! min-w-32 flex-1 py-1.5! sm:flex-none"
          >
            <option value="">{s.label}: Tất cả</option>
            {s.items.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ))}
      <select
        aria-label="Sắp xếp"
        value={values["sap-xep"] ?? ""}
        onChange={(event) => update("sap-xep", event.target.value)}
        className="field w-auto! min-w-32 flex-1 py-1.5! sm:ml-auto sm:flex-none"
      >
        {Object.entries(SORT_OPTIONS).map(([value, label]) => (
          <option key={value} value={value === "moi" ? "" : value}>
            Sắp xếp: {label}
          </option>
        ))}
      </select>
    </div>
  );
}
