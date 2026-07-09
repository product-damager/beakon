"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRoadmap } from "@/lib/store";
import { applyFilters } from "@/lib/filters";
import { formatShortEN, quarterLabelFromISO } from "@/lib/dates";
import {
  CONFIDENCE_META,
  priorityScore,
  STATUSES,
  THEME_COLOR_META,
  type Initiative,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import { Avatar, StatusTag } from "./ui";
import { FilterBar } from "./FilterBar";

type SortKey = "title" | "owner" | "team" | "theme" | "status" | "quarter" | "priority" | "confidence" | "updated";

const CONF_ORDER = { low: 0, medium: 1, high: 2 };

export function List() {
  const { initiatives, filters, themes, owners, getOwner, getTheme, select } = useRoadmap();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "priority", dir: -1 });

  const filtered = useMemo(
    () => applyFilters(initiatives, filters, themes, owners),
    [initiatives, filters, themes, owners]
  );

  const sorted = useMemo(() => {
    const val = (i: Initiative): string | number => {
      switch (sort.key) {
        case "title": return i.title.toLowerCase();
        case "owner": return getOwner(i.ownerId)?.name.toLowerCase() ?? "";
        case "team": return i.team.toLowerCase();
        case "theme": return getTheme(i.themeId)?.name.toLowerCase() ?? "";
        case "status": return STATUSES.indexOf(i.status);
        case "quarter": return i.targetStart;
        case "priority": return priorityScore(i.scores);
        case "confidence": return CONF_ORDER[i.confidence];
        case "updated": return i.updatedAt;
      }
    };
    return [...filtered].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * sort.dir;
      if (av > bv) return 1 * sort.dir;
      return 0;
    });
  }, [filtered, sort, getOwner, getTheme]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const Th = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" | "center" }) => (
    <th className={cn("sticky top-0 z-10 bg-beige-5 px-3 py-0", align === "right" && "text-right", align === "center" && "text-center")}>
      <button
        onClick={() => toggle(k)}
        className={cn(
          "mono-label flex h-10 items-center gap-1 text-beige-60 hover:text-green-90",
          align === "right" && "ml-auto",
          align === "center" && "mx-auto"
        )}
      >
        {label}
        {sort.key === k && (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}
      </button>
    </th>
  );

  return (
    <div className="flex h-full flex-col">
      <FilterBar />
      <div className="calm-scroll flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-beige-20">
              <Th k="title" label="Initiative" />
              <Th k="owner" label="Owner" />
              <Th k="team" label="Team" />
              <Th k="status" label="Status" />
              <Th k="quarter" label="Quarter" />
              <Th k="priority" label="Score" align="right" />
              <Th k="confidence" label="Confidence" />
              <Th k="updated" label="Updated" align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => {
              const owner = getOwner(i.ownerId);
              const theme = getTheme(i.themeId);
              return (
                <tr
                  key={i.id}
                  onClick={() => select(i.id)}
                  className="cursor-pointer border-b border-beige-10 hover:bg-beige-5"
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {theme && (
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", THEME_COLOR_META[theme.color].dot)} />
                      )}
                      <span className="font-medium text-green-90">{i.title}</span>
                      {i.visibility === "external" && (
                        <span className="mono-label-sm rounded bg-green-10 px-1.5 py-0.5 text-green-70">Ext</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2 text-green-90">
                      {owner && <Avatar name={owner.name} className="h-6 w-6 text-[10px]" />}
                      <span className="whitespace-nowrap">{owner?.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-green-70">{i.team}</td>
                  <td className="px-3 py-2.5"><StatusTag status={i.status} /></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-green-70">
                    {quarterLabelFromISO(i.targetStart)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-display font-semibold text-green-90">
                    {priorityScore(i.scores)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn("mono-label rounded-md px-2 py-1", CONFIDENCE_META[i.confidence].tag)}>
                      {CONFIDENCE_META[i.confidence].label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-beige-60">
                    {formatShortEN(i.updatedAt.slice(0, 10))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="p-10 text-center text-sm text-beige-60">No initiatives match the current filters.</div>
        )}
      </div>
    </div>
  );
}
