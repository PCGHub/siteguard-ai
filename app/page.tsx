import Link from "next/link";
export default function Home() {
  return (
    <>
      <header className="public-header">
        <Link href="/" className="brand">
          ◈ SiteGuard AI
        </Link>
        <Link className="button secondary" href="/login">
          Sign in ↗
        </Link>
      </header>
      <main className="landing">
        <p className="eyebrow">ENTERPRISE WORKPLACE SAFETY INTELLIGENCE</p>
        <h1>
          See the hazard.
          <br />
          <span>Build a safer tomorrow.</span>
        </h1>
        <p className="lead">
          Bring your people and projects together in a private company
          workspace. A clear foundation for better workplace safety decisions.
        </p>
        <div className="actions">
          <Link className="button" href="/signup">
            Create your workspace →
          </Link>
          <Link href="/login">Already a member? Sign in</Link>
        </div>
        <div className="feature-grid">
          <article className="card">
            <b>01 / Your company, connected</b>
            <h2>One team. One workspace.</h2>
            <p>
              Keep projects organized and company information separated with
              membership-based access.
            </p>
          </article>
          <article className="card">
            <b>02 / Built for the field</b>
            <h2>Clarity wherever you work.</h2>
            <p>
              A responsive workspace for construction, manufacturing, oil & gas,
              and industrial maintenance.
            </p>
          </article>
          <article className="card">
            <b>03 / A responsible foundation</b>
            <h2>Human judgment comes first.</h2>
            <p>
              AI assessments, inspections, and corrective actions are planned
              for future milestones. Safety decisions require qualified review.
            </p>
          </article>
        </div>
      </main>
      <footer>SiteGuard AI · See the Hazard. Visualize the Solution.</footer>
    </>
  );
}
