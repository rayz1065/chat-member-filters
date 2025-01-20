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
 * The 'restricted' status is ambiguous, since it can refer both to a member in
 * the group and a member out of the group.
 * To avoid ambiguity we split the restricted role into "restricted_in" and
 * "restricted_out".
 */
type ChatMemberStatusBase =
  | Exclude<ChatMember['status'], 'restricted'>
  | 'restricted_in'
  | 'restricted_out';

/**
 * A member of the chat, with restrictions applied.
 */
export type ChatMemberRestrictedIn = ChatMemberRestricted & { is_member: true };
/**
 * Not a member of the chat, with restrictions applied.
 */
export type ChatMemberRestrictedOut = ChatMemberRestricted & {
  is_member: false;
};
/**
 * A member of the chat, with any role, possibly restricted.
 */
export type ChatMemberIn =
  | ChatMemberAdministrator
  | ChatMemberOwner
  | ChatMemberRestrictedIn
  | ChatMemberMember;
/**
 * Not a member of the chat
 */
export type ChatMemberOut =
  | ChatMemberBanned
  | ChatMemberLeft
  | ChatMemberRestrictedOut;
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
export type ChatMemberRegular = ChatMemberRestrictedIn | ChatMemberMember;
/**
 * Query type for chat member status.
 */
export type ChatMemberQuery =
  | 'in'
  | 'out'
  | 'free'
  | 'admin'
  | 'regular'
  | 'restricted_in'
  | 'restricted_out'
  | ChatMember['status'];

/**
 * Used to normalize queries to the simplest components.
 */
const chatMemberQueries = {
  admin: ['administrator', 'creator'],
  administrator: ['administrator'],
  creator: ['creator'],
  free: ['administrator', 'creator', 'member'],
  in: ['administrator', 'creator', 'member', 'restricted_in'],
  out: ['kicked', 'left', 'restricted_out'],
  regular: ['member', 'restricted_in'],
  kicked: ['kicked'],
  left: ['left'],
  member: ['member'],
  restricted: ['restricted'],
  restricted_in: ['restricted_in'],
  restricted_out: ['restricted_out'],
} as const satisfies Record<
  ChatMemberQuery,
  (ChatMember['status'] | 'restricted_in' | 'restricted_out')[]
>;

/**
 * Maps from the query to the corresponding type.
 */
type ChatMemberQueriesMap = {
  admin: ChatMemberAdmin;
  administrator: ChatMemberAdministrator;
  creator: ChatMemberOwner;
  free: ChatMemberFree;
  in: ChatMemberIn;
  out: ChatMemberOut;
  regular: ChatMemberRegular;
  kicked: ChatMemberBanned;
  left: ChatMemberLeft;
  member: ChatMemberMember;
  restricted: ChatMemberRestricted;
  restricted_in: ChatMemberRestrictedIn;
  restricted_out: ChatMemberRestrictedOut;
};

type NormalizeChatMemberQueryCore<Q extends ChatMemberQuery> =
  (typeof chatMemberQueries)[Q][number];

type MaybeArray<T> = T | T[];
type NormalizeChatMemberQuery<
  Q extends MaybeArray<ChatMemberQuery>,
> = Q extends ChatMemberQuery ? NormalizeChatMemberQueryCore<Q>
  : (Q extends ChatMemberQuery[] ? NormalizeChatMemberQuery<Q[number]>
    : never);
type FilteredChatMemberCore<
  C extends ChatMember,
  Q extends ChatMember['status'] | 'restricted_in' | 'restricted_out',
> = C & ChatMemberQueriesMap[Q];
export type FilteredChatMember<
  C extends ChatMember,
  Q extends MaybeArray<ChatMemberQuery>,
> = FilteredChatMemberCore<
  C,
  NormalizeChatMemberQuery<Q extends string ? Q : Q[number]>
>;

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

  if (chatMember.status === 'restricted') {
    if (roles.includes('restricted' as (typeof roles)[number])) {
      return true;
    } else if (chatMember.is_member) {
      return roles.includes('restricted_in' as (typeof roles)[number]);
    } else {
      return roles.includes('restricted_out' as (typeof roles)[number]);
    }
  }

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
 * Determines whether the user is in the chat as a restricted member.
 */
export function chatMemberIsRestrictedIn(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'restricted_in');
}

/**
 * Determines whether the user is _not_ in the chat and has restrictions.
 */
export function chatMemberIsRestrictedOut(chatMember: ChatMember) {
  return chatMemberIs(chatMember, 'restricted_out');
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
