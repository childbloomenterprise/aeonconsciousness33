import { handler } from "../server/http.js";
import { processChat } from "../server/chat.js";
export default handler(["POST"], processChat);
