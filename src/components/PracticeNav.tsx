import Link from "next/link";
import { Calculator, Code2 } from "lucide-react";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

export function PracticeNav({ active }: { active: "programming" | "math" }) {
  return (
    <nav aria-label="Practice sections" className="mb-7 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
      {FEATURE_FLAGS.programmingPractice && (
        <Link
          href="/programming"
          aria-current={active === "programming" ? "page" : undefined}
          className={"inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition " + (
            active === "programming" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          )}
        >
          <Code2 size={14} /> Programming
        </Link>
      )}
      <Link
        href="/math"
        aria-current={active === "math" ? "page" : undefined}
        className={"inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition " + (
          active === "math" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        )}
      >
        <Calculator size={14} /> Math
      </Link>
    </nav>
  );
}
