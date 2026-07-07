const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'family-dashboard-recipes.json';

/** Find the Drive appData file ID, or return null if not yet created. */
async function findFileId(token) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name='${FILE_NAME}'`,
    fields: 'files(id)',
  });
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

/**
 * Load all recipes from Google Drive.
 * Returns the recipe array, or null if the file doesn't exist yet.
 */
export async function loadFromDrive(token) {
  const fileId = await findFileId(token);
  if (!fileId) return null;
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive read failed: ${res.status}`);
  return res.json();
}

/**
 * Persist the full recipe list to Google Drive.
 * Creates the file on first call; patches it on subsequent calls.
 */
export async function saveToDrive(token, recipes) {
  const fileId = await findFileId(token);
  const body = JSON.stringify(recipes);

  if (fileId) {
    const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) throw new Error(`Drive update failed: ${res.status}`);
  } else {
    const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
    const form = new FormData();
    form.append('metadata', new Blob([metadata], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));
    const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Drive create failed: ${res.status}`);
  }
}
