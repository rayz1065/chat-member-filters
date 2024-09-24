import {
  ChatAdministratorRights,
  ChatMember,
  ChatMemberAdministrator,
  ChatMemberBanned,
  ChatMemberLeft,
  ChatMemberMember,
  ChatMemberOwner,
  ChatMemberRestricted,
  Context,
  Filter,
} from './deps.deno.ts';

/**
 * A member of the chat, with any role, possibly restricted.
 */
export type ChatMemberIn =
  | ChatMemberAdministrator
  | ChatMemberOwner
  | ChatMemberRestricted
  | ChatMemberMember;
/**
 * Not a member of the chat
 */
export type ChatMemberOut = ChatMemberBanned | ChatMemberLeft;
/**
 * A member of the chat, with any role, not restricted.
 */
export type ChatMemberFree =
  | ChatMemberAdministrator
  | ChatMemberOwner
  | ChatMemberMember;
/**
 * An admin of the chat, either administrator or owner.
 */
export type ChatMemberAdmin = ChatMemberAdministrator | ChatMemberOwner;
/**
 * A regular (non-admin) user of the chat, possibly restricted.
 */
export type ChatMemberRegular = ChatMemberRestricted | ChatMemberMember;
/**
 * Query type for chat member status.
 */
export type ChatMemberQuery =
  | 'in'
  | 'out'
  | 'free'
  | 'admin'
  | 'regular'
  | ChatMember['status'];

const chatMemberQueries = {
  admin: ['administrator', 'creator'],
  administrator: ['administrator'],
  creator: ['creator'],
  free: ['administrator', 'creator', 'member'],
  in: ['administrator', 'creator', 'member', 'restricted'],
  out: ['kicked', 'left'],
  regular: ['member', 'restricted'],
  kicked: ['kicked'],
  left: ['left'],
  member: ['member'],
  restricted: ['restricted'],
} as const satisfies Record<ChatMemberQuery, ChatMember['status'][]>;

type MaybeArray<T> = T | T[];

type NormalizeChatMemberQueryCore<Q extends ChatMemberQuery> =
  (typeof chatMemberQueries)[Q][number];
type NormalizeChatMemberQuery<
  Q extends MaybeArray<ChatMemberQuery>,
> = Q extends ChatMemberQuery ? NormalizeChatMemberQueryCore<Q>
  : (Q extends ChatMemberQuery[] ? NormalizeChatMemberQuery<Q[number]>
    : never);
export type FilteredChatMember<
  C extends ChatMember,
  Q extends MaybeArray<ChatMemberQuery>,
> = C & { status: NormalizeChatMemberQuery<Q> };

/**
 * Normalizes the query, returning the corresponding list of chat member
 * statuses.
 */
function normalizeChatMemberQuery<T extends ChatMemberQuery>(
  query: MaybeArray<T>,
): NormalizeChatMemberQuery<T>[] {
  if (Array.isArray(query)) {
    const res = new Set<ChatMemberQuery>(
      query.flatMap(normalizeChatMemberQuery),
    );
    return [...res] as NormalizeChatMemberQuery<T>[];
  }

  return [
    ...chatMemberQueries[query],
  ] as NormalizeChatMemberQuery<T>[];
}

export function chatMemberIs<
  C extends ChatMember,
  Q extends ChatMemberQuery,
>(
  chatMember: C,
  query: MaybeArray<Q>,
): chatMember is FilteredChatMember<C, Q> {
  const roles = normalizeChatMemberQuery(query);
  return roles.includes(chatMember.status as (typeof roles)[number]);
}

/**
 * Determines whether the user is a member a member of the chat, with any role,
 * possibly restricted.
 */
export function chatMemberIsIn(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'in');
}

/**
 * Determines whether the user is _not_ a member of the chat.
 */
export function chatMemberIsOut(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'out');
}

/**
 * Determines whether the user is a member of the chat, with any role, not
 * restricted.
 */
export function chatMemberIsFree(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'free');
}

/**
 * Determines whether the user is an admin of the chat, either administrator or
 * owner.
 */
export function chatMemberIsAdmin(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'admin');
}

/**
 * Determines whether the user is a regular (non-admin) user of the chat,
 * possibly restricted.
 */
export function chatMemberIsRegular(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'regular');
}

/**
 * A list of rights that admins can have.
 */
const chatMemberRights = [
  'is_anonymous',
  'can_manage_chat',
  'can_delete_messages',
  'can_manage_video_chats',
  'can_restrict_members',
  'can_promote_members',
  'can_change_info',
  'can_invite_users',
  'can_post_stories',
  'can_edit_stories',
  'can_delete_stories',
  'can_post_messages',
  'can_edit_messages',
  'can_pin_messages',
  'can_manage_topics',
] as const satisfies (keyof ChatAdministratorRights)[];

type AdministratorRight = typeof chatMemberRights[number];

function getChatMemberRights(
  chatMember: ChatMember,
): Record<AdministratorRight, boolean> {
  const defaultRight = chatMember.status === 'creator';

  const defaults = Object.fromEntries(
    chatMemberRights.map((x) => [x, defaultRight]),
  ) as Record<AdministratorRight, boolean>;

  if (chatMember.status !== 'administrator') {
    return defaults;
  }

  return Object.fromEntries(
    chatMemberRights.map((x) => [
      x,
      chatMember[x] ?? defaultRight,
    ]),
  ) as Record<AdministratorRight, boolean>;
}

/**
 * Returns the rights that the chat member is missing from the list of
 * required rights.
 */
export function getMissingRights<
  T extends AdministratorRight,
>(chatMember: ChatMember, ...requiredRights: T[]): T[] {
  const rights = getChatMemberRights(chatMember);
  return requiredRights.filter(
    (right) => !rights[right as keyof typeof rights],
  );
}

/**
 * Returns true if all the required rights are met.
 */
export function chatMemberHasRights(
  chatMember: ChatMember,
  ...requiredRights: (AdministratorRight)[]
): boolean {
  const missing = getMissingRights(
    chatMember,
    ...requiredRights,
  );
  return missing.length === 0;
}

export function myChatMemberFilter<
  C extends Context,
  Q1 extends ChatMemberQuery,
  Q2 extends ChatMemberQuery,
>(oldStatus: MaybeArray<Q1>, newStatus: MaybeArray<Q2>) {
  return (
    ctx: C,
  ): ctx is Filter<C, 'my_chat_member'> & {
    myChatMember: {
      old_chat_member: FilteredChatMember<ChatMember, Q1>;
      new_chat_member: FilteredChatMember<ChatMember, Q2>;
    };
  } => {
    return (
      ctx.has('my_chat_member') &&
      chatMemberIs(ctx.myChatMember.old_chat_member, oldStatus) &&
      chatMemberIs(ctx.myChatMember.new_chat_member, newStatus)
    );
  };
}

export function chatMemberFilter<
  C extends Context,
  Q1 extends ChatMemberQuery,
  Q2 extends ChatMemberQuery,
>(oldStatus: MaybeArray<Q1>, newStatus: MaybeArray<Q2>) {
  return (
    ctx: C,
  ): ctx is Filter<C, 'chat_member'> & {
    chatMember: {
      old_chat_member: FilteredChatMember<ChatMember, Q1>;
      new_chat_member: FilteredChatMember<ChatMember, Q2>;
    };
  } => {
    return (
      ctx.has('chat_member') &&
      chatMemberIs(ctx.chatMember.old_chat_member, oldStatus) &&
      chatMemberIs(ctx.chatMember.new_chat_member, newStatus)
    );
  };
}
