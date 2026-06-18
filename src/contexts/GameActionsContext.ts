import { createContext, useContext } from "react";

interface GameActionsContextType {
  onDifferentGame?: () => void;
}

export const GameActionsContext = createContext<GameActionsContextType>({});

export const useGameActions = () => useContext(GameActionsContext);
