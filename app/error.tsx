'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="card"><h1>Something went wrong</h1><p>We could not load this page. Please check your connection and try again.</p><button onClick={reset}>Try again</button></section>; }
