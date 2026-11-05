"use client";

import { Check, ChevronDown, Folder, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

type CategorySelectProps = {
  value?: string;
  categories: string[];
  disabled?: boolean;
  onChange: (category: string | null) => void;
};

const CREATE_CATEGORY = "__create_category__";

export function CategorySelect({
  value = "",
  categories,
  disabled = false,
  onChange,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  function chooseCategory(category: string | null) {
    if ((category ?? "") !== value) onChange(category);
    setOpen(false);
  }

  function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name || name.length > 40) return;
    const existing = categories.find(
      (category) => category.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if ((existing ?? name) === value) {
      setOpen(false);
      return;
    }
    onChange(existing ?? name);
    setNewCategory("");
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={value ? `Category: ${value}` : "Add category"}
        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/50 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Folder size={14} className={value ? "shrink-0 text-indigo-500" : "shrink-0 text-slate-400"} />
        <span className="max-w-52 truncate">{value || "Add to category"}</span>
        <ChevronDown size={13} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && !disabled && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Organize this note
          </p>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => chooseCategory(null)}
              aria-pressed={!value}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 transition hover:bg-slate-50"
            >
              <span>Uncategorized</span>
              {!value && <Check size={14} className="text-indigo-600" />}
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => chooseCategory(category)}
                aria-pressed={value === category}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-slate-600 transition hover:bg-indigo-50"
              >
                <span className="truncate">{category}</span>
                {value === category && <Check size={14} className="shrink-0 text-indigo-600" />}
              </button>
            ))}
          </div>
          <form onSubmit={createCategory} className="mt-2 flex gap-2 border-t border-slate-100 pt-2.5">
            <input
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              maxLength={40}
              aria-label="New category name"
              placeholder="Create a category…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50"
            />
            <button
              type="submit"
              disabled={!newCategory.trim()}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={13} />
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
