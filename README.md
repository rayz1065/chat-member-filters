# Grammy Chat Member Filters

This package exports convenient filters for `chat_member` and `my_chat_member` updates, as well as functions to test the type of a `ChatMember`.
Filters specify the status before and after the change, allowing you to react to every type of transition you're interested in.
Within the handler, types of `old_chat_member` and `new_chat_member` are updated accordingly.

```typescript
const bot = new Bot('<your-bot-token>');
const groups = bot.chatType(['group', 'supergroup']);

groups.filter(myChatMemberFilter('out', 'regular'), async (ctx) => {
  await ctx.reply('Hello, thank you for adding me to the group!');
});

groups.filter(myChatMemberFilter('out', 'admin'), async (ctx) => {
  await ctx.reply('Hello, thank you for adding me to the group as admin!');
});

groups.filter(myChatMemberFilter('regular', 'admin'), async (ctx) => {
  await ctx.reply('I was promoted to admin!');
});

groups.filter(myChatMemberFilter('admin', 'regular'), async (ctx) => {
  await ctx.reply('I am no longer admin');
});

// add 'chat_member' to the list of allowed updates to receive this.
groups.filter(chatMemberFilter('out', 'in'), async (ctx) => {
  const user = ctx.chatMember.new_chat_member.user;
  await ctx.reply(
    `Welcome <b>${escapeHtml(user.first_name)}</> to the group!`,
    { parse_mode: 'HTML' },
  );
});
```

Filters include the regular Telegram statuses (owner, administrator, member, restricted, left, kicked) and some additional ones for convenience:

- in: a member of the chat (administrator, creator, member, restricted);
- out: not a member of the chat (left, kicked);
- free: a member of the chat that isn't restricted (administrator, creator, member);
- admin: an admin of the chat (administrator, creator);
- regular: a non-admin member of the chat (member, restricted).

You can create your custom groupings of chat member types by passing an array instead of a string:

```typescript
groups.filter(
  chatMemberFilter(['restricted', 'kicked'], ['free', 'left']),
  async (ctx) => {
    const from = ctx.from;
    const { status: oldStatus, user } = ctx.chatMember.old_chat_member;
    await ctx.reply(
      `<b>${escapeHtml(from.first_name)}</> lifted ` +
        `${oldStatus === 'kicked' ? 'ban' : 'restrictions'} ` +
        `from <b>${escapeHtml(user.first_name)}</>`,
      { parse_mode: 'HTML' },
    );
  },
);
```

## License

Grammy Chat Member Filters is available under the **MIT License**.
