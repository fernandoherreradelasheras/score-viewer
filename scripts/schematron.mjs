// Minimal ISO Schematron runner for the rules embedded in the MEI RelaxNG schema.
//
// xmllint validates the RelaxNG grammar but ignores the Schematron, which is where
// MEI puts the rules a grammar cannot express: that @startid points at something
// real, that a tuplet adds up, that @tstamp fits the meter. Those catch a class of
// encoding errors the grammar never will.
//
// The MEI Schematron uses XPath 2.0 (tokenize, every $x in, eq, distinct-values), so
// it is evaluated with fontoxpath rather than xsltproc. Only the subset MEI actually
// uses is implemented: patterns, rules with a context, asserts and reports, and
// rule-scoped lets. There are no phases, abstract patterns or includes to honour.

import { readFileSync } from 'node:fs';
// fontoxpath ships as CommonJS, so it has no named ESM exports
import fontoxpath from 'fontoxpath';
import { parseXmlDocument } from 'slimdom';

const { evaluateXPath, evaluateXPathToNodes, evaluateXPathToBoolean, evaluateXPathToString } = fontoxpath;

const SCH_NS = 'http://purl.oclc.org/dsdl/schematron';
const MEI_NS = 'http://www.music-encoding.org/ns/mei';

// The schema declares no <sch:ns>, and the RelaxNG grammar does not bind the prefix
// its own rules are written against, so the binding is supplied here.
const namespaceResolver = (prefix) => ({
    mei: MEI_NS,
    xml: 'http://www.w3.org/XML/1998/namespace',
    xlink: 'http://www.w3.org/1999/xlink',
}[prefix] ?? null);

const children = (parent, name) =>
    Array.from(parent.childNodes).filter((n) => n.nodeType === 1 && n.namespaceURI === SCH_NS && n.localName === name);

const selectorFor = (context) =>
    context.startsWith('/') ? context : `//${context.includes('|') ? `(${context})` : context}`;

// Patterns in document order, each with its rules, their lets and their assertions.
export const loadPatterns = (schemaPath) => {
    const doc = parseXmlDocument(readFileSync(schemaPath, 'utf8'));
    return Array.from(doc.getElementsByTagNameNS(SCH_NS, 'pattern')).map((pattern) => ({
        rules: children(pattern, 'rule').map((rule) => ({
            context: rule.getAttribute('context'),
            // A rule context is a match pattern; turning it into a selection means
            // anchoring it at the root. Wrapping the whole thing in `//(...)` instead
            // makes fontoxpath evaluate it pathologically, so only alternations, which
            // would otherwise bind looser than the `//`, get the parentheses.
            selector: selectorFor(rule.getAttribute('context')),
            lets: children(rule, 'let').map((l) => ({ name: l.getAttribute('name'), value: l.getAttribute('value') })),
            assertions: ['assert', 'report'].flatMap((kind) =>
                children(rule, kind).map((a) => ({
                    kind,
                    test: a.getAttribute('test'),
                    // The message may interpolate a variable through <sch:value-of>
                    message: Array.from(a.childNodes).map((n) =>
                        n.nodeType === 1 && n.localName === 'value-of' ? `{${n.getAttribute('select')}}` : n.textContent
                    ).join('').replace(/\s+/g, ' ').trim(),
                }))
            ),
        })),
    }));
};

// Enough to find the offending element in an editor: its name, its xml:id when it has
// one, and the measure it sits in.
const describe = (node) => {
    // Many rules are written against attributes, so report the element carrying it
    const attribute = node.nodeType === 2 ? node : null;
    const element = attribute ? attribute.ownerElement : node;
    const id = element?.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'id');
    const measure = evaluateXPathToString('ancestor-or-self::mei:measure[1]/@n', element ?? node, null, null, { namespaceResolver });
    const at = attribute ? `@${attribute.name}="${attribute.value}" on ` : '';
    return `${at}<${element?.localName ?? node.nodeName}${id ? ` xml:id="${id}"` : ''}>${measure ? ` in measure ${measure}` : ''}`;
};

const resolveMessage = (message, node, variables) =>
    message.replace(/\{([^}]+)\}/g, (_, expr) => {
        try {
            return evaluateXPathToString(expr, node, null, variables, { namespaceResolver });
        } catch {
            return '?';
        }
    });

export const validate = (patterns, xmlPath) => {
    const doc = parseXmlDocument(readFileSync(xmlPath, 'utf8'));
    const failures = [];

    for (const pattern of patterns) {
        // Within a pattern a node is handled by the first rule whose context matches it
        const claimed = new Set();
        for (const rule of pattern.rules) {
            let nodes;
            try {
                nodes = evaluateXPathToNodes(rule.selector, doc, null, null, { namespaceResolver });
            } catch (error) {
                failures.push({ where: '(schema)', message: `cannot evaluate rule context "${rule.context}": ${error.message}` });
                continue;
            }

            for (const node of nodes) {
                if (claimed.has(node)) continue;
                claimed.add(node);

                const variables = {};
                for (const { name, value } of rule.lets) {
                    variables[name] = evaluateXPath(value, node, null, variables, evaluateXPath.ANY_TYPE, { namespaceResolver });
                }

                for (const { kind, test, message } of rule.assertions) {
                    const holds = evaluateXPathToBoolean(test, node, null, variables, { namespaceResolver });
                    if (kind === 'assert' ? !holds : holds) {
                        failures.push({ where: describe(node), message: resolveMessage(message, node, variables) });
                    }
                }
            }
        }
    }
    return failures;
};
