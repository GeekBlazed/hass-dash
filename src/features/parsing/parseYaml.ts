/**
 * Parse a YAML string into an unknown value.
 *
 * Throws on invalid YAML.
 */
export async function parseYaml(text: string): Promise<unknown> {
  const { parse } = await import('yaml');
  return parse(text);
}
