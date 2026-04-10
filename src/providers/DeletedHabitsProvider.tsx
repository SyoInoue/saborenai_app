import { createContext, useContext, useState } from 'react';

type Ctx = {
  deletedIds: Set<string>;
  markDeleted: (id: string) => void;
  clearDeleted: () => void;
};

const DeletedHabitsContext = createContext<Ctx>({
  deletedIds: new Set(),
  markDeleted: () => {},
  clearDeleted: () => {},
});

export function DeletedHabitsProvider({ children }: { children: React.ReactNode }) {
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const markDeleted = (id: string) =>
    setDeletedIds((prev) => new Set([...prev, id]));

  const clearDeleted = () => setDeletedIds(new Set());

  return (
    <DeletedHabitsContext.Provider value={{ deletedIds, markDeleted, clearDeleted }}>
      {children}
    </DeletedHabitsContext.Provider>
  );
}

export const useDeletedHabits = () => useContext(DeletedHabitsContext);
