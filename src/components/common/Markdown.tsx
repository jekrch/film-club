import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

interface MarkdownProps {
    children: string;
}

/**
 * Member-authored prose — a review, a list note, a list description, a profile
 * bio — rendered as Markdown.
 *
 * Every one of these is typed into a plain `<textarea>`, and `remark-breaks` is
 * why they all share a component. Markdown treats a single newline as a soft
 * break and renders it as a space, so a member who pressed Enter once between
 * two lines got them run together into one paragraph, and the only way to get
 * the break they typed was to press Enter twice or to know that two trailing
 * spaces mean something. A textarea in a film club is not a place to expect that
 * of anyone: here a newline is a newline. Blank lines still open a new
 * paragraph, and the plugin leaves code blocks alone.
 *
 * Every Markdown body on the site should come through here rather than reaching
 * for `react-markdown` directly, so that the rule holds everywhere prose is
 * written. Styling stays with the caller — these bodies sit in `prose` wrappers
 * sized to the surface they appear on.
 */
const Markdown: React.FC<MarkdownProps> = ({ children }) => (
    <ReactMarkdown remarkPlugins={[remarkBreaks]}>{children}</ReactMarkdown>
);

export default Markdown;
