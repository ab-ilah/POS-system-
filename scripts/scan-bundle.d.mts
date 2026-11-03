export type ScanFinding = { file: string; reason: string }

export function scanText(
  text: string,
  options?: { forbiddenSecret?: string },
  file?: string,
): ScanFinding[]

export function scanDirectory(
  directory: string,
  options?: { forbiddenSecret?: string },
): Promise<ScanFinding[]>
