import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getRouteSeo } from "./routeSeo";

function setMeta(name, content) {
    const selector = `meta[name="${name}"]`;
    let element = document.head.querySelector(selector);
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute("name", name);
        document.head.appendChild(element);
    }
    element.setAttribute("content", content);
}

export default function RouteSeoManager() {
    const { pathname } = useLocation();

    useEffect(() => {
        const seo = getRouteSeo(pathname);
        document.title = seo.title;
        setMeta("description", seo.description);
        setMeta("robots", seo.robots);

        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (seo.canonical) {
            if (!canonical) {
                canonical = document.createElement("link");
                canonical.setAttribute("rel", "canonical");
                document.head.appendChild(canonical);
            }
            canonical.setAttribute("href", seo.canonical);
        } else {
            canonical?.remove();
        }
    }, [pathname]);

    return null;
}
