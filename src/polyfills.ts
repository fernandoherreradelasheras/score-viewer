// react-markdown calls Object.hasOwn unguarded, which would throw on browsers older
// than Chrome 93, Firefox 92 or Safari 15.4 as soon as a text section is rendered.
// hast-util-raw needs structuredClone but falls back on its own, so it needs nothing here.
if (!("hasOwn" in Object)) {
    Object.defineProperty(Object, "hasOwn", {
        value: (target: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(target, key),
        configurable: true,
        writable: true
    });
}
