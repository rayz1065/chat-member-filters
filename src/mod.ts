import { Context, Filter } from 'grammy';
import {
  ChatMember,
  ChatMemberAdministrator,
  ChatMemberBanned,
  ChatMemberLeft,
  ChatMemberMember,
  ChatMemberOwner,
  ChatMemberRestricted,
} from 'grammy/types';

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
export type ChatMemberFilterQuery =
  | 'in'
  | 'out'
  | 'free'
  | 'admin'
  | 'regular'
  | ChatMember['status'];

const chatMemberFilterQueries = {
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
} as const satisfies Record<ChatMemberFilterQuery, ChatMember['status'][]>;

type MaybeArray<T> = T | T[];

type NormalizeChatMemberFilterQueryCore<Q extends ChatMemberFilterQuery> =
  (typeof chatMemberFilterQueries)[Q][number];
type NormalizeChatMemberFilterQuery<
  Q extends MaybeArray<ChatMemberFilterQuery>,
> = Q extends ChatMemberFilterQuery
  ? NormalizeChatMemberFilterQueryCore<Q>
  : Q extends ChatMemberFilterQuery[]
    ? NormalizeChatMemberFilterQuery<Q[number]>
    : never;
type FilteredChatMember<
  C extends ChatMember,
  Q extends MaybeArray<ChatMemberFilterQuery>,
> = C & { status: NormalizeChatMemberFilterQuery<Q> };

/**
 * Normalizes the filter query, returning the corresponding list of chat member
 * statuses.
 */
export function normalizeChatMemberFilterQuery<T extends ChatMemberFilterQuery>(
  query: MaybeArray<T>
): NormalizeChatMemberFilterQuery<T>[] {
  if (Array.isArray(query)) {
    const res = new Set<ChatMemberFilterQuery>(
      query.flatMap(normalizeChatMemberFilterQuery)
    );
    return [...res] as NormalizeChatMemberFilterQuery<T>[];
  }

  return [
    ...chatMemberFilterQueries[query],
  ] as NormalizeChatMemberFilterQuery<T>[];
}

export function chatMemberIs<
  C extends ChatMember,
  Q extends ChatMemberFilterQuery,
>(
  chatMember: C,
  filter: MaybeArray<Q>
): chatMember is FilteredChatMember<C, Q> {
  const roles = normalizeChatMemberFilterQuery(filter);
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
 * A list of permissions that admins can have.
 */
export const chatMemberPermissions = [
  'can_change_info',
  'can_delete_messages',
  'can_delete_stories',
  'can_edit_messages',
  'can_edit_stories',
  'can_invite_users',
  'can_manage_chat',
  'can_manage_topics',
  'can_manage_video_chats',
  'can_pin_messages',
  'can_post_messages',
  'can_post_stories',
  'can_promote_members',
  'can_restrict_members',
] as const satisfies (keyof ChatMemberAdministrator)[];

/**
 * A list of privileges that chat members can have. These include permissions
 * as well as `custom_title` and `is_anonymous`.
 */
export const chatMemberPrivileges = [
  ...chatMemberPermissions,
  'custom_title',
  'is_anonymous',
] as const satisfies (keyof ChatMemberAdministrator)[];

/**
 * Permissions of a chat member.
 */
export type ChatMemberPermissions = Record<
  (typeof chatMemberPermissions)[number],
  boolean
>;

/**
 * Privileges of a chat member, these include permissions as well as
 * `custom_title` and `is_anonymous`.
 */
export type ChatMemberPrivileges = ChatMemberPermissions & {
  custom_title: string | undefined;
  is_anonymous: boolean;
};

/**
 * Type helper to check that all keys are present in the array
 */
function _hasAllKeys<Obj, Arr extends (keyof Obj)[]>(
  val: keyof Obj extends Arr[number] ? number : never
) {
  return val;
}
_hasAllKeys<ChatMemberPermissions, typeof chatMemberPermissions>(1);
_hasAllKeys<ChatMemberPrivileges, typeof chatMemberPrivileges>(1);

/**
 * Returns the full chat member privileges for any kind of chat member, the
 * owner has all privileges, regular users have no privileges. Missing (i.e.
 * irrelevant) values for administrators are replaced with false.
 */
export function getChatMemberPrivileges(
  chatMember: ChatMember
): ChatMemberPrivileges {
  const defaultPermission = chatMember.status === 'creator';

  const defaults = Object.fromEntries(
    chatMemberPermissions.map((x) => [x, defaultPermission])
  ) as ChatMemberPermissions;

  if (chatMember.status === 'creator') {
    return {
      ...defaults,
      custom_title: chatMember.custom_title,
      is_anonymous: chatMember.is_anonymous,
    };
  }

  if (chatMember.status === 'administrator') {
    return {
      ...(Object.fromEntries(
        chatMemberPermissions.map((x) => [
          x,
          chatMember[x] ?? defaultPermission,
        ])
      ) as ChatMemberPermissions),
      custom_title: chatMember.custom_title,
      is_anonymous: chatMember.is_anonymous,
    };
  }

  return {
    ...defaults,
    custom_title: undefined,
    is_anonymous: false,
  };
}

/**
 * Returns the privileges that have changed between the old and new chat
 * member.
 *
 * You can pass in directly a `ChatMemberUpdated` object.
 * ```typescript
 * bot.on('my_chat_member', (ctx) => {
 *  const changedPermissions = getChangedChatMemberPrivileges(ctx.myChatMember);
 * })
 * ```
 */
export function getChangedChatMemberPrivileges(chatMemberChange: {
  new_chat_member: ChatMember;
  old_chat_member: ChatMember;
}) {
  const previous = getChatMemberPrivileges(chatMemberChange.old_chat_member);
  const current = getChatMemberPrivileges(chatMemberChange.new_chat_member);
  return chatMemberPrivileges.filter((key) => previous[key] !== current[key]);
}

/**
 * Returns the permissions that the chat member is missing from the list of
 * required permissions.
 */
export function getChatMemberMissingPermissions<
  T extends keyof ChatMemberPermissions,
>(chatMember: ChatMember, requiredPermissions: T[]): T[] {
  const actualYPermissions = getChatMemberPrivileges(chatMember);
  return requiredPermissions.filter(
    (permission) => actualYPermissions[permission] !== true
  );
}

/**
 * Returns true if all the required permissions are met.
 */
export function chatMemberHasPermissions(
  chatMember: ChatMember,
  requiredPermissions: (keyof ChatMemberPermissions)[]
): boolean {
  const missing = getChatMemberMissingPermissions(
    chatMember,
    requiredPermissions
  );
  return missing.length === 0;
}

export function filterMyChatMember<
  C extends Context,
  Q1 extends ChatMemberFilterQuery,
  Q2 extends ChatMemberFilterQuery,
>(oldStatus: MaybeArray<Q1>, newStatus: MaybeArray<Q2>) {
  return (
    ctx: C
  ): ctx is Filter<C, 'my_chat_member'> & {
    myChatMember: {
      old_chat_member: FilteredChatMember<ChatMember, Q1>;
      new_chat_member: FilteredChatMember<ChatMember, Q2>;
    };
  } => {
    if (!ctx.has('my_chat_member')) {
      return false;
    }

    if (
      !chatMemberIs(ctx.myChatMember.old_chat_member, oldStatus) ||
      !chatMemberIs(ctx.myChatMember.new_chat_member, newStatus)
    ) {
      return false;
    }

    return true;
  };
}

export function filterChatMember<
  C extends Context,
  Q1 extends ChatMemberFilterQuery,
  Q2 extends ChatMemberFilterQuery,
>(oldStatus: MaybeArray<Q1>, newStatus: MaybeArray<Q2>) {
  return (
    ctx: C
  ): ctx is Filter<C, 'chat_member'> & {
    chatMember: {
      old_chat_member: FilteredChatMember<ChatMember, Q1>;
      new_chat_member: FilteredChatMember<ChatMember, Q2>;
    };
  } => {
    if (!ctx.has('chat_member')) {
      return false;
    }

    if (
      !chatMemberIs(ctx.chatMember.old_chat_member, oldStatus) ||
      !chatMemberIs(ctx.chatMember.new_chat_member, newStatus)
    ) {
      return false;
    }

    return true;
  };
}
