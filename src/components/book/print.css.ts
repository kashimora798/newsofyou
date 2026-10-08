/**
 * print.css.ts — the stylesheet the printed book uses (build-plan Phase 9).
 *
 * Injected only on `/book/print`, so nothing else in the app pays for it. The
 * rules are intentionally boring: one day per page, serif type, no shadows, no
 * background art — a browser's "Save as PDF" is the export, and a real print
 * shop needs nothing more exotic than that.
 */

export const PRINT_CSS = `
@media screen {
  body { background: #0b0b18; }
  .print-wrap {
    max-width: 46rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 4rem;
    color: hsl(44 40% 95%);
  }
  .print-page {
    background: white;
    color: #17151c;
    border-radius: 6px;
    padding: 2.4rem 2.6rem;
    margin-bottom: 1.4rem;
    box-shadow: 0 24px 60px -40px rgba(0,0,0,0.9);
  }
  .print-toolbar { position: sticky; top: 0; z-index: 10; backdrop-filter: blur(14px);
    background: hsl(234 48% 5% / 0.82); border-bottom: 0.5px solid hsl(44 42% 96% / 0.08);
    padding: 0.8rem 1.25rem; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  .print-toolbar button {
    font: inherit; font-size: 13px; border-radius: 999px; padding: 0.4rem 0.9rem;
    border: 0.5px solid hsl(44 42% 96% / 0.25); background: transparent; color: inherit; cursor: pointer;
  }
  .print-toolbar button.primary { background: hsl(342 68% 74%); color: #1b0d14; border-color: transparent; }
  .print-toolbar select, .print-toolbar input[type="date"] {
    font: inherit; font-size: 13px; border-radius: 999px; padding: 0.35rem 0.7rem;
    background: hsl(236 34% 13%); color: inherit; border: 0.5px solid hsl(44 42% 96% / 0.18);
  }
}

@page {
  size: A5 portrait;
  margin: 16mm 14mm 18mm;
}

@media print {
  html, body { background: #fff !important; }
  .no-print { display: none !important; }
  .print-wrap { max-width: none; padding: 0; margin: 0; color: #000; }
  .print-page {
    background: #fff !important; color: #000 !important;
    box-shadow: none !important; border-radius: 0 !important;
    padding: 0 !important; margin: 0 !important;
    break-after: page; page-break-after: always;
  }
  .print-page:last-child { break-after: auto; page-break-after: auto; }
  .print-title { font-size: 22pt; }
  .print-day { font-size: 15pt; }
  .print-line { font-size: 10.5pt; line-height: 1.55; }
  .print-note { font-size: 10pt; }
  /* the cover is its own page, and colour survives to PDF */
  .print-cover { break-after: page; }
  a[href]::after { content: ""; }
}
`;
