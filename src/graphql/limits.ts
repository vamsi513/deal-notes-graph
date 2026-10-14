import { GraphQLError, Kind } from 'graphql';
import type {
  ASTVisitor,
  FragmentDefinitionNode,
  SelectionSetNode,
  ValidationContext,
} from 'graphql';

/** A public endpoint takes anything, so every one of these is a hard ceiling. */
export const MAX_QUERY_DEPTH = 8;
export const MAX_SELECTIONS = 300;
export const MAX_BODY_BYTES = 16 * 1024;

/**
 * Reject a document nested deeper than `max`.
 *
 * Without this, `deals { company { deals { company { ... } } } }` can be nested indefinitely
 * and made to do a great deal of work from a very short request.
 */
export function depthLimitRule(max: number = MAX_QUERY_DEPTH) {
  return (context: ValidationContext): ASTVisitor => ({
    OperationDefinition(node) {
      const fragments = context
        .getDocument()
        .definitions.reduce<Record<string, FragmentDefinitionNode>>((acc, definition) => {
          if (definition.kind === Kind.FRAGMENT_DEFINITION) acc[definition.name.value] = definition;
          return acc;
        }, {});
      const depth = selectionSetDepth(node.selectionSet, fragments, new Set());
      if (depth > max) {
        context.reportError(
          new GraphQLError(`query is ${depth} levels deep, the limit is ${max}`, {
            nodes: [node],
            extensions: { code: 'QUERY_TOO_DEEP', depth, limit: max },
          }),
        );
      }
    },
  });
}

/** Reject a document that asks for an unreasonable number of fields, however shallow. */
export function selectionLimitRule(max: number = MAX_SELECTIONS) {
  return (context: ValidationContext): ASTVisitor => {
    let count = 0;
    let reported = false;
    return {
      Field() {
        count += 1;
        if (count > max && !reported) {
          reported = true;
          context.reportError(
            new GraphQLError(`query selects more than ${max} fields`, {
              extensions: { code: 'QUERY_TOO_LARGE', limit: max },
            }),
          );
        }
      },
    };
  };
}

function selectionSetDepth(
  selectionSet: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
  visiting: ReadonlySet<string>,
): number {
  let deepest = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const nested =
        selection.selectionSet === undefined
          ? 0
          : selectionSetDepth(selection.selectionSet, fragments, visiting);
      deepest = Math.max(deepest, 1 + nested);
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      deepest = Math.max(deepest, selectionSetDepth(selection.selectionSet, fragments, visiting));
    } else {
      const name = selection.name.value;
      // A fragment cycle is its own validation error; stop here so this rule cannot spin.
      if (visiting.has(name)) continue;
      const fragment = fragments[name];
      if (fragment === undefined) continue;
      deepest = Math.max(
        deepest,
        selectionSetDepth(fragment.selectionSet, fragments, new Set([...visiting, name])),
      );
    }
  }
  return deepest;
}

export const validationRules = [depthLimitRule(), selectionLimitRule()];

export interface BodyLimitResult {
  withinLimit: boolean;
  bytes: number;
}

/** Byte length of a request body, measured rather than trusted from the header. */
export function measureBody(body: string): BodyLimitResult {
  const bytes = Buffer.byteLength(body, 'utf8');
  return { withinLimit: bytes <= MAX_BODY_BYTES, bytes };
}

/** A declared content length over the cap is refused before the body is read at all. */
export function declaredLengthWithinLimit(contentLength: string | null | undefined): boolean {
  if (contentLength === null || contentLength === undefined || contentLength === '') return true;
  const declared = Number.parseInt(contentLength, 10);
  return Number.isNaN(declared) ? true : declared <= MAX_BODY_BYTES;
}

export const BODY_TOO_LARGE_MESSAGE = `request body is larger than the ${MAX_BODY_BYTES} byte limit`;
