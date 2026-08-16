import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom does not provide TextEncoder/TextDecoder, which react-router v7 needs.
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

// jsdom does no layout, so it implements no scrolling either: calling
// `scrollIntoView` on a node throws rather than doing nothing. A no-op keeps a
// component that scrolls something into view (WatchedPage, on arriving at a
// named row) renderable in a test that only means to assert what it drew, and
// gives `jest.spyOn` something to replace where the scroll itself is the
// subject.
if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
