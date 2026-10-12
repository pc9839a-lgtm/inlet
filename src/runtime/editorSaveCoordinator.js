// Both content and style publishing write the same page revision.
// One account-scoped FIFO coordinator prevents the two editor hooks from
// constructing concurrent, conflicting server writes.
const pendingEditorSaves = new Map();

function editorSaveAccountKey(authUser = {}) {
  return String(
    authUser?.accountId
      || authUser?.ownerId
      || authUser?.email
      || 'anonymous-editor',
  ).trim().toLowerCase();
}

export async function serializeEditorSave(authUser, execute) {
  if (typeof execute !== 'function') throw new TypeError('Editor save requires an executable task.');
  const key = editorSaveAccountKey(authUser);
  const previous = pendingEditorSaves.get(key) || Promise.resolve();
  let release;
  const turn = new Promise((resolve) => { release = resolve; });
  pendingEditorSaves.set(key, turn);

  try {
    await previous;
    return await execute();
  } finally {
    if (pendingEditorSaves.get(key) === turn) pendingEditorSaves.delete(key);
    release();
  }
}
