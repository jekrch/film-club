import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// jsdom does not provide TextEncoder/TextDecoder, which react-router v7 needs.
if (typeof globalThis.TextEncoder === 'undefined') {
    globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
    globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}