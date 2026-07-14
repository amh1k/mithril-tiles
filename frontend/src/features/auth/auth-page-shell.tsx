import { CircleCheck, Shield } from "lucide-react";
import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  formTitle: string;
  formDescription: string;
  note: string;
  children: ReactNode;
  footer: ReactNode;
  spacious?: boolean;
};

const passageDetails = ["Private rooms", "Live rounds", "No installation"];

export function AuthPageShell({
  eyebrow,
  title,
  description,
  formTitle,
  formDescription,
  note,
  children,
  footer,
  spacious = false,
}: AuthPageShellProps) {
  return (
    <main className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-14">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[38rem] w-[58rem] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#946440]/10 blur-[90px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_12%_18%,rgba(110,108,52,0.12),transparent_24%),radial-gradient(circle_at_88%_82%,rgba(148,100,64,0.13),transparent_28%)]"
        aria-hidden="true"
      />

      <section
        className={`panel-enter grid w-full overflow-hidden rounded-[2rem] border border-[#946440]/60 bg-[#21160e]/90 shadow-[0_30px_90px_rgba(43,30,18,0.42)] md:grid-cols-[0.9fr_1.1fr] ${
          spacious ? "max-w-6xl" : "max-w-5xl"
        }`}
      >
        <aside className="relative flex min-h-[19rem] flex-col justify-between overflow-hidden border-b border-[#bba88d]/15 bg-[#2b1e12] p-7 sm:p-9 md:min-h-full md:border-b-0 md:border-r md:p-10">
          <div
            className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border border-[#bba88d]/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full border border-dashed border-[#946440]/20"
            aria-hidden="true"
          />
          <Shield
            className="pointer-events-none absolute -bottom-14 -right-10 size-52 text-[#bba88d]/[0.035]"
            strokeWidth={0.8}
            aria-hidden="true"
          />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a98d63]">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-md font-heading text-3xl font-semibold leading-tight text-[#f4ead7] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#cdbb9f]/75 sm:text-base">
              {description}
            </p>
          </div>

          <div className="relative mt-9">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {passageDetails.map((detail) => (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#bba88d]/70"
                  key={detail}
                >
                  <CircleCheck className="size-3.5 text-[#8f8d4b]" aria-hidden="true" />
                  {detail}
                </span>
              ))}
            </div>
            <p className="mt-6 border-l-2 border-[#946440]/65 pl-4 font-serif text-sm italic leading-6 text-[#e4d4bc]/70">
              {note}
            </p>
          </div>
        </aside>

        <Card className="w-full rounded-none border-0 bg-[#bba88d] px-1 py-3 text-[#2b1e12] shadow-none sm:px-5 sm:py-6 md:px-7">
          <CardHeader className="pb-5">
            <div className="mb-5 flex items-center gap-3 text-[#946440]">
              <span className="h-px flex-1 bg-current/35" />
              <span className="size-1.5 rotate-45 border border-current" />
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.24em]">
                Player passage
              </span>
              <span className="size-1.5 rotate-45 border border-current" />
              <span className="h-px flex-1 bg-current/35" />
            </div>
            <CardTitle className="text-2xl text-[#2b1e12] sm:text-3xl">
              {formTitle}
            </CardTitle>
            <CardDescription className="mt-2 max-w-lg text-sm leading-6 text-[#5d542b]">
              {formDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {children}
            <div className="border-t border-[#946440]/35 pt-5 text-center text-sm text-[#5d542b]">
              {footer}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
