import { useEffect } from "react";

export default function LegalDocumentModal({ document, onClose }) {
    useEffect(() => {
        if (!document) return undefined;

        const previousOverflow = window.document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };
        window.document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [document, onClose]);

    if (!document) return null;

    return (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
            <article
                className="auth-modal auth-legal-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${document.id}-title`}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <button className="auth-modal-close" type="button" aria-label="Закрыть документ" onClick={onClose}>×</button>
                <header>
                    <h2 id={`${document.id}-title`}>{document.title}</h2>
                    <p>Версия документа: {document.version}</p>
                </header>
                <p className="auth-legal-notice">{document.notice}</p>
                <div className="auth-legal-sections">
                    {document.sections.map((section) => (
                        <section key={section.title}>
                            <h3>{section.title}</h3>
                            <p>{section.text}</p>
                        </section>
                    ))}
                </div>
                <button className="auth-secondary-button" type="button" onClick={onClose}>Закрыть</button>
            </article>
        </div>
    );
}
