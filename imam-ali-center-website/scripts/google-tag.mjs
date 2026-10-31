import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const tag = `
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-KED5EQY5KT"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-KED5EQY5KT');
    </script>`;

// Reapply the same block so subsequent builds never accumulate duplicate tags.
export async function addGoogleTag(directory) {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory() && !['server','client','.openai'].includes(entry.name)) {
      await addGoogleTag(path);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      const updated = html.replaceAll(tag, '').replace(/<head\b[^>]*>/i, head => head + tag);
      if (updated !== html) await writeFile(path, updated);
    }
  }
}
