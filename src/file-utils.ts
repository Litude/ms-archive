import path from 'path';
import { promises} from 'fs';

export async function fileExistsCaseSensitive(root: string, filePath: string) {
  let currentDir = root;
  const segments = path.normalize(filePath).split(path.sep).filter(Boolean);

  try {
    await promises.stat(path.join(root, filePath));
  } catch (err) {
    return false;
  }

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    try {
      const entries = await promises.readdir(currentDir, { withFileTypes: true });
      const match = entries.find(e => e.name === segment);
      if (!match) {
        // No exact-case match found
        console.warn(`Case-sensitivity issue detected with "${filePath}"`);
        return false;
      }
      // If not last segment, descend into directory
      if (i < segments.length - 1) {
        currentDir = path.join(currentDir, segment);
      }
    } catch (err) {
      return false;
    }
  }
  return true;
}
