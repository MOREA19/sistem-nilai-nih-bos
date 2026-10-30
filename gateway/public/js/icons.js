const cache = new Map();
function svgFor(name) {
    let svg = cache.get(name);
    if (!svg) {
        svg = fetch(`/icons/${name}.svg`).then((response) => {
            if (!response.ok)
                throw new Error(`Ikon ${name} tidak tersedia`);
            return response.text();
        });
        cache.set(name, svg);
    }
    return svg;
}
export function icon(name) {
    const host = document.createElement('span');
    host.className = 'icon';
    host.setAttribute('aria-hidden', 'true');
    void svgFor(name).then((markup) => {
        const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
        const svg = document.importNode(parsed, true);
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.75');
        svg.setAttribute('aria-hidden', 'true');
        host.replaceChildren(svg);
    }).catch(() => undefined);
    return host;
}
