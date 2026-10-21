import { reqHandler } from '../dist/listo/server/server.mjs';

export default function handler(req, res) {
  return reqHandler(req, res);
}
