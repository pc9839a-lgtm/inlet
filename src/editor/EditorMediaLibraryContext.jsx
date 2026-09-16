import { createContext, useContext, useMemo } from 'react';
import { AUTH_KEY } from '../config/storageKeys.js';
import { normalizeAuthUser } from '../lib/authIdentity.js';
import { load } from '../lib/storage.js';

const EditorMediaLibraryContext = createContext(null);

export function EditorMediaLibraryProvider({ page, children }) {
  const authUser = normalizeAuthUser(load(AUTH_KEY, null));
  const value = useMemo(() => ({ page, authUser }), [page, authUser?.ownerId, authUser?.session, authUser?.email]);
  return (
    <EditorMediaLibraryContext.Provider value={value}>
      {children}
    </EditorMediaLibraryContext.Provider>
  );
}

export function useEditorMediaLibrary() {
  return useContext(EditorMediaLibraryContext);
}
