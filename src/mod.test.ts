import {
  Api,
  ChatMember,
  ChatMemberUpdated,
  Context,
  UserFromGetMe,
} from './deps.deno.ts';
import {
  chatMemberFilter,
  ChatMemberFilterQuery,
  chatMemberIs,
  ChatMemberPermissions,
  chatMemberPermissions,
  ChatMemberPrivileges,
  chatMemberPrivileges,
  myChatMemberFilter,
  normalizeChatMemberFilterQuery,
} from './mod.ts';
import { assertEquals } from 'jsr:@std/assert@1';

/**
 * Type helper to check that all keys are present in the array
 */
function _hasAllKeys<Obj, Arr extends (keyof Obj)[]>(
  val: keyof Obj extends Arr[number] ? number : never,
) {
  return val;
}
_hasAllKeys<ChatMemberPermissions, typeof chatMemberPermissions>(1);
_hasAllKeys<ChatMemberPrivileges, typeof chatMemberPrivileges>(1);

Deno.test('should normalize combined filter queries', () => {
  assertEquals(normalizeChatMemberFilterQuery('admin').sort(), [
    'administrator',
    'creator',
  ]);
  assertEquals(normalizeChatMemberFilterQuery('free').sort(), [
    'administrator',
    'creator',
    'member',
  ]);
  assertEquals(normalizeChatMemberFilterQuery('in').sort(), [
    'administrator',
    'creator',
    'member',
    'restricted',
  ]);
  assertEquals(normalizeChatMemberFilterQuery('out').sort(), [
    'kicked',
    'left',
  ]);
  assertEquals(normalizeChatMemberFilterQuery('regular').sort(), [
    'member',
    'restricted',
  ]);
});

Deno.test('should normalize regular filter queries', () => {
  const statuses: ChatMember['status'][] = [
    'administrator',
    'creator',
    'kicked',
    'left',
    'member',
    'restricted',
  ];
  statuses.forEach((status) => {
    assertEquals(normalizeChatMemberFilterQuery(status), [status]);
  });
});

Deno.test('should normalize filter query arrays', () => {
  assertEquals(normalizeChatMemberFilterQuery(['regular', 'out']).sort(), [
    'kicked',
    'left',
    'member',
    'restricted',
  ]);
  assertEquals(normalizeChatMemberFilterQuery(['restricted', 'out']).sort(), [
    'kicked',
    'left',
    'restricted',
  ]);
  assertEquals(
    normalizeChatMemberFilterQuery(['admin', 'administrator', 'creator'])
      .sort(),
    ['administrator', 'creator'],
  );
});

Deno.test('should apply query to chat member', () => {
  const results: Record<
    ChatMember['status'],
    Record<Exclude<ChatMemberFilterQuery, ChatMember['status']>, boolean>
  > = {
    administrator: {
      in: true,
      out: false,
      free: true,
      admin: true,
      regular: false,
    },
    creator: {
      in: true,
      out: false,
      free: true,
      admin: true,
      regular: false,
    },
    member: {
      in: true,
      out: false,
      free: true,
      admin: false,
      regular: true,
    },
    restricted: {
      in: true,
      out: false,
      free: false,
      admin: false,
      regular: true,
    },
    left: {
      in: false,
      out: true,
      free: false,
      admin: false,
      regular: false,
    },
    kicked: {
      in: false,
      out: true,
      free: false,
      admin: false,
      regular: false,
    },
  } as const;

  const statuses = Object.keys(results) as (keyof typeof results)[];
  statuses.forEach((status) => {
    const chatMember = { status } as ChatMember;
    const statusResults = results[status];

    const queries = Object.keys(
      results[status],
    ) as (keyof typeof statusResults)[];
    queries.forEach((query) => {
      assertEquals(chatMemberIs(chatMember, query), statusResults[query]);
    });

    statuses.forEach((query) => {
      assertEquals(chatMemberIs(chatMember, query), status === query);
    });
  });
});

function makeChatMemberUpdated(
  oldChatMemberStatus: ChatMember['status'],
  newChatMemberStatus: ChatMember['status'],
) {
  return {
    old_chat_member: { status: oldChatMemberStatus },
    new_chat_member: { status: newChatMemberStatus },
  } as ChatMemberUpdated;
}

function makeMyChatMemberCtx(
  oldStatus: ChatMember['status'],
  newStatus: ChatMember['status'],
) {
  return new Context(
    {
      update_id: 123,
      my_chat_member: makeChatMemberUpdated(oldStatus, newStatus),
    },
    new Api(''),
    {} as UserFromGetMe,
  );
}

Deno.test('should filter myChatMember', () => {
  const administratorKickedCtx = makeMyChatMemberCtx('administrator', 'kicked');
  const administratorKickedFilters = [
    ['administrator', 'kicked', true],
    ['administrator', 'out', true],
    ['admin', 'kicked', true],
    ['admin', 'out', true],
    ['in', 'out', true],
    ['regular', 'kicked', false],
    ['member', 'out', false],
    ['administrator', 'member', false],
    ['admin', 'in', false],
    ['out', 'in', false],
  ] as const;

  administratorKickedFilters.forEach(([oldStatus, newStatus, expected]) => {
    const filter = myChatMemberFilter(oldStatus, newStatus);
    assertEquals(filter(administratorKickedCtx), expected);
  });
});

function makeChatMemberCtx(
  oldStatus: ChatMember['status'],
  newStatus: ChatMember['status'],
) {
  return new Context(
    {
      update_id: 123,
      chat_member: makeChatMemberUpdated(oldStatus, newStatus),
    },
    new Api(''),
    {} as UserFromGetMe,
  );
}

Deno.test('should filter chatMember', () => {
  const leftRestrictedCtx = makeChatMemberCtx('left', 'restricted');
  const administratorKickedFilters = [
    ['left', 'restricted', true],
    ['restricted', 'left', false],
    ['out', 'in', true],
    ['in', 'out', false],
    ['out', 'admin', false],
    ['kicked', 'restricted', false],
    ['out', 'free', false],
    ['kicked', 'member', false],
    ['member', 'out', false],
  ] as const;

  administratorKickedFilters.forEach(([oldStatus, newStatus, expected]) => {
    const filter = chatMemberFilter(oldStatus, newStatus);
    assertEquals(filter(leftRestrictedCtx), expected);
  });
});

Deno.test('should filter out other types of updates', () => {
  const administratorAdministratorCtx = makeChatMemberCtx(
    'administrator',
    'administrator',
  );
  assertEquals(
    myChatMemberFilter('admin', 'admin')(administratorAdministratorCtx),
    false,
  );
  assertEquals(
    chatMemberFilter('admin', 'admin')(administratorAdministratorCtx),
    true,
  );

  const memberRestrictedCtx = makeMyChatMemberCtx('member', 'restricted');
  assertEquals(
    myChatMemberFilter('free', 'restricted')(memberRestrictedCtx),
    true,
  );
  assertEquals(
    chatMemberFilter('free', 'restricted')(memberRestrictedCtx),
    false,
  );
});
