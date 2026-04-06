const setupSteps = [
  {
    title: 'Local dev',
    command: 'npm run dev',
    description: 'Start the Next.js development server on http://localhost:3000.',
  },
  {
    title: 'Production build',
    command: 'npm run build',
    description: 'Create an optimized production build and verify TypeScript at build time.',
  },
  {
    title: 'Vercel deploy',
    command: 'vercel',
    description: 'Deploy this repository directly once it is pushed to GitHub or connected in Vercel.',
  },
] as const

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Next.js + TypeScript</p>
        <h1>AI education product workspace, ready for the web.</h1>
        <p className="lead">
          This starter uses the Next.js App Router, TypeScript, and a structure that
          deploys cleanly to Vercel without extra platform config.
        </p>
        <div className="cta-row">
          <a className="primary-link" href="http://localhost:3000">
            Open local app
          </a>
          <a className="secondary-link" href="https://vercel.com/new">
            Deploy on Vercel
          </a>
        </div>
      </section>

      <section className="grid">
        {setupSteps.map((step) => (
          <article className="card" key={step.title}>
            <p className="card-kicker">{step.title}</p>
            <code>{step.command}</code>
            <p>{step.description}</p>
          </article>
        ))}
      </section>

      <section className="status-panel">
        <div>
          <p className="status-label">Current stack</p>
          <p className="status-value">Next.js 14, React 18, TypeScript 5</p>
        </div>
        <div>
          <p className="status-label">Suggested next move</p>
          <p className="status-value">Build the first page flow, auth, or API routes.</p>
        </div>
      </section>
    </main>
  )
}
