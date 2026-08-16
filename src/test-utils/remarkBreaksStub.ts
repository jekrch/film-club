/**
 * Stand-in for `remark-breaks` in the jest suite.
 *
 * Like `react-markdown` itself, the package is ESM only and jest doesn't
 * transform `node_modules`, so importing it would blow up every test that
 * renders a component with a Markdown body. It is only ever handed to
 * `react-markdown`, which the suite already replaces with a stub that renders
 * its source text verbatim — so this no-op plugin is never called, and nothing
 * is lost by it doing nothing.
 *
 * What newlines actually turn into is a question for the real remark pipeline,
 * not for a jsdom render.
 */
const remarkBreaksStub = () => undefined;

export default remarkBreaksStub;
