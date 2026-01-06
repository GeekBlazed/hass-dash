import { parse } from 'yaml';

/**
 * Parse a YAML string into an unknown value.
 *
 * Throws on invalid YAML.
 */
export function parseYaml(text: string): unknown {
  return parse(text);
}
