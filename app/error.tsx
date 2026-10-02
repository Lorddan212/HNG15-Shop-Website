'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="wrap page-shell empty-panel"><h1>Let’s try that again.</h1><p>This page could not be loaded.</p><button className="primary-button" onClick={reset}>Try again</button></section>;}
