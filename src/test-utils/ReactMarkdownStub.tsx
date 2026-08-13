import React from 'react';

/**
 * Stand-in for `react-markdown` in the jest suite.
 *
 * The real package ships ESM only, and jest doesn't transform `node_modules`,
 * so importing it blows up any test that renders a component with a Markdown
 * body (the profile bio, list descriptions, entry notes). Mapped in via
 * `moduleNameMapper` in jest.config.js.
 *
 * It renders the source text verbatim, which is what tests assert on anyway —
 * they check that the copy reached the page, not how it was formatted. Anything
 * that needs to test actual Markdown rendering wants a different tool than a
 * jsdom render.
 */
const ReactMarkdownStub: React.FC<{ children?: string }> = ({ children }) => (
    <div data-testid="markdown">{children}</div>
);

export default ReactMarkdownStub;
