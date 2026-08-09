import { onRequest as __api_game_save_ts_onRequest } from "/home/sarok/projects/anathor projects/FinalRank/functions/api/game/save.ts"
import { onRequest as __api_game__id__ts_onRequest } from "/home/sarok/projects/anathor projects/FinalRank/functions/api/game/[id].ts"
import { onRequest as __api_puzzles_ts_onRequest } from "/home/sarok/projects/anathor projects/FinalRank/functions/api/puzzles.ts"

export const routes = [
    {
      routePath: "/api/game/save",
      mountPath: "/api/game",
      method: "",
      middlewares: [],
      modules: [__api_game_save_ts_onRequest],
    },
  {
      routePath: "/api/game/:id",
      mountPath: "/api/game",
      method: "",
      middlewares: [],
      modules: [__api_game__id__ts_onRequest],
    },
  {
      routePath: "/api/puzzles",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_puzzles_ts_onRequest],
    },
  ]