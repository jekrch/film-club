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
 * sized to the surface they appear on — with one exception: the gap between
 * paragraphs is set here. Preflight strips the browser's `<p>` margin and the
 * `prose` classes those wrappers carry are inert without the typography plugin,
 * so a member who left a blank line between two paragraphs saw them butt up
 * against each other with no seam. The margin is in `em` so it tracks whatever
 * text size the surface sets, and it collapses between adjacent paragraphs; the
 * first and last are flush so the body still sits where the caller put it.
 */
const Markdown: React.FC<MarkdownProps> = ({ children }) => (
    <div className="[&_p]:my-[1em] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkBreaks]}>{children}</ReactMarkdown>
    </div>
);

export default Markdown;
