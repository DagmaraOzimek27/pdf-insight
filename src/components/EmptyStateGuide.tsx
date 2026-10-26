import { UI_COPY } from '../lib/uiCopy';

export function EmptyStateGuide() {
  return (
    <section className="empty-guide" aria-labelledby="empty-guide-heading">
      <h2 id="empty-guide-heading" className="empty-guide__heading">
        {UI_COPY.emptyState.title}
      </h2>

      <div className="empty-guide__grid">
        {UI_COPY.emptyState.steps.map((step) => (
          <article key={step.title} className="empty-guide__card">
            <h3 className="empty-guide__card-title">{step.title}</h3>
            <p className="empty-guide__card-desc">{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
