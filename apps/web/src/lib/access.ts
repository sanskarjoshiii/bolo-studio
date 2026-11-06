import "server-only";
import { readStore, requireAccess, requireManage, WorkflowError, type Post, type User } from "@bolo/core";

/** The post, if this account belongs to its company (404 for posts that don't exist). */
export function authorizePost(user: User, postId: string): Post {
  const post = readStore().posts.find((p) => p.id === postId);
  if (!post) throw new WorkflowError(404, "Post not found.");
  requireAccess(user, post.clientId);
  return post;
}

export function authorizeCompany(user: User, companyId: string) {
  requireAccess(user, companyId);
}

export function authorizeManage(user: User, companyId: string) {
  requireManage(user, companyId);
}
