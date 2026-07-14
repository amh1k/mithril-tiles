import {
  Brush,
  CircleCheck,
  Clock,
  Layers3,
  Network,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Mithril Tiles",
  description: "Learn about Mithril Tiles, a realtime drawing and guessing game.",
};

const pillars = [
  {
    icon: Network,
    title: "The room listens",
    description:
      "Every table has its own room code, and every player hears the same tale unfold through live websocket updates.",
  },
  {
    icon: Brush,
    title: "The quill moves quickly",
    description:
      "The canvas is fast, direct, and responsive, so the drawer can sketch while the rest of the fellowship watches.",
  },
  {
    icon: ShieldCheck,
    title: "Tokens stay behind the counter",
    description:
      "The frontend keeps authentication safer by storing bearer tokens in HttpOnly cookies through the BFF layer.",
  },
];

const progress = [
  "Registered, guest, and session-aware authentication",
  "Room entry, websocket tickets, chat, and live drawing",
  "Authoritative room snapshots with players, host, drawer, scores, and round state",
  "Synced round timer, canvas reset, and themed round transitions",
  "Word-pack selection, game start flow, final score overlay, and participant names",
];

const stack = [
  "Go API",
  "PostgreSQL",
  "WebSockets",
  "Next.js",
  "TypeScript",
  "Tailwind CSS",
  "Zustand",
  "TanStack Query",
];

export default function AboutPage() {
  return (
    <main className="relative isolate flex flex-1 overflow-hidden bg-[#21160e] px-4 py-10 text-[#2b1e12] sm:px-6 lg:py-14">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(43,30,18,0.5),rgba(43,30,18,0.68)),radial-gradient(circle_at_center,transparent_38%,rgba(43,30,18,0.42)_125%),url('/textures/parchment-background.png')] bg-cover bg-fixed bg-center bg-no-repeat"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(187,168,141,0.22),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(148,100,64,0.18),transparent_30%)]"
        aria-hidden="true"
      />
      <article className="panel-enter relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2rem] border border-[#946440]/60 bg-[#bba88d] shadow-[0_30px_90px_rgba(10,6,3,0.48)]">
        <header className="relative overflow-hidden border-b border-[#946440]/45 bg-[#2b1e12] px-6 py-10 text-[#f4ead7] sm:px-10 sm:py-14 lg:px-14">
          <ScrollText className="pointer-events-none absolute -bottom-16 -right-8 size-64 text-[#bba88d]/[0.035]" strokeWidth={0.7} aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#a98d63]">
              A tavern tale · About the realm
            </p>
            <h1 className="mt-5 font-heading text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Pull up a chair. The tale begins.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#cdbb9f]/80 sm:text-lg sm:leading-8">
              Mithril Tiles is a real-time drawing and guessing game built for
              quick rooms, bold sketches, and the kind of rivalries retold long
              after the final round.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5 text-[0.65rem] font-bold uppercase tracking-[0.17em] text-[#e4d4bc]">
              <span className="rounded-full border border-[#bba88d]/25 bg-[#bba88d]/5 px-3 py-1.5">Playable alpha</span>
              <span className="rounded-full border border-[#bba88d]/25 bg-[#bba88d]/5 px-3 py-1.5">Real-time rooms</span>
              <span className="rounded-full border border-[#bba88d]/25 bg-[#bba88d]/5 px-3 py-1.5">Human and bot players</span>
            </div>
          </div>
        </header>

        <div className="relative bg-[#bba88d] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] border border-[#946440]/20" aria-hidden="true" />
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
            <div>
              <section>
                <p className="text-base leading-8 text-[#3b2818] first-letter:float-left first-letter:mr-3 first-letter:font-heading first-letter:text-6xl first-letter:font-bold first-letter:leading-[0.86] first-letter:text-[#5d542b] sm:text-lg">
                  They say Mithril Tiles began as a simple room around a canvas:
                  one drawer with a secret word, a circle of guessers, and a
                  clock that cared nothing for hesitation.
                </p>
                <p className="mt-5 leading-8 text-[#3b2818]">
                  It has since grown into synchronized rounds with guest and
                  registered identities, live drawing, scoring, final rankings,
                  AI challengers, and authoritative multiplayer rooms.
                </p>
              </section>

              <div className="my-8 flex items-center gap-4 text-[#946440]">
                <span className="h-px flex-1 bg-current/40" />
                <SparkLine />
                <span className="h-px flex-1 bg-current/40" />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {pillars.map(({ icon: Icon, title, description }) => (
                  <section key={title} className="rounded-2xl border border-[#946440]/35 bg-[#d0bda1]/55 p-5 shadow-[inset_0_1px_0_rgba(255,248,218,0.3)]">
                    <span className="flex size-10 items-center justify-center rounded-full border border-[#5d542b]/35 bg-[#2b1e12] text-[#e4d4bc]">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 font-heading text-base font-bold text-[#2b1e12]">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#3b2818]">{description}</p>
                  </section>
                ))}
              </div>
            </div>

            <aside className="space-y-8 border-t border-[#946440]/35 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <section>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5d542b]">Innkeeper’s note</p>
                <h2 className="mt-2 font-heading text-2xl font-bold text-[#2b1e12]">The hall is open</h2>
                <p className="mt-3 text-sm leading-7 text-[#3b2818]">
                  The game is playable today, while its bots, resilience, and
                  production foundations continue to be sharpened.
                </p>
              </section>

              <section>
                <div className="flex items-center gap-3">
                  <Clock className="size-5 text-[#5d542b]" aria-hidden="true" />
                  <h2 className="font-heading text-xl font-bold text-[#2b1e12]">What is already forged</h2>
                </div>
                <ul className="mt-4 space-y-3">
                  {progress.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-6 text-[#3b2818]">
                      <CircleCheck className="mt-1 size-4 shrink-0 text-[#6e6c34]" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3">
                  <Layers3 className="size-5 text-[#5d542b]" aria-hidden="true" />
                  <h2 className="font-heading text-xl font-bold text-[#2b1e12]">Tools behind the counter</h2>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {stack.map((item) => (
                    <span key={item} className="rounded-full border border-[#946440]/40 bg-[#f4ead7]/25 px-3 py-1 text-xs font-bold text-[#3b2818]">
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </article>
    </main>
  );
}

function SparkLine() {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      <span className="size-1.5 rotate-45 bg-current" />
      <span className="size-2.5 rotate-45 border border-current" />
      <span className="size-1.5 rotate-45 bg-current" />
    </span>
  );
}
