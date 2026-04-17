const Index = () => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff_0%,#e2e8f0_36%,#f8fafc_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">PT DP Mishra Memorial</p>
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Merriweather', Georgia, serif" }}>
              Eduflow Public School
            </h1>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#about" className="hover:text-slate-600">About</a>
            <a href="#academics" className="hover:text-slate-600">Academics</a>
            <a href="#life" className="hover:text-slate-600">Life@School</a>
            <a href="#contact" className="hover:text-slate-600">Contact</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,64,175,0.96),rgba(15,23,42,0.86))]" />
          <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
            <div className="max-w-3xl text-white">
              <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.24em] text-white/90">
                Excellence in education
              </p>
              <h2 className="text-5xl font-bold leading-tight md:text-6xl" style={{ fontFamily: "'Merriweather', Georgia, serif" }}>
                Shaping tomorrow&apos;s leaders with modern learning and strong values.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 md:text-lg">
                A polished school front page experience with clear admissions messaging, strong academics, and a calm public presence.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#admissions" className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition-transform hover:-translate-y-0.5">
                  Apply for Admission
                </a>
                <a href="#academics" className="rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition-transform hover:-translate-y-0.5">
                  Explore Academics
                </a>
              </div>
            </div>

            <div className="grid gap-4 self-center rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-white/65">Years of Excellence</p>
                <p className="mt-2 text-3xl font-bold">25+</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Students</p>
                  <p className="mt-2 text-2xl font-bold">2,000+</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Result Rate</p>
                  <p className="mt-2 text-2xl font-bold">100%</p>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-sm font-medium text-white/80">Academic Year 2026-27</p>
                <p className="mt-1 text-sm text-white/70">Admissions, news, and school life updates curated for a polished public experience.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Principal Message</p>
              <h3 className="mt-2 text-3xl font-bold">Learning that balances character, creativity, and confidence.</h3>
              <p className="mt-4 text-slate-600 leading-7">
                We focus on thoughtful teaching, strong discipline, and modern facilities so every learner can grow with clarity and purpose.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Admissions</p>
              <h3 className="mt-2 text-2xl font-bold">Now Open</h3>
              <p className="mt-3 text-sm text-white/75">Apply online for the upcoming session and explore the campus experience.</p>
            </div>
          </div>
        </section>

        <section id="academics" className="bg-white/60 border-y border-slate-200">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Academics</p>
              <h3 className="mt-2 text-3xl font-bold">A school site with a clear academic structure.</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["STEM Innovation", "Lab-led learning with practical projects."],
                ["Language & Debate", "Communication and confidence at the center."],
                ["Arts & Performance", "Creative expression woven into school life."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-lg font-semibold">{title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="life" className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Life@School</p>
            <h3 className="mt-2 text-3xl font-bold">Public-facing sections that feel complete and credible.</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["News", "12 live updates"],
              ["Events", "9 upcoming events"],
              ["Gallery", "84 photos"],
              ["Achievements", "48 awards"],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-2 text-xl font-bold">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-7xl px-6 pb-16">
          <div className="rounded-3xl bg-slate-900 px-8 py-10 text-white shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Contact</p>
                <h3 className="mt-2 text-3xl font-bold">Admissions and campus inquiries</h3>
              </div>
              <div className="text-sm text-white/75">
                admissions@eduflowpublic.edu<br />
                +91 00000 00000
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
