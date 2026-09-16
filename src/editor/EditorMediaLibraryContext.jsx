import { createContext, useContext, useMemo } from 'react';

const EditorMediaLibraryContext = createContext(null);

export function EditorMediaLibraryProvider({ page, authUser = null, children }) {
  const value = useMemo(
    () => ({ page, authUser }),
    [page, authUser?.ownerId, authUser?.session, authUser?.email],
  );
  return (
    <EditorMediaLibraryContext.Provider value={value}>
      {children}
    </EditorMediaLibraryContext.Provider>
  );
}

export function useEditorMediaLibrary() {
  return useContext(EditorMediaLibraryContext);
}