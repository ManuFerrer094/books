/** Build-time only: download verified CC0 source models; nothing is fetched at runtime. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

const root = resolve('.tmp/decor-source/models');
const ids = [
  'potted_plant_01',
  'potted_plant_02',
  'potted_plant_04',
  'fern_02',
  'flower_gazania',
  'planter_pot_clay',
  'ceramic_vase_01',
  'ceramic_vase_02',
  'brass_candleholders',
  'desk_lamp_arm_01',
  'wooden_lantern_01',
  'standing_picture_frame_01',
  'standing_picture_frame_02',
  'concrete_cat_statue',
  'mantel_clock_01',
  'tea_set_01',
];
async function request(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'EntrePaginasAssetPreparation/1.0' },
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return response;
    } catch (error) {
      if (attempt === 3) throw error;
    }
  }
}
async function pool(items, concurrency, fn) {
  let index = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (index < items.length) await fn(items[index++]);
    }),
  );
}
await mkdir(root, { recursive: true });
const downloads = [];
await pool(ids, 3, async (id) => {
  const directory = resolve(root, id);
  await mkdir(directory, { recursive: true });
  try {
    await readFile(resolve(directory, 'info.json'));
  } catch {
    await writeFile(
      resolve(directory, 'info.json'),
      JSON.stringify(
        await (await request(`https://api.polyhaven.com/info/${id}`)).json(),
        null,
        2,
      ),
    );
  }
  const file = resolve(directory, 'files.json');
  let metadata;
  try {
    metadata = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    metadata = await (
      await request(`https://api.polyhaven.com/files/${id}`)
    ).json();
    await writeFile(file, JSON.stringify(metadata, null, 2));
  }
  const blend = metadata.blend?.['1k']?.blend;
  if (!blend) throw new Error(`Missing 1k Blender model: ${id}`);
  downloads.push({ id, path: resolve(directory, `${id}.blend`), ...blend });
  for (const [relative, data] of Object.entries(blend.include ?? {})) {
    const path = resolve(directory, relative);
    if (!path.startsWith(directory + sep))
      throw new Error('Invalid resource path');
    downloads.push({ id, path, ...data });
  }
});
let complete = 0;
await pool(downloads, 4, async (file) => {
  if (
    !file.url.startsWith('https://dl.polyhaven.org/') ||
    !/^[a-f\d]{32}$/i.test(file.md5)
  )
    throw new Error('Unexpected asset host or checksum');
  const md5 = (bytes) => createHash('md5').update(bytes).digest('hex');
  let bytes;
  try {
    bytes = await readFile(file.path);
  } catch {
    /* not downloaded */
  }
  if (!bytes || md5(bytes) !== file.md5) {
    bytes = Buffer.from(await (await request(file.url)).arrayBuffer());
    if (md5(bytes) !== file.md5)
      throw new Error(`Checksum mismatch: ${file.path}`);
    await mkdir(dirname(file.path), { recursive: true });
    await writeFile(file.path, bytes);
  }
  if (++complete % 10 === 0 || complete === downloads.length)
    console.log(`Verified ${complete}/${downloads.length} model resources`);
});
console.log(`Prepared ${ids.length} CC0 models in ${root}`);
