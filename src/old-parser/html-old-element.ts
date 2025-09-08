export function rewriteElementAttribute(html: string, element: string, attribute: string, rewriter: (value: string) => string, constraints: { attribute: string, value: string }[] = []): string {
  const tagRegex = new RegExp(
    `<\\s*${element}\\b([^>]*)>`,
    'gi'
  );

  return html.replace(tagRegex, (tagMatch, attrPart: string) => {
    // If constraints are present, check that all are satisfied
    if (constraints.length > 0) {
      let allMatch = true;
      for (const constraint of constraints) {
        // Regex to find the attribute and its value
        const constraintAttrRegex = new RegExp(
          `${constraint.attribute}\\b\\s*=\\s*(?:['"]([^'"]*)['"]|([^\\s"'>]+))`,
          'i'
        );
        const match = attrPart.match(constraintAttrRegex);
        const attrValue = match ? (match[1] !== undefined ? match[1] : match[2]) : undefined;
        if (attrValue?.toLowerCase() !== constraint.value) {
          allMatch = false;
          break;
        }
      }
      if (!allMatch) {
        return tagMatch; // Return unmodified tag if any constraint fails
      }
    }
    // Regex to match the attribute within the tag
    const attrRegex = new RegExp(
      `(${attribute}\\b\\s*=\\s*)(['"])(.*?)\\2|(${attribute}\\b\\s*=\\s*)([^\\s"'>]+)`,
      'gi'
    );

    return tagMatch.replace(attrRegex, (attrMatch, p1, quote, quotedValue, p4, unquotedValue) => {
      const value = quotedValue !== undefined ? quotedValue : unquotedValue;
      const rewritten = rewriter(value);
      if (rewritten === value) return attrMatch;
      if (quotedValue !== undefined) {
        return `${p1}${quote}${rewritten}${quote}`;
      } else {
        return `${p4}${rewritten}`;
      }
    });
  });
}
