export type GameModule = {
  name: string;
  start: () => void | Promise<void>;
};
