import { resetStore } from "./store";

const data = await resetStore();
console.log(`Store reset: ${data.posts.length} demo posts for ${Object.keys(data.settings).length} clients (accounts kept).`);
